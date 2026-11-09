import { expect } from 'chai';
import { type ConnectionConfig, normalizePattern, validateConfig } from './config';

// Placeholder only: the real fixed signal belongs to the instance configuration, never to the repository.
const validConfig: ConnectionConfig = {
    broadlinkInstance: 'broadlink2.0',
    deviceName: 'RM:example',
    basePattern: '0101 0100 0000 1010',
};

describe('config', () => {
    describe('normalizePattern', () => {
        it('removes whitespace', () => {
            expect(normalizePattern(' 0101 0100\t0000 1010 ')).to.equal('0101010000001010');
        });
    });

    describe('validateConfig', () => {
        it('accepts valid settings', () => {
            expect(validateConfig(validConfig)).to.deep.equal([]);
        });

        it('rejects a missing instance', () => {
            expect(validateConfig({ ...validConfig, broadlinkInstance: '' })).to.have.length(1);
        });

        it('rejects an instance of another adapter', () => {
            expect(validateConfig({ ...validConfig, broadlinkInstance: 'admin.0' })).to.have.length(1);
        });

        it('rejects a missing device name', () => {
            expect(validateConfig({ ...validConfig, deviceName: '' })).to.have.length(1);
        });

        it('rejects a device name without the RM: prefix', () => {
            expect(validateConfig({ ...validConfig, deviceName: 'example' })).to.have.length(1);
        });

        it('rejects a device name with a dot', () => {
            expect(validateConfig({ ...validConfig, deviceName: 'RM:example.dot' })).to.have.length(1);
        });

        it('rejects a pattern with the wrong length', () => {
            expect(validateConfig({ ...validConfig, basePattern: '0101' })).to.have.length(1);
        });

        it('rejects a pattern that is stored as a number instead of crashing', () => {
            expect(validateConfig({ ...validConfig, basePattern: 101 as unknown as string })).to.have.length(1);
        });

        it('rejects a pattern with other characters', () => {
            expect(validateConfig({ ...validConfig, basePattern: '0101 0100 0000 101x' })).to.have.length(1);
        });

        for (const position of [6, 7, 8, 9]) {
            it(`rejects a pattern with variable bit ${position} set`, () => {
                const bits = normalizePattern(validConfig.basePattern).split('');
                bits[position] = '1';
                expect(validateConfig({ ...validConfig, basePattern: bits.join('') })).to.have.length(1);
            });
        }

        it('reports all problems at once', () => {
            expect(validateConfig({ broadlinkInstance: '', deviceName: '', basePattern: '' })).to.have.length(3);
        });
    });
});
