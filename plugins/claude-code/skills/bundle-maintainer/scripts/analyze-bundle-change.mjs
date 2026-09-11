#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const MAX_FILE_CHANGES = 200;
const MAX_BREAKING_CHANGES = 50;
const MAX_ADVISORY_CHANGES = 50;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const asRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const asArray = (value) => Array.isArray(value) ? value : [];
const valueAt = (root, path) => path.reduce((value, key) => asRecord(value)[key], root);
const sortedUnique = (values) => [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))].sort();

export const parseSemver = (value) => {
  if (typeof value !== "string") return null;
  const match = SEMVER.exec(value.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : []
  };
};

const compareIdentifier = (left, right) => {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  return left.localeCompare(right);
};

export const compareSemver = (leftValue, rightValue) => {
  const left = parseSemver(leftValue);
  const right = parseSemver(rightValue);
  if (!left || !right) return null;
  for (const key of ["major", "minor", "patch"]) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  if (left.prerelease.length === 0 && right.prerelease.length === 0) return 0;
  if (left.prerelease.length === 0) return 1;
  if (right.prerelease.length === 0) return -1;
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    const difference = compareIdentifier(leftPart, rightPart);
    if (difference !== 0) return difference;
  }
  return 0;
};

const fileDigest = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

const fileChanges = (baseFiles, candidateFiles) => {
  const base = asRecord(baseFiles);
  const candidate = asRecord(candidateFiles);
  const paths = sortedUnique([...Object.keys(base), ...Object.keys(candidate)]);
  const changes = paths.map((path) => {
    const inBase = Object.prototype.hasOwnProperty.call(base, path);
    const inCandidate = Object.prototype.hasOwnProperty.call(candidate, path);
    const kind = !inBase ? "added" : !inCandidate ? "removed" : fileDigest(base[path]) === fileDigest(candidate[path]) ? "unchanged" : "modified";
    return { path: path.slice(0, 240), kind };
  }).filter((change) => change.kind !== "unchanged");
  return { items: changes.slice(0, MAX_FILE_CHANGES), truncated: changes.length > MAX_FILE_CHANGES };
};

const addBounded = (state, limit, code, path, message) => {
  if (state.items.length >= limit) {
    state.truncated = true;
    return;
  }
  state.items.push({ code, path, message });
};

const addBreaking = (state, code, path, message) => addBounded(state, MAX_BREAKING_CHANGES, code, path, message);
const addAdvisory = (state, code, path, message) => addBounded(state, MAX_ADVISORY_CHANGES, code, path, message);

const stringSet = (value) => new Set(asArray(value).filter((entry) => typeof entry === "string"));

