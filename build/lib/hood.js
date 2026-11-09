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
var hood_exports = {};
__export(hood_exports, {
  COALESCE_MS: () => COALESCE_MS,
  Hood: () => Hood,
  MIN_GAP_MS: () => MIN_GAP_MS
});
module.exports = __toCommonJS(hood_exports);
const COALESCE_MS = 150;
const MIN_GAP_MS = 1e3;
class Hood {
  /**
   * @param initial Assumed state at start; nothing is sent for it
   * @param deps Environment
   */
  constructor(initial, deps) {
    this.deps = deps;
    this.committed = { ...initial };
  }
  committed;
  pending;
  waiters = [];
  handle;
  sending = false;
  disposed = false;
  lastSendAt = Number.NEGATIVE_INFINITY;
  /**
   * The state after all accepted and still waiting commands.
   *
   * @returns A copy of the state
   */
  get target() {
    return { ...this.committed, ...this.pending };
  }
  /**
   * The state of the last accepted signal, without waiting commands.
   *
   * @returns A copy of the state
   */
  get confirmed() {
    return { ...this.committed };
  }
  /**
   * Requests a change.
   *
   * @param change Values to change
   * @returns True once the BroadLink device has accepted a signal with this change
   */
  apply(change) {
    if (this.disposed) {
      return Promise.resolve(false);
    }
    this.pending = { ...this.pending, ...change };
    const result = new Promise((resolve) => this.waiters.push(resolve));
    this.arm();
    return result;
  }
  /**
   * Stops all activity; commands that are still waiting report false.
   */
  dispose() {
    this.disposed = true;
    if (this.handle !== void 0) {
      this.deps.cancel(this.handle);
      this.handle = void 0;
    }
    this.pending = void 0;
    this.settle(this.waiters.splice(0), false);
  }
  arm() {
    if (this.handle !== void 0 || this.sending || this.pending === void 0) {
      return;
    }
    const untilGapOver = this.lastSendAt + MIN_GAP_MS - this.deps.now();
    this.handle = this.deps.schedule(() => void this.flush(), Math.max(COALESCE_MS, untilGapOver));
  }
  async flush() {
    this.handle = void 0;
    if (this.disposed || this.pending === void 0) {
      return;
    }
    const target = this.target;
    const waiters = this.waiters.splice(0);
    this.pending = void 0;
    this.sending = true;
    let accepted = false;
    try {
      accepted = await this.deps.send(target);
      if (accepted && !this.disposed) {
        this.committed = target;
        await this.deps.onCommit(target);
      }
    } catch {
      accepted = false;
    }
    if (!accepted && !this.disposed) {
      try {
        await this.deps.onRefused(this.confirmed);
      } catch {
      }
    }
    this.lastSendAt = this.deps.now();
    this.sending = false;
    this.settle(waiters, accepted);
    this.arm();
  }
  settle(waiters, accepted) {
    for (const resolve of waiters) {
      resolve(accepted);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  COALESCE_MS,
  Hood,
  MIN_GAP_MS
});
//# sourceMappingURL=hood.js.map
