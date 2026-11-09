const assert = require('node:assert/strict');
const path = require('path');
const { tests } = require('@iobroker/testing');

const POLL_MS = 500;
const POLLS = 40;
const POLLS_PER_COMMAND = 4;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sends a command until the adapter has reacted, because it subscribes only after it has started.
 * The test configuration is empty, so every signal is refused.
 *
 * @param {object} harness Test harness of the suite
 * @param {string} id State without namespace
 * @param {unknown} command Value to write
 * @param {unknown} expected Value the state has to show afterwards
 * @param {RegExp} [warning] Warning the adapter has to log
 */
async function expectDiscarded(harness, id, command, expected, warning) {
    const fullId = `falmec.0.${id}`;
    let state;
    for (let poll = 0; poll < POLLS; poll++) {
        if (poll % POLLS_PER_COMMAND === 0) {
            await harness.states.setStateAsync(fullId, { val: command, ack: false });
        }
        await sleep(POLL_MS);
        state = await harness.states.getStateAsync(fullId);
        if (state?.ack === true && state.val === expected && (!warning || harness.hasLog(warning, 'warn'))) {
            return;
        }
    }
    assert.fail(`${id} was not restored to ${String(expected)}, last state: ${JSON.stringify(state)}`);
}

// Run integration tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Discarded commands', getHarness => {
            let harness;

            before(async function () {
                this.timeout(60_000);
                harness = getHarness();
                await harness.startAdapterAndWait();
            });

            it('restores fan.level after an invalid value', async function () {
                this.timeout(30_000);
                await expectDiscarded(harness, 'fan.level', 7, 0, /fan\.level needs an integer/);
            });

            it('restores light.on after an invalid value', async function () {
                this.timeout(30_000);
                await expectDiscarded(harness, 'light.on', 'on', false, /light\.on needs true or false/);
            });

            it('restores timer.minutes after an invalid value', async function () {
                this.timeout(30_000);
                await expectDiscarded(harness, 'timer.minutes', 9999, 15, /timer\.minutes needs an integer/);
            });

            it('restores fan.level after a refused signal', async function () {
                this.timeout(30_000);
                await expectDiscarded(harness, 'fan.level', 2, 0, /Signal not sent: the configuration is incomplete/);
            });

            it('restores the preset after invalid values', async function () {
                this.timeout(60_000);
                const warning = value => new RegExp(`cannot be ${value}:`);
                await expectDiscarded(harness, 'preset.level', 9, 1, warning('9'));
                await expectDiscarded(harness, 'preset.light', 'on', true, warning('on'));
                await expectDiscarded(harness, 'preset.timer', 999, 0, warning('999'));
            });

            it('refuses a preset that would leave everything off', async function () {
                this.timeout(30_000);
                await expectDiscarded(harness, 'preset.level', 0, 0);
                await expectDiscarded(harness, 'preset.light', false, true, /preset\.light cannot be false/);
            });

            it('keeps the hood state and leaves the button unconfirmed when the preset signal is refused', async function () {
                this.timeout(30_000);
                const before = await harness.states.getStateAsync('falmec.0.light.on');
                await harness.states.setStateAsync('falmec.0.preset.toggle', { val: true, ack: false });

                // A refused signal publishes the kept state again, which proves the tap was handled.
                let light = before;
                for (let poll = 0; poll < POLLS && light.ts === before.ts; poll++) {
                    await sleep(POLL_MS);
                    light = await harness.states.getStateAsync('falmec.0.light.on');
                }
                assert.notEqual(light.ts, before.ts, 'the tap was not handled');
                assert.equal(light.val, false);
                assert.equal(light.ack, true);

                const level = await harness.states.getStateAsync('falmec.0.fan.level');
                const button = await harness.states.getStateAsync('falmec.0.preset.toggle');
                assert.equal(level.val, 0);
                assert.equal(button.ack, false);
            });
        });
    },
});
