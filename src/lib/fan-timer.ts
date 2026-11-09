/** Timer values shown to the user. */
export interface TimerSnapshot {
    /** Whether the timer is running */
    active: boolean;
    /** End time in milliseconds, 0 = no timer */
    endTime: number;
    /** Remaining minutes, rounded up */
    remainingMinutes: number;
    /** Full duration in minutes, 0 = no timer */
    totalMinutes: number;
}

/** Environment of the timer logic. */
export interface FanTimerDeps {
    /** Called whenever the shown values change */
    publish: (snapshot: TimerSnapshot) => void;
    /** Switches the fan off and reports whether the signal was accepted */
    expire: () => Promise<boolean>;
    /** Reports that the fan could not be switched off */
    onGiveUp: () => void;
    /** Runs a function after a delay */
    schedule: (callback: () => void, ms: number) => unknown;
    /** Cancels a scheduled function */
    cancel: (handle: unknown) => void;
    /** Current time in milliseconds */
    now: () => number;
}

const MINUTE_MS = 60_000;
const TICK_MS = 30_000;

/** First delay before a failed switch-off is repeated; it doubles with every attempt. */
export const RETRY_BASE_MS = 30_000;

/** Number of repetitions after a failed switch-off. */
export const MAX_RETRIES = 5;

/** Valid range of the timer duration. */
export const MIN_MINUTES = 1;
export const MAX_MINUTES = 240;

/**
 * Checks whether a value is a valid timer duration.
 *
 * @param minutes Value to check
 * @returns True for integers inside the valid range
 */
export function isValidMinutes(minutes: unknown): minutes is number {
    return typeof minutes === 'number' && Number.isInteger(minutes) && minutes >= MIN_MINUTES && minutes <= MAX_MINUTES;
}

/**
 * Switches the fan off after a set time. The end time is stored, so a restart can continue.
 */
export class FanTimer {
    private endTime = 0;
    private totalMinutes = 0;
    private expiryHandle: unknown;
    private tickHandle: unknown;
    private generation = 0;

    /**
     * @param deps Environment
     */
    public constructor(private readonly deps: FanTimerDeps) {}

    /**
     * Whether the timer is running.
     *
     * @returns True while an end time is set
     */
    public get active(): boolean {
        return this.endTime > 0;
    }

    /**
     * Starts the timer; a running timer is replaced.
     *
     * @param minutes Duration in minutes
     */
    public start(minutes: number): void {
        this.resume(this.deps.now() + minutes * MINUTE_MS, minutes);
    }

    /**
     * Continues with a stored end time. An end time in the past expires immediately.
     *
     * @param endTime End time in milliseconds
     * @param totalMinutes Full duration in minutes; never shown as less than the remaining time
     */
    public resume(endTime: number, totalMinutes: number): void {
        this.clearHandles();
        this.endTime = endTime;
        this.totalMinutes = Math.max(totalMinutes, this.remainingMinutes());
        this.publish();
        const generation = this.generation;
        this.expiryHandle = this.deps.schedule(
            () => void this.expire(generation, 0),
            Math.max(0, endTime - this.deps.now()),
        );
        this.scheduleTick();
    }

    /**
     * Ends the timer without touching the fan.
     */
    public stop(): void {
        if (!this.active) {
            return;
        }
        this.clearHandles();
        this.endTime = 0;
        this.totalMinutes = 0;
        this.publish();
    }

    /**
     * Cancels everything that is scheduled, but keeps the stored end time for the next start.
     */
    public dispose(): void {
        this.clearHandles();
    }

    private clearHandles(): void {
        this.generation++;
        for (const handle of [this.expiryHandle, this.tickHandle]) {
            if (handle !== undefined) {
                this.deps.cancel(handle);
            }
        }
        this.expiryHandle = undefined;
        this.tickHandle = undefined;
    }

    private scheduleTick(): void {
        this.tickHandle = this.deps.schedule(() => {
            this.tickHandle = undefined;
            if (this.active && this.endTime > this.deps.now()) {
                this.publish();
                this.scheduleTick();
            }
        }, TICK_MS);
    }

    private async expire(generation: number, attempt: number): Promise<void> {
        this.expiryHandle = undefined;
        let accepted = false;
        try {
            accepted = await this.deps.expire();
        } catch {
            accepted = false;
        }
        // stopped or replaced in the meantime
        if (generation !== this.generation) {
            return;
        }
        if (accepted) {
            this.stop();
        } else if (attempt < MAX_RETRIES) {
            this.publish();
            this.expiryHandle = this.deps.schedule(
                () => void this.expire(generation, attempt + 1),
                RETRY_BASE_MS * 2 ** attempt,
            );
        } else {
            this.deps.onGiveUp();
            this.stop();
        }
    }

    private remainingMinutes(): number {
        const remaining = this.endTime > 0 ? Math.max(0, this.endTime - this.deps.now()) : 0;
        return Math.ceil(remaining / MINUTE_MS);
    }

    private publish(): void {
        this.deps.publish({
            active: this.active,
            endTime: this.endTime,
            remainingMinutes: this.remainingMinutes(),
            totalMinutes: this.totalMinutes,
        });
    }
}
