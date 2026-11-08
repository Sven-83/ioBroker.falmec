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
var fan_timer_exports = {};
__export(fan_timer_exports, {
  FanTimer: () => FanTimer,
  MAX_MINUTES: () => MAX_MINUTES,
  MAX_RETRIES: () => MAX_RETRIES,
  MIN_MINUTES: () => MIN_MINUTES,
  RETRY_BASE_MS: () => RETRY_BASE_MS,
  isValidMinutes: () => isValidMinutes
});
module.exports = __toCommonJS(fan_timer_exports);
const MINUTE_MS = 6e4;
const TICK_MS = 3e4;
const RETRY_BASE_MS = 3e4;
const MAX_RETRIES = 5;
const MIN_MINUTES = 1;
const MAX_MINUTES = 240;
function isValidMinutes(minutes) {
  return typeof minutes === "number" && Number.isInteger(minutes) && minutes >= MIN_MINUTES && minutes <= MAX_MINUTES;
}
class FanTimer {
  /**
   * @param deps Environment
   */
  constructor(deps) {
    this.deps = deps;
  }
  endTime = 0;
  expiryHandle;
  tickHandle;
  generation = 0;
  /**
   * Whether the timer is running.
   *
   * @returns True while an end time is set
   */
  get active() {
    return this.endTime > 0;
  }
  /**
   * Starts the timer; a running timer is replaced.
   *
   * @param minutes Duration in minutes
   */
  start(minutes) {
    this.resume(this.deps.now() + minutes * MINUTE_MS);
  }
  /**
   * Continues with a stored end time. An end time in the past expires immediately.
   *
   * @param endTime End time in milliseconds
   */
  resume(endTime) {
    this.clearHandles();
    this.endTime = endTime;
    this.publish();
    const generation = this.generation;
    this.expiryHandle = this.deps.schedule(
      () => void this.expire(generation, 0),
      Math.max(0, endTime - this.deps.now())
    );
    this.scheduleTick();
  }
  /**
   * Ends the timer without touching the fan.
   */
  stop() {
    if (!this.active) {
      return;
    }
    this.clearHandles();
    this.endTime = 0;
    this.publish();
  }
  /**
   * Cancels everything that is scheduled, but keeps the stored end time for the next start.
   */
  dispose() {
    this.clearHandles();
  }
  clearHandles() {
    this.generation++;
    for (const handle of [this.expiryHandle, this.tickHandle]) {
      if (handle !== void 0) {
        this.deps.cancel(handle);
      }
    }
    this.expiryHandle = void 0;
    this.tickHandle = void 0;
  }
  scheduleTick() {
    this.tickHandle = this.deps.schedule(() => {
      this.tickHandle = void 0;
      if (this.active && this.endTime > this.deps.now()) {
        this.publish();
        this.scheduleTick();
      }
    }, TICK_MS);
  }
  async expire(generation, attempt) {
    this.expiryHandle = void 0;
    let accepted = false;
    try {
      accepted = await this.deps.expire();
    } catch {
      accepted = false;
    }
    if (generation !== this.generation) {
      return;
    }
    if (accepted) {
      this.stop();
    } else if (attempt < MAX_RETRIES) {
      this.publish();
      this.expiryHandle = this.deps.schedule(
        () => void this.expire(generation, attempt + 1),
        RETRY_BASE_MS * 2 ** attempt
      );
    } else {
      this.deps.onGiveUp();
      this.stop();
    }
  }
  publish() {
    const remaining = this.endTime > 0 ? Math.max(0, this.endTime - this.deps.now()) : 0;
    this.deps.publish({
      active: this.active,
      endTime: this.endTime,
      remainingMinutes: Math.ceil(remaining / MINUTE_MS)
    });
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FanTimer,
  MAX_MINUTES,
  MAX_RETRIES,
  MIN_MINUTES,
  RETRY_BASE_MS,
  isValidMinutes
});
//# sourceMappingURL=fan-timer.js.map
