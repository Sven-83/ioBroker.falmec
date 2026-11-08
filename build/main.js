"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_fan_timer = require("./lib/fan-timer");
var import_config = require("./lib/config");
var import_hood = require("./lib/hood");
var import_signal = require("./lib/signal");
const SEND_TIMEOUT_MS = 5e3;
const DEFAULT_MINUTES = 15;
class Falmec extends utils.Adapter {
  hood;
  timer;
  configValid = false;
  aliveId = "";
  reachableId = "";
  brokerAlive = false;
  deviceReachable = false;
  /**
   * @param options Options passed by the adapter runtime
   */
  constructor(options = {}) {
    super({
      ...options,
      name: "falmec"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    await this.setState("info.connection", false, true);
    const problems = (0, import_config.validateConfig)(this.config);
    for (const problem of problems) {
      this.log.warn(`Configuration: ${problem}`);
    }
    this.configValid = problems.length === 0;
    const schedule = (callback, ms) => this.setTimeout(callback, ms);
    const cancel = (handle) => this.clearTimeout(handle);
    const now = () => Date.now();
    this.hood = new import_hood.Hood(await this.readInitialState(), {
      send: (state) => this.sendSignal(state),
      onCommit: (state) => this.onCommit(state),
      schedule,
      cancel,
      now
    });
    this.timer = new import_fan_timer.FanTimer({
      publish: (snapshot) => void this.publishTimer(snapshot),
      expire: () => this.applyExpiry(),
      onGiveUp: () => this.log.warn("Timer expired, but the fan could not be switched off"),
      schedule,
      cancel,
      now
    });
    await this.subscribeStatesAsync("light.*");
    await this.subscribeStatesAsync("fan.*");
    await this.subscribeStatesAsync("timer.*");
    if (this.configValid) {
      await this.watchConnection();
    }
    const end = await this.getStateAsync("timer.end");
    if (typeof (end == null ? void 0 : end.val) === "number" && end.val > 0) {
      this.timer.resume(end.val);
    }
  }
  async readInitialState() {
    const level = await this.getStateAsync("fan.level");
    const light = await this.getStateAsync("light.on");
    const initial = {
      level: (level == null ? void 0 : level.ack) && (0, import_signal.isValidLevel)(level.val) ? level.val : 0,
      light: (light == null ? void 0 : light.ack) && typeof light.val === "boolean" ? light.val : false
    };
    await this.setState("fan.level", initial.level, true);
    await this.setState("light.on", initial.light, true);
    return initial;
  }
  async watchConnection() {
    this.aliveId = `system.adapter.${this.config.broadlinkInstance}.alive`;
    this.reachableId = `${this.config.broadlinkInstance}.${this.config.deviceName}._notReachable`;
    await this.subscribeForeignStatesAsync(this.aliveId);
    await this.subscribeForeignStatesAsync(this.reachableId);
    const alive = await this.getForeignStateAsync(this.aliveId);
    const notReachable = await this.getForeignStateAsync(this.reachableId);
    this.brokerAlive = (alive == null ? void 0 : alive.val) === true;
    this.deviceReachable = (notReachable == null ? void 0 : notReachable.val) === false;
    await this.publishConnection();
  }
  async publishConnection() {
    await this.setState("info.connection", this.brokerAlive && this.deviceReachable, true);
  }
  async sendSignal(state) {
    if (!this.configValid) {
      this.log.warn("Signal not sent: the configuration is incomplete");
      return false;
    }
    try {
      const frame = (0, import_signal.encodeFrame)((0, import_config.normalizePattern)(this.config.basePattern), state.level, state.light);
      const message = `${this.config.deviceName}.CODE_${(0, import_signal.buildCode)(frame)}`;
      const result = await this.sendToAsync(this.config.broadlinkInstance, "send_code", message, {
        timeout: SEND_TIMEOUT_MS
      });
      if ((0, import_signal.isSendSuccess)(result)) {
        return true;
      }
      this.log.warn(`Signal not accepted by ${this.config.broadlinkInstance}, see its log`);
    } catch (error) {
      this.log.warn(`Signal not sent: ${error.message}`);
    }
    return false;
  }
  async onCommit(state) {
    var _a;
    await this.setState("fan.level", state.level, true);
    await this.setState("light.on", state.light, true);
    if (state.level === 0) {
      (_a = this.timer) == null ? void 0 : _a.stop();
    }
  }
  applyExpiry() {
    var _a, _b;
    const change = { level: 0 };
    if (this.config.timerLightOff) {
      change.light = false;
    }
    return (_b = (_a = this.hood) == null ? void 0 : _a.apply(change)) != null ? _b : Promise.resolve(false);
  }
  async publishTimer(snapshot) {
    try {
      await this.setState("timer.active", snapshot.active, true);
      await this.setState("timer.end", snapshot.endTime, true);
      await this.setState("timer.remaining", snapshot.remainingMinutes, true);
    } catch (error) {
      this.log.warn(`Timer states not written: ${error.message}`);
    }
  }
  onStateChange(id, state) {
    if (!state) {
      return;
    }
    if (id === this.aliveId || id === this.reachableId) {
      if (id === this.aliveId) {
        this.brokerAlive = state.val === true;
      } else {
        this.deviceReachable = state.val === false;
      }
      void this.publishConnection().catch(
        (error) => this.log.warn(`Connection state not written: ${error.message}`)
      );
      return;
    }
    if (state.ack) {
      return;
    }
    this.handleCommand(id.slice(this.namespace.length + 1), state).catch(
      (error) => this.log.warn(`Command ${id} failed: ${error.message}`)
    );
  }
  async handleCommand(id, state) {
    const { hood, timer } = this;
    if (!hood || !timer) {
      return;
    }
    switch (id) {
      case "light.on":
        if (typeof state.val !== "boolean") {
          this.log.warn(`light.on needs true or false, got ${String(state.val)}`);
          return;
        }
        await hood.apply({ light: state.val });
        return;
      case "fan.level":
        if (!(0, import_signal.isValidLevel)(state.val)) {
          this.log.warn(`fan.level needs an integer from 0 to ${import_signal.MAX_LEVEL}, got ${String(state.val)}`);
          return;
        }
        await hood.apply({ level: state.val });
        return;
      case "light.toggle":
        await this.pressButton(id, state, { light: !hood.target.light });
        return;
      case "fan.up":
        await this.pressButton(id, state, this.levelStep(hood.target.level, 1));
        return;
      case "fan.down":
        await this.pressButton(id, state, this.levelStep(hood.target.level, -1));
        return;
      case "timer.minutes":
        if (!(0, import_fan_timer.isValidMinutes)(state.val)) {
          this.log.warn(
            `timer.minutes needs an integer from ${import_fan_timer.MIN_MINUTES} to ${import_fan_timer.MAX_MINUTES}, got ${String(state.val)}`
          );
          return;
        }
        await this.setState(id, state.val, true);
        return;
      case "timer.start":
        await this.startTimer(id, state);
        return;
      case "timer.stop":
        if (state.val) {
          timer.stop();
          await this.setState(id, true, true);
        }
        return;
      default:
        return;
    }
  }
  levelStep(level, step) {
    const next = level + step;
    return (0, import_signal.isValidLevel)(next) ? { level: next } : void 0;
  }
  async pressButton(id, state, change) {
    if (!state.val || !this.hood) {
      return;
    }
    if (!change || await this.hood.apply(change)) {
      await this.setState(id, true, true);
    }
  }
  async startTimer(id, state) {
    if (!state.val || !this.hood || !this.timer) {
      return;
    }
    if (this.hood.target.level === 0) {
      this.log.warn("Timer not started: the fan is off");
      return;
    }
    const minutes = await this.getStateAsync("timer.minutes");
    this.timer.start((0, import_fan_timer.isValidMinutes)(minutes == null ? void 0 : minutes.val) ? minutes.val : DEFAULT_MINUTES);
    await this.setState(id, true, true);
  }
  onUnload(callback) {
    var _a, _b;
    try {
      (_a = this.timer) == null ? void 0 : _a.dispose();
      (_b = this.hood) == null ? void 0 : _b.dispose();
      void this.setState("info.connection", false, true);
      callback();
    } catch (error) {
      this.log.error(`Error during unloading: ${error.message}`);
      callback();
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new Falmec(options);
} else {
  (() => new Falmec())();
}
//# sourceMappingURL=main.js.map
