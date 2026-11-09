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
var preset_exports = {};
__export(preset_exports, {
  DEFAULT_PRESET: () => DEFAULT_PRESET,
  PresetToggle: () => PresetToggle,
  TAP_GUARD_MS: () => TAP_GUARD_MS,
  isValidPreset: () => isValidPreset
});
module.exports = __toCommonJS(preset_exports);
var import_fan_timer = require("./fan-timer");
var import_signal = require("./signal");
const DEFAULT_PRESET = { level: 1, light: true, timer: 0 };
const TAP_GUARD_MS = 1e3;
function isValidPreset(preset) {
  return (0, import_signal.isValidLevel)(preset.level) && typeof preset.light === "boolean" && (preset.timer === 0 || (0, import_fan_timer.isValidMinutes)(preset.timer)) && (preset.level > 0 || preset.light);
}
class PresetToggle {
  /**
   * @param deps Environment
   */
  constructor(deps) {
    this.deps = deps;
  }
  lastTapAt = Number.NEGATIVE_INFINITY;
  /**
   * Handles one tap.
   *
   * @returns False if a signal was refused; an ignored tap counts as handled
   */
  async tap() {
    const now = this.deps.now();
    if (now - this.lastTapAt < TAP_GUARD_MS) {
      return true;
    }
    this.lastTapAt = now;
    const { level, light } = this.deps.target();
    if (level > 0 || light) {
      return this.deps.apply({ level: 0, light: false });
    }
    const preset = this.deps.preset();
    const accepted = await this.deps.apply({ level: preset.level, light: preset.light });
    if (accepted && preset.timer > 0 && preset.level > 0 && this.deps.target().level > 0) {
      this.deps.startTimer(preset.timer);
    }
    return accepted;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_PRESET,
  PresetToggle,
  TAP_GUARD_MS,
  isValidPreset
});
//# sourceMappingURL=preset.js.map
