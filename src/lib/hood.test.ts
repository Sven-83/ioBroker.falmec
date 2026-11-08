import { expect } from 'chai';
import { FakeClock, settle } from './fake-clock.test';
import { COALESCE_MS, Hood, type HoodState, MIN_GAP_MS } from './hood';

describe('Hood', () => {
    let clock: FakeClock;
    let sent: HoodState[];
    let committed: HoodState[];
    let accept: boolean;

    function createHood(initial: HoodState = { level: 0, light: false }): Hood {
        return new Hood(initial, {
            send: state => {
                sent.push(state);
                return Promise.resolve(accept);
            },
            onCommit: state => {
                committed.push(state);
                return Promise.resolve();
            },
            schedule: clock.schedule,
            cancel: clock.cancel,
            now: clock.now,
        });
    }

    beforeEach(() => {
        clock = new FakeClock();
        sent = [];
        committed = [];
        accept = true;
    });

    it('sends nothing at start', async () => {
        createHood({ level: 3, light: true });
        await clock.advance(10_000);
        expect(sent).to.deep.equal([]);
    });

    it('sends both values, keeping the one that was not changed', async () => {
        const hood = createHood({ level: 2, light: false });
        void hood.apply({ light: true });
        await clock.advance(COALESCE_MS);
        expect(sent).to.deep.equal([{ level: 2, light: true }]);
    });

    it('sends even if the value is unchanged, which corrects a deviation', async () => {
        const hood = createHood({ level: 2, light: true });
        void hood.apply({ light: true });
        await clock.advance(COALESCE_MS);
        expect(sent).to.have.length(1);
    });

    it('combines simultaneous commands into one signal', async () => {
        const hood = createHood();
        void hood.apply({ level: 3 });
        void hood.apply({ light: true });
        await clock.advance(COALESCE_MS);
        expect(sent).to.deep.equal([{ level: 3, light: true }]);
    });

    it('lets a newer command replace a waiting one', async () => {
        const hood = createHood();
        void hood.apply({ level: 1 });
        void hood.apply({ level: 4 });
        await clock.advance(COALESCE_MS);
        expect(sent).to.deep.equal([{ level: 4, light: false }]);
    });

    it('reports acceptance to all commands of a signal', async () => {
        const hood = createHood();
        const results = [hood.apply({ level: 1 }), hood.apply({ light: true })];
        await clock.advance(COALESCE_MS);
        expect(await Promise.all(results)).to.deep.equal([true, true]);
    });

    it('commits an accepted signal', async () => {
        const hood = createHood();
        void hood.apply({ level: 2 });
        await clock.advance(COALESCE_MS);
        expect(committed).to.deep.equal([{ level: 2, light: false }]);
    });

    it('keeps the state and reports false when the signal is refused', async () => {
        accept = false;
        const hood = createHood({ level: 1, light: true });
        const result = hood.apply({ level: 4 });
        await clock.advance(COALESCE_MS);
        expect(await result).to.equal(false);
        expect(committed).to.deep.equal([]);
        expect(hood.target).to.deep.equal({ level: 1, light: true });
    });

    it('treats an exception of the sender as refused', async () => {
        const hood = new Hood(
            { level: 0, light: false },
            {
                send: () => Promise.reject(new Error('boom')),
                onCommit: () => Promise.resolve(),
                schedule: clock.schedule,
                cancel: clock.cancel,
                now: clock.now,
            },
        );
        const result = hood.apply({ level: 1 });
        await clock.advance(COALESCE_MS);
        expect(await result).to.equal(false);
    });

    it('keeps the minimum gap between two signals', async () => {
        const hood = createHood();
        void hood.apply({ level: 1 });
        await clock.advance(COALESCE_MS);
        void hood.apply({ level: 2 });
        await clock.advance(MIN_GAP_MS - 1);
        expect(sent).to.have.length(1);
        await clock.advance(1);
        expect(sent).to.have.length(2);
    });

    it('shows waiting commands in target', () => {
        const hood = createHood({ level: 1, light: false });
        void hood.apply({ level: 3 });
        expect(hood.target).to.deep.equal({ level: 3, light: false });
    });

    it('sends a command that arrives while a signal is on its way', async () => {
        let release: (value: boolean) => void = () => undefined;
        const states: HoodState[] = [];
        const hood = new Hood(
            { level: 0, light: false },
            {
                send: state => {
                    states.push(state);
                    return states.length === 1 ? new Promise(resolve => (release = resolve)) : Promise.resolve(true);
                },
                onCommit: () => Promise.resolve(),
                schedule: clock.schedule,
                cancel: clock.cancel,
                now: clock.now,
            },
        );
        void hood.apply({ level: 1 });
        await clock.advance(COALESCE_MS);
        void hood.apply({ light: true });
        expect(hood.target).to.deep.equal({ level: 0, light: true });
        release(true);
        await settle();
        await clock.advance(MIN_GAP_MS);
        expect(states).to.deep.equal([
            { level: 1, light: false },
            { level: 1, light: true },
        ]);
    });

    it('reports false for waiting commands after dispose and sends nothing', async () => {
        const hood = createHood();
        const result = hood.apply({ level: 1 });
        hood.dispose();
        expect(await result).to.equal(false);
        expect(await hood.apply({ level: 2 })).to.equal(false);
        await clock.advance(10_000);
        expect(sent).to.deep.equal([]);
    });
});
