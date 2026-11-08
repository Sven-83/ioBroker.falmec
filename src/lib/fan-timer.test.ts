import { expect } from 'chai';
import { FakeClock } from './fake-clock.test';
import { FanTimer, isValidMinutes, MAX_RETRIES, RETRY_BASE_MS, type TimerSnapshot } from './fan-timer';

const MINUTE = 60_000;

describe('FanTimer', () => {
    let clock: FakeClock;
    let snapshots: TimerSnapshot[];
    let expiries: number;
    let gaveUp: number;
    let accept: boolean;
    let timer: FanTimer;

    const last = (): TimerSnapshot => snapshots[snapshots.length - 1];

    beforeEach(() => {
        clock = new FakeClock();
        snapshots = [];
        expiries = 0;
        gaveUp = 0;
        accept = true;
        timer = new FanTimer({
            publish: snapshot => snapshots.push(snapshot),
            expire: () => {
                expiries++;
                return Promise.resolve(accept);
            },
            onGiveUp: () => gaveUp++,
            schedule: clock.schedule,
            cancel: clock.cancel,
            now: clock.now,
        });
    });

    describe('isValidMinutes', () => {
        for (const value of [1, 15, 240]) {
            it(`accepts ${value}`, () => {
                expect(isValidMinutes(value)).to.equal(true);
            });
        }
        for (const value of [0, -1, 241, 1.5, '5', null]) {
            it(`rejects ${String(value)}`, () => {
                expect(isValidMinutes(value)).to.equal(false);
            });
        }
    });

    it('stores the end time and shows the remaining minutes at start', () => {
        timer.start(10);
        expect(last()).to.deep.equal({ active: true, endTime: clock.time + 10 * MINUTE, remainingMinutes: 10 });
    });

    it('counts down', async () => {
        timer.start(10);
        await clock.advance(4 * MINUTE);
        expect(last().remainingMinutes).to.equal(6);
    });

    it('does not expire early', async () => {
        timer.start(10);
        await clock.advance(10 * MINUTE - 1);
        expect(expiries).to.equal(0);
    });

    it('expires on time and then ends', async () => {
        timer.start(10);
        await clock.advance(10 * MINUTE);
        expect(expiries).to.equal(1);
        expect(last()).to.deep.equal({ active: false, endTime: 0, remainingMinutes: 0 });
    });

    it('stop ends the timer without switching the fan', async () => {
        timer.start(10);
        timer.stop();
        await clock.advance(20 * MINUTE);
        expect(expiries).to.equal(0);
        expect(last().active).to.equal(false);
    });

    it('start replaces a running timer', async () => {
        timer.start(5);
        timer.start(10);
        await clock.advance(5 * MINUTE);
        expect(expiries).to.equal(0);
        await clock.advance(5 * MINUTE);
        expect(expiries).to.equal(1);
    });

    it('resume continues with the remaining time', async () => {
        timer.resume(clock.time + 3 * MINUTE);
        expect(last().remainingMinutes).to.equal(3);
        await clock.advance(3 * MINUTE);
        expect(expiries).to.equal(1);
    });

    it('resume with a past end time expires immediately', async () => {
        timer.resume(clock.time - MINUTE);
        await clock.advance(0);
        expect(expiries).to.equal(1);
        expect(last().active).to.equal(false);
    });

    it('repeats a failed switch-off with growing delays, then gives up', async () => {
        accept = false;
        timer.start(1);
        await clock.advance(MINUTE);
        expect(expiries).to.equal(1);
        expect(last().active).to.equal(true);

        await clock.advance(RETRY_BASE_MS - 1);
        expect(expiries).to.equal(1);
        await clock.advance(1);
        expect(expiries).to.equal(2);
        await clock.advance(RETRY_BASE_MS * 2);
        expect(expiries).to.equal(3);

        await clock.advance(RETRY_BASE_MS * 100);
        expect(expiries).to.equal(MAX_RETRIES + 1);
        expect(gaveUp).to.equal(1);
        expect(last().active).to.equal(false);
    });

    it('a retry succeeds and ends the timer', async () => {
        accept = false;
        timer.start(1);
        await clock.advance(MINUTE);
        accept = true;
        await clock.advance(RETRY_BASE_MS);
        expect(expiries).to.equal(2);
        expect(gaveUp).to.equal(0);
        expect(last().active).to.equal(false);
    });

    it('stop during the retries ends them', async () => {
        accept = false;
        timer.start(1);
        await clock.advance(MINUTE);
        timer.stop();
        await clock.advance(RETRY_BASE_MS * 100);
        expect(expiries).to.equal(1);
    });

    it('dispose cancels everything but keeps the stored end time', async () => {
        timer.start(1);
        const count = snapshots.length;
        timer.dispose();
        await clock.advance(10 * MINUTE);
        expect(expiries).to.equal(0);
        expect(snapshots).to.have.length(count);
    });
});
