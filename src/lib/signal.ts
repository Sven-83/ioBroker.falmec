import { normalizePattern } from './config';

/** Highest fan level of the hood. */
export const MAX_LEVEL = 4;

/** Repetitions of the frame per signal. */
export const DEFAULT_REPEATS = 10;

const LEVEL_BIT_START = 6;
const LEVEL_BIT_COUNT = 3;
const LIGHT_BIT = 9;

// Pulse lengths in BroadLink units (about 33 microseconds), taken from recordings of the original remote.
const SYNC_PULSE = 11;
const ONE_BIT = [10, 21];
const ZERO_BIT = [20, 11];
const FRAME_GAP = 453;
const END_GAP = 1500;

// The RM4 Pro expects the carrier frequency in kHz (32 bit, little endian) in front of the pulses.
const CARRIER_KHZ = 433800;

/**
 * Checks whether a value is a valid fan level.
 *
 * @param level Value to check
 * @returns True for the integers from 0 to MAX_LEVEL
 */
export function isValidLevel(level: unknown): level is number {
    return typeof level === 'number' && Number.isInteger(level) && level >= 0 && level <= MAX_LEVEL;
}

/**
 * Builds the 16-bit frame for a target state.
 *
 * @param basePattern Fixed signal of the hood with all level and light bits set to 0
 * @param level Fan level from 0 to MAX_LEVEL
 * @param light Target state of the light
 * @returns The frame as a string of 16 bits
 */
export function encodeFrame(basePattern: string, level: number, light: boolean): string {
    if (!isValidLevel(level)) {
        throw new RangeError(`Invalid fan level: ${String(level)}`);
    }
    const bits = normalizePattern(basePattern).split('');
    const levelBits = level.toString(2).padStart(LEVEL_BIT_COUNT, '0');
    for (let i = 0; i < LEVEL_BIT_COUNT; i++) {
        bits[LEVEL_BIT_START + i] = levelBits[i];
    }
    bits[LIGHT_BIT] = light ? '1' : '0';
    return bits.join('');
}

/**
 * Builds the hexadecimal BroadLink RF code for a frame.
 *
 * @param frame The frame as a string of bits
 * @param repeats Number of frame repetitions
 * @returns The code as a hexadecimal string, without the CODE_ prefix
 */
export function buildCode(frame: string, repeats: number = DEFAULT_REPEATS): string {
    const payload: number[] = [
        CARRIER_KHZ & 0xff,
        (CARRIER_KHZ >> 8) & 0xff,
        (CARRIER_KHZ >> 16) & 0xff,
        (CARRIER_KHZ >> 24) & 0xff,
    ];
    const push = (pulse: number): void => {
        if (pulse > 0xff) {
            payload.push(0, pulse >> 8, pulse & 0xff);
        } else {
            payload.push(pulse);
        }
    };

    for (let repeat = 0; repeat < repeats; repeat++) {
        push(SYNC_PULSE);
        for (const bit of frame) {
            (bit === '1' ? ONE_BIT : ZERO_BIT).forEach(push);
        }
        push(repeat === repeats - 1 ? END_GAP : FRAME_GAP);
    }

    const header = [0xb1, 0xc0, payload.length & 0xff, payload.length >> 8];
    return Buffer.from([...header, ...payload]).toString('hex');
}

/**
 * Interprets the answer of broadlink2 to send_code.
 *
 * @param result Answer of the message; broadlink2 only logs errors and then answers without a result
 * @returns True if the BroadLink device accepted the code; this does not prove that the hood reacted
 */
export function isSendSuccess(result: unknown): boolean {
    return typeof result === 'string' && result.includes(' sent ');
}
