/*
 * ioBroker.falmec
 * Controls a Falmec Vega ceiling hood through the broadlink2 adapter.
 */
import * as utils from '@iobroker/adapter-core';
import { FanTimer, isValidMinutes, MAX_MINUTES, MIN_MINUTES, type TimerSnapshot } from './lib/fan-timer';
import { normalizePattern, validateConfig } from './lib/config';
import { Hood, type HoodChange, type HoodState } from './lib/hood';
import { buildCode, encodeFrame, isSendSuccess, isValidLevel, MAX_LEVEL } from './lib/signal';

const SEND_TIMEOUT_MS = 5000;
const DEFAULT_MINUTES = 15;

class Falmec extends utils.Adapter {
    private hood: Hood | undefined;
    private timer: FanTimer | undefined;
    private configValid = false;
    private aliveId = '';
    private reachableId = '';
    private brokerAlive = false;
    private deviceReachable = false;
    private timerMinutes = DEFAULT_MINUTES;

    /**
     * @param options Options passed by the adapter runtime
     */
    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'falmec',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private async onReady(): Promise<void> {
        await this.setState('info.connection', false, true);

        const problems = validateConfig(this.config);
        for (const problem of problems) {
            this.log.warn(`Configuration: ${problem}`);
        }
        this.configValid = problems.length === 0;

        const schedule = (callback: () => void, ms: number): unknown => this.setTimeout(callback, ms);
        const cancel = (handle: unknown): void => this.clearTimeout(handle as ioBroker.Timeout);
        const now = (): number => Date.now();

        this.hood = new Hood(await this.readInitialState(), {
            send: state => this.sendSignal(state),
            onCommit: state => this.onCommit(state),
            onRefused: state => this.publishHoodState(state),
            schedule,
            cancel,
            now,
        });
        this.timer = new FanTimer({
            publish: snapshot => void this.publishTimer(snapshot),
            expire: () => this.applyExpiry(),
            onGiveUp: () => this.log.warn('Timer expired, but the fan could not be switched off'),
            schedule,
            cancel,
            now,
        });
        await this.readTimerMinutes();

        await this.subscribeStatesAsync('light.*');
        await this.subscribeStatesAsync('fan.*');
        await this.subscribeStatesAsync('timer.*');
        if (this.configValid) {
            await this.watchConnection();
        }

        // A timer that ended during a restart expires right away; nothing else is sent at start.
        const end = await this.getStateAsync('timer.end');
        if (typeof end?.val === 'number' && end.val > 0) {
            this.timer.resume(end.val);
        }
    }

    private async readInitialState(): Promise<HoodState> {
        const level = await this.getStateAsync('fan.level');
        const light = await this.getStateAsync('light.on');
        const initial: HoodState = {
            level: level?.ack && isValidLevel(level.val) ? level.val : 0,
            light: light?.ack && typeof light.val === 'boolean' ? light.val : false,
        };
        await this.publishHoodState(initial);
        return initial;
    }

    private async readTimerMinutes(): Promise<void> {
        const minutes = await this.getStateAsync('timer.minutes');
        if (isValidMinutes(minutes?.val)) {
            this.timerMinutes = minutes.val;
        }
        await this.setState('timer.minutes', this.timerMinutes, true);
    }

    private async publishHoodState(state: HoodState): Promise<void> {
        await this.setState('fan.level', state.level, true);
        await this.setState('light.on', state.light, true);
    }

    private async watchConnection(): Promise<void> {
        this.aliveId = `system.adapter.${this.config.broadlinkInstance}.alive`;
        this.reachableId = `${this.config.broadlinkInstance}.${this.config.deviceName}._notReachable`;
        await this.subscribeForeignStatesAsync(this.aliveId);
        await this.subscribeForeignStatesAsync(this.reachableId);

        const alive = await this.getForeignStateAsync(this.aliveId);
        const notReachable = await this.getForeignStateAsync(this.reachableId);
        this.brokerAlive = alive?.val === true;
        this.deviceReachable = notReachable?.val === false;
        await this.publishConnection();
    }

    private async publishConnection(): Promise<void> {
        await this.setState('info.connection', this.brokerAlive && this.deviceReachable, true);
    }

    private async sendSignal(state: HoodState): Promise<boolean> {
        if (!this.configValid) {
            this.log.warn('Signal not sent: the configuration is incomplete');
            return false;
        }
        try {
            const frame = encodeFrame(normalizePattern(this.config.basePattern), state.level, state.light);
            const message = `${this.config.deviceName}.CODE_${buildCode(frame)}`;
            const result: unknown = await this.sendToAsync(this.config.broadlinkInstance, 'send_code', message, {
                timeout: SEND_TIMEOUT_MS,
            });
            if (isSendSuccess(result)) {
                return true;
            }
            this.log.warn(`Signal not accepted by ${this.config.broadlinkInstance}, see its log`);
        } catch (error) {
            this.log.warn(`Signal not sent: ${(error as Error).message}`);
        }
        return false;
    }

