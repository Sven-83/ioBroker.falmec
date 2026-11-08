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
var signal_exports = {};
__export(signal_exports, {
  DEFAULT_REPEATS: () => DEFAULT_REPEATS,
  MAX_LEVEL: () => MAX_LEVEL,
  buildCode: () => buildCode,
  encodeFrame: () => encodeFrame,
  isSendSuccess: () => isSendSuccess,
  isValidLevel: () => isValidLevel
});
module.exports = __toCommonJS(signal_exports);
var import_config = require("./config");
const MAX_LEVEL = 4;
const DEFAULT_REPEATS = 10;
const LEVEL_BIT_START = 6;
const LEVEL_BIT_COUNT = 3;
const LIGHT_BIT = 9;
const SYNC_PULSE = 11;
const ONE_BIT = [10, 21];
const ZERO_BIT = [20, 11];
const FRAME_GAP = 453;
const END_GAP = 1500;
const CARRIER_KHZ = 433800;
function isValidLevel(level) {
  return typeof level === "number" && Number.isInteger(level) && level >= 0 && level <= MAX_LEVEL;
}
function encodeFrame(basePattern, level, light) {
  if (!isValidLevel(level)) {
    throw new RangeError(`Invalid fan level: ${String(level)}`);
  }
  const bits = (0, import_config.normalizePattern)(basePattern).split("");
  const levelBits = level.toString(2).padStart(LEVEL_BIT_COUNT, "0");
  for (let i = 0; i < LEVEL_BIT_COUNT; i++) {
    bits[LEVEL_BIT_START + i] = levelBits[i];
  }
  bits[LIGHT_BIT] = light ? "1" : "0";
  return bits.join("");
}
function buildCode(frame, repeats = DEFAULT_REPEATS) {
  const payload = [
    CARRIER_KHZ & 255,
    CARRIER_KHZ >> 8 & 255,
    CARRIER_KHZ >> 16 & 255,
    CARRIER_KHZ >> 24 & 255
  ];
  const push = (pulse) => {
    if (pulse > 255) {
      payload.push(0, pulse >> 8, pulse & 255);
    } else {
      payload.push(pulse);
    }
  };
  for (let repeat = 0; repeat < repeats; repeat++) {
    push(SYNC_PULSE);
    for (const bit of frame) {
      (bit === "1" ? ONE_BIT : ZERO_BIT).forEach(push);
    }
    push(repeat === repeats - 1 ? END_GAP : FRAME_GAP);
  }
  const header = [177, 192, payload.length & 255, payload.length >> 8];
  return Buffer.from([...header, ...payload]).toString("hex");
}
function isSendSuccess(result) {
  return typeof result === "string" && result.includes(" sent ");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_REPEATS,
  MAX_LEVEL,
  buildCode,
  encodeFrame,
  isSendSuccess,
  isValidLevel
});
//# sourceMappingURL=signal.js.map
