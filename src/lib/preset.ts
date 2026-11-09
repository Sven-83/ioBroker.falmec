import { isValidMinutes } from './fan-timer';
import type { HoodChange, HoodState } from './hood';
import { isValidLevel } from './signal';

/** What a short tap starts when everything is off. */
export interface Preset extends HoodState {
    /** Timer duration in minutes, 0 = no timer; only used when the fan runs */
    timer: number;
}

/** Preset until the user chooses another one. */
export const DEFAULT_PRESET: Readonly<Preset> = { level: 1, light: true, timer: 0 };

/** A second tap within this time counts as an accidental double tap. */
export const TAP_GUARD_MS = 1000;

/**
 * Checks whether values form a valid preset. A preset that leaves everything off would do nothing.
 *
 * @param preset Values to check
 * @returns True if all values are valid and the preset switches something on
 */
export function isValidPreset(preset: Record<keyof Preset, unknown>): preset is Preset {
    return (
        isValidLevel(preset.level) &&
        typeof preset.light === 'boolean' &&
        (preset.timer === 0 || isValidMinutes(preset.timer)) &&
        (preset.level > 0 || preset.light)
    );
}

/** Environment of the toggle logic. */
export interface PresetToggleDeps {
    /** State after all accepted and still waiting commands */
    target: () => HoodState;
    /** Requests a change and reports whether the signal was accepted */
    apply: (change: HoodChange) => Promise<boolean>;
    /** Starts the fan timer */
    startTimer: (minutes: number) => void;
    /** Current preset */
    preset: () => Preset;
    /** Current time in milliseconds */
    now: () => number;
}

/**
 * The short tap: starts the preset if everything is off, otherwise switches everything off.
 */
export class PresetToggle {
    private lastTapAt = Number.NEGATIVE_INFINITY;

    /**
     * @param deps Environment
     */
    public constructor(private readonly deps: PresetToggleDeps) {}

    /**
     * Handles one tap.
     *
     * @returns False if a signal was refused; an ignored tap counts as handled
     */
    public async tap(): Promise<boolean> {
        const now = this.deps.now();
        if (now - this.lastTapAt < TAP_GUARD_MS) {
            return true;
        }
        this.lastTapAt = now;

        const { level, light } = this.deps.target();
        if (level > 0 || light) {
            // Committing level 0 also ends a running timer.
            return this.deps.apply({ level: 0, light: false });
        }

        const preset = this.deps.preset();
        const accepted = await this.deps.apply({ level: preset.level, light: preset.light });
        // The fan may have been switched off again while the signal was on its way.
        if (accepted && preset.timer > 0 && preset.level > 0 && this.deps.target().level > 0) {
            this.deps.startTimer(preset.timer);
        }
        return accepted;
    }
}
