/** Instance settings that are needed to send signals to the hood. */
export interface ConnectionConfig {
    /** broadlink2 instance, e.g. broadlink2.0 */
    broadlinkInstance: string;
    /** Device name inside the broadlink2 instance */
    deviceName: string;
    /** Fixed 16-bit signal of the hood */
    basePattern: string;
}

/** Positions of the three level bits and the light bit inside the 16-bit signal. */
const VARIABLE_BIT_POSITIONS = [6, 7, 8, 9];

/**
 * Normalises a configured bit pattern by removing whitespace.
 *
 * @param pattern Pattern as entered in the configuration
 * @returns The pattern without whitespace; empty if it is not a string
 */
export function normalizePattern(pattern: unknown): string {
    return typeof pattern === 'string' ? pattern.replace(/\s/g, '') : '';
}

/**
 * Checks the instance settings and describes every problem found.
 *
 * @param config Settings from the instance configuration
 * @returns One message per problem; empty when the settings are usable
 */
export function validateConfig(config: ConnectionConfig): string[] {
    const problems: string[] = [];

    if (!/^broadlink2\.\d+$/.test(config.broadlinkInstance)) {
        problems.push('broadlink2 instance is missing or invalid');
    }
    // broadlink2 splits the send_code message at the dot, so the name must not contain one
    if (!/^RM:[^\s.]+$/.test(config.deviceName)) {
        problems.push('device name is missing, does not start with "RM:" or contains a dot or space');
    }

    const pattern = normalizePattern(config.basePattern);
    if (!/^[01]{16}$/.test(pattern)) {
        problems.push('base pattern must consist of exactly 16 bits');
    } else if (VARIABLE_BIT_POSITIONS.some(position => pattern[position] !== '0')) {
        problems.push('level and light bits of the base pattern must be 0');
    }

    return problems;
}
