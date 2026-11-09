"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var config_exports = {};
__export(config_exports, {
  normalizePattern: () => normalizePattern,
  validateConfig: () => validateConfig
});
module.exports = __toCommonJS(config_exports);
const VARIABLE_BIT_POSITIONS = [6, 7, 8, 9];
function normalizePattern(pattern) {
  return typeof pattern === "string" ? pattern.replace(/\s/g, "") : "";
}
function validateConfig(config) {
  const problems = [];
  if (!/^broadlink2\.\d+$/.test(config.broadlinkInstance)) {
    problems.push("broadlink2 instance is missing or invalid");
  }
  if (!/^RM:[^\s.]+$/.test(config.deviceName)) {
    problems.push('device name is missing, does not start with "RM:" or contains a dot or space');
  }
  const pattern = normalizePattern(config.basePattern);
  if (!/^[01]{16}$/.test(pattern)) {
    problems.push("base pattern must consist of exactly 16 bits");
  } else if (VARIABLE_BIT_POSITIONS.some((position) => pattern[position] !== "0")) {
    problems.push("level and light bits of the base pattern must be 0");
  }
  return problems;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  normalizePattern,
  validateConfig
});
//# sourceMappingURL=config.js.map
