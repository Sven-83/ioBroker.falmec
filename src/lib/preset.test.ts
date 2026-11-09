import { expect } from 'chai';
import type { HoodChange, HoodState } from './hood';
import { DEFAULT_PRESET, isValidPreset, type Preset, PresetToggle, TAP_GUARD_MS } from './preset';

describe('preset', () => {
    describe('isValidPreset', () => {
        const valid: Preset[] = [
            DEFAULT_PRESET,
            { level: 4, light: false, timer: 240 },
            { level: 0, light: true, timer: 0 },
            { level: 2, light: false, timer: 1 },
        ];
        for (const preset of valid) {
            it(`accepts ${JSON.stringify(preset)}`, () => {
                expect(isValidPreset(preset)).to.equal(true);
            });
        }

        const invalid: Array<Record<keyof Preset, unknown>> = [
            { level: 0, light: false, timer: 0 },
            { level: 0, light: false, timer: 15 },
            { level: 5, light: true, timer: 0 },
            { level: 1.5, light: true, timer: 0 },
            { level: '1', light: true, timer: 0 },
            { level: 1, light: 'on', timer: 0 },
            { level: 1, light: true, timer: 241 },
            { level: 1, light: true, timer: -1 },
            { level: 1, light: true, timer: null },
        ];
        for (const preset of invalid) {
            it(`rejects ${JSON.stringify(preset)}`, () => {
                expect(isValidPreset(preset)).to.equal(false);
            });
        }
    });

    describe('PresetToggle', () => {
        let state: HoodState;
        let preset: Preset;
        let applied: HoodChange[];
        let timers: number[];
        let accept: boolean;
        let time: number;
        let toggle: PresetToggle;

        beforeEach(() => {
            state = { level: 0, light: false };
            preset = { ...DEFAULT_PRESET };
            applied = [];
            timers = [];
            accept = true;
            time = 10_000;
            toggle = new PresetToggle({
                target: () => state,
                apply: change => {
                    applied.push(change);
                    if (accept) {
                        state = { ...state, ...change };
                    }
                    return Promise.resolve(accept);
                },
                startTimer: minutes => timers.push(minutes),
                preset: () => preset,
                now: () => time,
            });
        });

        it('starts the preset when everything is off', async () => {
            preset = { level: 3, light: false, timer: 0 };
            expect(await toggle.tap()).to.equal(true);
            expect(applied).to.deep.equal([{ level: 3, light: false }]);
            expect(timers).to.deep.equal([]);
        });

        it('starts the timer of the preset', async () => {
            preset = { level: 2, light: true, timer: 20 };
            await toggle.tap();
            expect(timers).to.deep.equal([20]);
        });

        it('does not start a timer when the preset leaves the fan off', async () => {
            preset = { level: 0, light: true, timer: 20 };
            await toggle.tap();
            expect(applied).to.deep.equal([{ level: 0, light: true }]);
            expect(timers).to.deep.equal([]);
        });

        it('does not start the timer when the signal is refused', async () => {
            preset = { level: 2, light: true, timer: 20 };
            accept = false;
            expect(await toggle.tap()).to.equal(false);
            expect(timers).to.deep.equal([]);
        });

        it('does not start the timer when the fan was switched off in the meantime', async () => {
            preset = { level: 2, light: true, timer: 20 };
            toggle = new PresetToggle({
                target: () => state,
                apply: () => {
                    state = { level: 0, light: false };
                    return Promise.resolve(true);
                },
                startTimer: minutes => timers.push(minutes),
                preset: () => preset,
                now: () => time,
            });
            await toggle.tap();
            expect(timers).to.deep.equal([]);
        });

        it('switches everything off when the fan runs', async () => {
            state = { level: 2, light: false };
            await toggle.tap();
            expect(applied).to.deep.equal([{ level: 0, light: false }]);
        });

        it('switches everything off when only the light is on', async () => {
            state = { level: 0, light: true };
            await toggle.tap();
            expect(applied).to.deep.equal([{ level: 0, light: false }]);
        });

        it('ignores a second tap within the guard time, but reports it as handled', async () => {
            await toggle.tap();
            time += TAP_GUARD_MS - 1;
            expect(await toggle.tap()).to.equal(true);
            expect(applied).to.have.length(1);
        });

        it('does not extend the guard time with an ignored tap', async () => {
            await toggle.tap();
            time += TAP_GUARD_MS - 1;
            await toggle.tap();
            time += 1;
            await toggle.tap();
            expect(applied).to.deep.equal([
                { level: 1, light: true },
                { level: 0, light: false },
            ]);
        });
    });
});
