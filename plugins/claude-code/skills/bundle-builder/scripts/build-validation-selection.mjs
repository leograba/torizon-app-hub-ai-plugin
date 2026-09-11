#!/usr/bin/env node
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const MAX_FILES = 50;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 2 * MAX_FILE_BYTES;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/;
const SECRET = /(?:client[_-]?secret|password|private[_-]?key|access[_-]?token|refresh[_-]?token|authorization|cookie|api[_-]?key)\s*[:=]|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;

const args = process.argv.slice(2);
const separator = args.indexOf("--");
const optionArgs = separator === -1 ? [] : args.slice(0, separator);
const selected = separator === -1 ? [] : args.slice(separator + 1);
const option = (name) => {
  const index = optionArgs.indexOf(name);
  return index === -1 ? undefined : optionArgs[index + 1];
};
const hostId = option("--host");
const taskId = option("--task");
if (!hostId || !taskId || taskId.length < 8 || selected.length < 1 || selected.length > MAX_FILES) {
  throw new Error("usage: build-validation-selection --host <host-id> --task <task-id> -- <1..50 relative files>");
}

const cwd = process.cwd();
const manifest = [];
let totalBytes = 0;
for (const name of [...new Set(selected)].sort()) {
  if (!SAFE_PATH.test(name) || name.split("/").length > 8) throw new Error(`unsafe_selected_path:${name}`);
  const path = resolve(cwd, name);
  const rel = relative(cwd, path);
  if (rel === ".." || rel.startsWith(`..${sep}`)) throw new Error(`outside_workspace:${name}`);
  const info = await lstat(path);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(`selected_file_must_be_regular:${name}`);
  if (info.size > MAX_FILE_BYTES) throw new Error(`selected_file_too_large:${name}`);
  const content = await readFile(path);
  totalBytes += content.length;
  if (totalBytes > MAX_TOTAL_BYTES) throw new Error("selected_content_too_large");
  const text = content.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(content)) throw new Error(`selected_file_not_utf8:${name}`);
  if (SECRET.test(text)) throw new Error(`selected_file_may_contain_secret:${name}`);
  const category = /(?:^|\/)bundle\.ya?ml$/i.test(name) ? "bundle-manifest"
    : /(?:compose|\.override)\.ya?ml$/i.test(name) ? "compose-manifest"
      : /(?:config|schema).*\.json$/i.test(name) ? "configuration-schema"
        : "referenced-metadata";
  manifest.push({ path: name, category, declaredBytes: content.length, sha256: createHash("sha256").update(content).digest("hex"), contentTransferred: true });
}

const issuedAt = new Date();
const expiresAt = new Date(issuedAt.getTime() + 5 * 60_000);
process.stdout.write(`${JSON.stringify({
  notice: "Local selection only. No content was transferred and this output does not claim human approval.",
  selection: manifest.map(({ contentTransferred: _planned, ...entry }) => entry),
  clientAttestation: {
    attestationVersion: "1",
    hostId,
    taskId,
    purpose: "validate-bundle-workspace",
    destination: "App Hub remote validator",
    categories: [...new Set(manifest.map((entry) => entry.category))].sort(),
    manifest,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString()
  }
}, null, 2)}\n`);