    private async onCommit(state: HoodState): Promise<void> {
        await this.publishHoodState(state);
        if (state.level === 0) {
            this.timer?.stop();
        }
    }

    private applyExpiry(): Promise<boolean> {
        const change: HoodChange = { level: 0 };
        if (this.config.timerLightOff) {
            change.light = false;
        }
        return this.hood?.apply(change) ?? Promise.resolve(false);
    }

    private async publishTimer(snapshot: TimerSnapshot): Promise<void> {
        try {
            await this.setState('timer.active', snapshot.active, true);
            await this.setState('timer.end', snapshot.endTime, true);
            await this.setState('timer.remaining', snapshot.remainingMinutes, true);
        } catch (error) {
            this.log.warn(`Timer states not written: ${(error as Error).message}`);
        }
    }

    private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
        if (!state) {
            return;
        }
        if (id === this.aliveId || id === this.reachableId) {
            if (id === this.aliveId) {
                this.brokerAlive = state.val === true;
            } else {
                this.deviceReachable = state.val === false;
            }
            void this.publishConnection().catch(error =>
                this.log.warn(`Connection state not written: ${(error as Error).message}`),
            );
            return;
        }
        if (state.ack) {
            return;
        }
        this.handleCommand(id.slice(this.namespace.length + 1), state).catch(error =>
            this.log.warn(`Command ${id} failed: ${(error as Error).message}`),
        );
    }

    private async handleCommand(id: string, state: ioBroker.State): Promise<void> {
        const { hood, timer } = this;
        if (!hood || !timer) {
            return;
        }
        switch (id) {
            case 'light.on':
                if (typeof state.val !== 'boolean') {
                    this.log.warn(`light.on needs true or false, got ${String(state.val)}`);
                    await this.setState(id, hood.confirmed.light, true);
                    return;
                }
                await hood.apply({ light: state.val });
                return;
            case 'fan.level':
                if (!isValidLevel(state.val)) {
                    this.log.warn(`fan.level needs an integer from 0 to ${MAX_LEVEL}, got ${String(state.val)}`);
                    await this.setState(id, hood.confirmed.level, true);
                    return;
                }
                await hood.apply({ level: state.val });
                return;
            case 'light.toggle':
                await this.pressButton(id, state, { light: !hood.target.light });
                return;
            case 'fan.up':
                await this.pressButton(id, state, this.levelStep(hood.target.level, 1));
                return;
            case 'fan.down':
                await this.pressButton(id, state, this.levelStep(hood.target.level, -1));
                return;
            case 'timer.minutes':
                if (!isValidMinutes(state.val)) {
                    this.log.warn(
                        `timer.minutes needs an integer from ${MIN_MINUTES} to ${MAX_MINUTES}, got ${String(state.val)}`,
                    );
                    await this.setState(id, this.timerMinutes, true);
                    return;
                }
                this.timerMinutes = state.val;
                await this.setState(id, state.val, true);
                return;
            case 'timer.start':
                await this.startTimer(id, state);
                return;
            case 'timer.stop':
                if (state.val) {
                    timer.stop();
                    await this.setState(id, true, true);
                }
                return;
            default:
                return;
        }
    }

    private levelStep(level: number, step: number): HoodChange | undefined {
        const next = level + step;
        return isValidLevel(next) ? { level: next } : undefined;
    }

    private async pressButton(id: string, state: ioBroker.State, change: HoodChange | undefined): Promise<void> {
        if (!state.val || !this.hood) {
            return;
        }
        // At the limit there is nothing to send and nothing to change.
        if (!change || (await this.hood.apply(change))) {
            await this.setState(id, true, true);
        }
    }

    private async startTimer(id: string, state: ioBroker.State): Promise<void> {
        if (!state.val || !this.hood || !this.timer) {
            return;
        }
        if (this.hood.target.level === 0) {
            this.log.warn('Timer not started: the fan is off');
            return;
        }
        this.timer.start(this.timerMinutes);
        await this.setState(id, true, true);
    }

    private onUnload(callback: () => void): void {
        try {
            this.timer?.dispose();
            this.hood?.dispose();
            void this.setState('info.connection', false, true);
            callback();
        } catch (error) {
            this.log.error(`Error during unloading: ${(error as Error).message}`);
            callback();
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Falmec(options);
} else {
    // otherwise start the instance directly
    (() => new Falmec())();
}