const composeTopology = (value) => {
  const topology = { services: new Set(), networks: new Set(), volumes: new Set() };
  if (typeof value === "string") {
    let section = null;
    for (const line of value.split(/\r?\n/)) {
      const root = /^([A-Za-z][A-Za-z0-9_-]*):\s*(?:#.*)?$/.exec(line);
      if (root) { section = root[1] in topology ? root[1] : null; continue; }
      const entry = /^\s{2}([A-Za-z0-9_.-]+):/.exec(line);
      if (section && entry) topology[section].add(entry[1]);
    }
    return topology;
  }
  const record = asRecord(value);
  for (const section of Object.keys(topology)) {
    for (const name of Object.keys(asRecord(record[section]))) topology[section].add(name);
  }
  return topology;
};

const detectTypedChanges = (base, candidate, baseFiles, candidateFiles) => {
  const breaking = { items: [], truncated: false };
  const advisory = { items: [], truncated: false };
  const baseBundle = asRecord(base);
  const candidateBundle = asRecord(candidate);
  if (baseBundle.schemaVersion !== candidateBundle.schemaVersion) {
    const baseSchema = parseSemver(baseBundle.schemaVersion);
    const candidateSchema = parseSemver(candidateBundle.schemaVersion);
    if (!baseSchema || !candidateSchema || baseSchema.major !== candidateSchema.major) {
      addBreaking(breaking, "schema_major_changed", "$.schemaVersion", "The App Bundle schema major changed.");
    }
  }

  const baseMeta = asRecord(valueAt(baseBundle, ["bundle", "meta"]));
  const candidateMeta = asRecord(valueAt(candidateBundle, ["bundle", "meta"]));
  if (baseMeta.id !== undefined && candidateMeta.id !== baseMeta.id) {
    addBreaking(breaking, "bundle_identity_changed", "$.bundle.meta.id", "The stable bundle identity changed.");
  }

  const baseCompatibility = asRecord(baseBundle.compatibility);
  const candidateCompatibility = asRecord(candidateBundle.compatibility);
  const baseHardware = stringSet(asRecord(baseCompatibility.hardware).machineIds);
  const candidateHardware = stringSet(asRecord(candidateCompatibility.hardware).machineIds);
  for (const machineId of [...baseHardware].filter((id) => !candidateHardware.has(id)).sort()) {
    addBreaking(breaking, "hardware_support_removed", "$.compatibility.hardware.machineIds", `Hardware support for ${machineId} was removed.`);
  }

  const baseOs = asRecord(baseCompatibility.torizonOS);
  const candidateOs = asRecord(candidateCompatibility.torizonOS);
  const baseMin = typeof baseOs.minVersion === "string" ? baseOs.minVersion : null;
  const candidateMin = typeof candidateOs.minVersion === "string" ? candidateOs.minVersion : null;
  const baseMax = typeof baseOs.maxVersion === "string" ? baseOs.maxVersion : null;
  const candidateMax = typeof candidateOs.maxVersion === "string" ? candidateOs.maxVersion : null;
  if ((!baseMin && candidateMin) || (baseMin && candidateMin && compareSemver(candidateMin, baseMin) > 0)) {
    addBreaking(breaking, "os_minimum_narrowed", "$.compatibility.torizonOS.minVersion", "The minimum supported Torizon OS version was raised.");
  } else if ((baseMin && !candidateMin) || (baseMin && candidateMin && compareSemver(candidateMin, baseMin) < 0)) {
    addAdvisory(advisory, "os_minimum_widened", "$.compatibility.torizonOS.minVersion", "The minimum supported Torizon OS version was widened.");
  }
  if ((!baseMax && candidateMax) || (baseMax && candidateMax && compareSemver(candidateMax, baseMax) < 0)) {
    addBreaking(breaking, "os_maximum_narrowed", "$.compatibility.torizonOS.maxVersion", "The maximum supported Torizon OS version was lowered.");
  } else if ((baseMax && !candidateMax) || (baseMax && candidateMax && compareSemver(candidateMax, baseMax) > 0)) {
    addAdvisory(advisory, "os_maximum_widened", "$.compatibility.torizonOS.maxVersion", "The maximum supported Torizon OS version was widened.");
  }
  if (baseOs.ostreeRef !== candidateOs.ostreeRef && (baseOs.ostreeRef !== undefined || candidateOs.ostreeRef !== undefined)) {
    addBreaking(breaking, "os_tree_contract_changed", "$.compatibility.torizonOS.ostreeRef", "The required Torizon OS tree reference changed.");
  }

  const baseTargets = asRecord(valueAt(baseBundle, ["bundle", "targets"]));
  const candidateTargets = asRecord(valueAt(candidateBundle, ["bundle", "targets"]));
  for (const target of Object.keys(baseTargets).filter((key) => !(key in candidateTargets)).sort()) {
    addBreaking(breaking, "deployment_target_removed", `$.bundle.targets.${target}`, `The ${target} deployment target was removed.`);
  }

  const baseKeys = asRecord(valueAt(baseBundle, ["bundle", "targets", "application", "configOverrides", "keys"]));
  const candidateKeys = asRecord(valueAt(candidateBundle, ["bundle", "targets", "application", "configOverrides", "keys"]));
  for (const key of Object.keys(baseKeys).filter((entry) => !(entry in candidateKeys)).sort()) {
    addBreaking(breaking, "configuration_key_removed", `$.bundle.targets.application.configOverrides.keys.${key}`, `Configuration key ${key} was removed.`);
  }
  for (const key of Object.keys(baseKeys).filter((entry) => entry in candidateKeys).sort()) {
    const before = asRecord(baseKeys[key]);
    const after = asRecord(candidateKeys[key]);
    if (before.type !== after.type) addBreaking(breaking, "configuration_type_changed", `$.bundle.targets.application.configOverrides.keys.${key}.type`, `Configuration key ${key} changed type.`);
    const beforeValues = stringSet(before.valuesList);
    const afterValues = stringSet(after.valuesList);
    for (const value of [...beforeValues].filter((entry) => !afterValues.has(entry)).sort()) {
      addBreaking(breaking, "configuration_value_removed", `$.bundle.targets.application.configOverrides.keys.${key}.valuesList`, `Configuration value ${value} was removed from ${key}.`);
    }
    if (before.default !== after.default) addBreaking(breaking, "configuration_default_changed", `$.bundle.targets.application.configOverrides.keys.${key}.default`, `Configuration key ${key} changed its default behavior.`);
  }
  const baseComposePath = valueAt(baseBundle, ["bundle", "targets", "application", "compose", "path"]);
  const candidateComposePath = valueAt(candidateBundle, ["bundle", "targets", "application", "compose", "path"]);
  if (baseComposePath !== candidateComposePath && (baseComposePath !== undefined || candidateComposePath !== undefined)) {
    addBreaking(breaking, "compose_entrypoint_changed", "$.bundle.targets.application.compose.path", "The primary Compose deployment artifact changed.");
  }
  const baseFileMap = asRecord(baseFiles);
  const candidateFileMap = asRecord(candidateFiles);
  const composePaths = sortedUnique([...Object.keys(baseFileMap), ...Object.keys(candidateFileMap)]).filter((path) => /compose.*\.ya?ml$/i.test(path));
  for (const path of composePaths) {
    const before = composeTopology(baseFileMap[path]);
    const after = composeTopology(candidateFileMap[path]);
    for (const section of ["services", "networks", "volumes"]) {
      for (const name of [...before[section]].filter((entry) => !after[section].has(entry)).sort()) {
        addBreaking(breaking, `${section.slice(0, -1)}_removed`, path, `${section.slice(0, -1)} ${name} was removed from ${path}.`);
      }
      for (const name of [...after[section]].filter((entry) => !before[section].has(entry)).sort()) {
        addAdvisory(advisory, `${section.slice(0, -1)}_added`, path, `${section.slice(0, -1)} ${name} was added to ${path}.`);
      }
    }
  }
  const migrationPaths = sortedUnique([...Object.keys(baseFileMap), ...Object.keys(candidateFileMap)])
    .filter((path) => /(?:^|[._/-])migrations?(?:[._/-]|$)/i.test(path));
  for (const path of migrationPaths) {
    const inBase = Object.prototype.hasOwnProperty.call(baseFileMap, path);
    const inCandidate = Object.prototype.hasOwnProperty.call(candidateFileMap, path);
    const kind = !inBase ? "added" : !inCandidate ? "removed" : fileDigest(baseFileMap[path]) === fileDigest(candidateFileMap[path]) ? "unchanged" : "modified";
    if (kind === "unchanged") continue;
    const change = { path, kind };
    if (change.kind === "removed") addBreaking(breaking, "migration_removed", change.path, "A migration artifact was removed.");
    else addAdvisory(advisory, "migration_changed", change.path, "A migration artifact was added or changed and requires explicit rollback review.");
  }
  return { breaking, advisory };
};

const hasAdditiveChange = (changes, base, candidate) => {
  if (changes.some((change) => change.kind === "added")) return true;
  const baseHardware = stringSet(asRecord(base.compatibility).hardware?.machineIds);
  const candidateHardware = stringSet(asRecord(candidate.compatibility).hardware?.machineIds);
  if ([...candidateHardware].some((id) => !baseHardware.has(id))) return true;
  const baseTargets = Object.keys(asRecord(valueAt(base, ["bundle", "targets"])));
  const candidateTargets = Object.keys(asRecord(valueAt(candidate, ["bundle", "targets"])));
  if (candidateTargets.some((target) => !baseTargets.includes(target))) return true;
  const baseKeys = Object.keys(asRecord(valueAt(base, ["bundle", "targets", "application", "configOverrides", "keys"])));
  const candidateKeys = Object.keys(asRecord(valueAt(candidate, ["bundle", "targets", "application", "configOverrides", "keys"])));
  return candidateKeys.some((key) => !baseKeys.includes(key));
};

export const analyzeBundleChange = ({ baseBundle = {}, candidateBundle = {}, baseFiles = {}, candidateFiles = {} } = {}) => {
  const baseVersion = asRecord(baseBundle).bundle?.meta?.version;
  const candidateVersion = asRecord(candidateBundle).bundle?.meta?.version;
  const comparison = compareSemver(candidateVersion, baseVersion);
  const changes = fileChanges(baseFiles, candidateFiles);
  const typed = detectTypedChanges(baseBundle, candidateBundle, baseFiles, candidateFiles);
  const breakingChanges = typed.breaking.items;
  const advisoryChanges = typed.advisory.items;
  const recommendedIncrement = comparison === null ? "unknown" : breakingChanges.length > 0 ? "major" : hasAdditiveChange(changes.items, baseBundle, candidateBundle) || advisoryChanges.some((entry) => /_added$|_widened$/.test(entry.code)) ? "minor" : "patch";
  return {
    version: {
      base: typeof baseVersion === "string" ? baseVersion : null,
      candidate: typeof candidateVersion === "string" ? candidateVersion : null,
      relation: comparison === null ? "invalid" : comparison > 0 ? "higher" : comparison < 0 ? "lower" : "equal",
      recommendedIncrement
    },
    fileChanges: changes.items,
    breakingChanges,
    advisoryChanges,
    truncation: {
      fileChanges: changes.truncated,
      breakingChanges: typed.breaking.truncated,
      advisoryChanges: typed.advisory.truncated
    },
    summary: {
      changedFileCount: changes.items.length,
      breakingChangeCount: breakingChanges.length,
      advisoryChangeCount: advisoryChanges.length,
      recommendedIncrement
    }
  };
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const option = (args, name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

if (process.argv[1] && new URL(`file://${process.argv[1]}`).pathname === new URL(import.meta.url).pathname) {
  const basePath = option(process.argv.slice(2), "--base");
  const candidatePath = option(process.argv.slice(2), "--candidate");
  if (!basePath || !candidatePath) throw new Error("usage: analyze-bundle-change --base <json> --candidate <json>");
  const baseInput = await readJson(basePath);
  const candidateInput = await readJson(candidatePath);
  const result = analyzeBundleChange({
    baseBundle: baseInput.bundle ?? baseInput,
    candidateBundle: candidateInput.bundle ?? candidateInput,
    baseFiles: baseInput.files ?? {},
    candidateFiles: candidateInput.files ?? {}
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
