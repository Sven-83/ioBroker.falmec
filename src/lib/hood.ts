/** Complete state of the hood; every signal carries both values. */
export interface HoodState {
    /** Fan level, 0 = off */
    level: number;
    /** Light on or off */
    light: boolean;
}

/** Requested change; missing values keep the state they have. */
export type HoodChange = Partial<HoodState>;

/** Environment of the hood logic. */
export interface HoodDeps {
    /** Sends a signal and reports whether the BroadLink device accepted it */
    send: (state: HoodState) => Promise<boolean>;
    /** Called after a signal has been accepted */
    onCommit: (state: HoodState) => Promise<void>;
    /** Runs a function after a delay */
    schedule: (callback: () => void, ms: number) => unknown;
    /** Cancels a scheduled function */
    cancel: (handle: unknown) => void;
    /** Current time in milliseconds */
    now: () => number;
}

/** Waiting time that lets simultaneous commands end up in one signal. */
export const COALESCE_MS = 150;

/** Minimum distance between two signals. Short distances were not measured, so this is conservative. */
export const MIN_GAP_MS = 1000;

/**
 * Keeps the assumed state of the hood and turns commands into signals.
 */
export class Hood {
    private committed: HoodState;
    private pending: HoodChange | undefined;
    private waiters: Array<(accepted: boolean) => void> = [];
    private handle: unknown;
    private sending = false;
    private disposed = false;
    private lastSendAt = Number.NEGATIVE_INFINITY;

    /**
     * @param initial Assumed state at start; nothing is sent for it
     * @param deps Environment
     */
    public constructor(
        initial: HoodState,
        private readonly deps: HoodDeps,
    ) {
        this.committed = { ...initial };
    }

    /**
     * The state after all accepted and still waiting commands.
     *
     * @returns A copy of the state
     */
    public get target(): HoodState {
        return { ...this.committed, ...this.pending };
    }

    /**
     * Requests a change.
     *
     * @param change Values to change
     * @returns True once the BroadLink device has accepted a signal with this change
     */
    public apply(change: HoodChange): Promise<boolean> {
        if (this.disposed) {
            return Promise.resolve(false);
        }
        this.pending = { ...this.pending, ...change };
        const result = new Promise<boolean>(resolve => this.waiters.push(resolve));
        this.arm();
        return result;
    }

    /**
     * Stops all activity; commands that are still waiting report false.
     */
    public dispose(): void {
        this.disposed = true;
        if (this.handle !== undefined) {
            this.deps.cancel(this.handle);
            this.handle = undefined;
        }
        this.pending = undefined;
        this.settle(this.waiters.splice(0), false);
    }

    private arm(): void {
        if (this.handle !== undefined || this.sending || this.pending === undefined) {
            return;
        }
        const untilGapOver = this.lastSendAt + MIN_GAP_MS - this.deps.now();
        this.handle = this.deps.schedule(() => void this.flush(), Math.max(COALESCE_MS, untilGapOver));
    }

    private async flush(): Promise<void> {
        this.handle = undefined;
        if (this.disposed || this.pending === undefined) {
            return;
        }
        const target = this.target;
        const waiters = this.waiters.splice(0);
        this.pending = undefined;
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

        this.lastSendAt = this.deps.now();
        this.sending = false;
        this.settle(waiters, accepted);
        this.arm();
    }

    private settle(waiters: Array<(accepted: boolean) => void>, accepted: boolean): void {
        for (const resolve of waiters) {
            resolve(accepted);
        }
    }
}
