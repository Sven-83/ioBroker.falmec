import { expect } from 'chai';
import { buildCode, encodeFrame, isSendSuccess, isValidLevel, MAX_LEVEL } from './signal';

// Placeholder only: the real fixed signal belongs to the instance configuration, never to the repository.
const BASE = '0101 0100 0000 1010';
const FIXED = BASE.replace(/\s/g, '');

/**
 * Independent decoder for the generated codes.
 *
 * @param hex Code as hexadecimal string
 * @returns Header values, frames and the pulse after the last frame
 */
function decode(hex: string): {
    type: number;
    length: number;
    size: number;
    carrierKhz: number;
    frames: string[];
    end: number;
} {
    const buffer = Buffer.from(hex, 'hex');
    const pulses: number[] = [];
    for (let i = 8; i < buffer.length; i++) {
        if (buffer[i] === 0) {
            pulses.push(buffer.readUInt16BE(i + 1));
            i += 2;
        } else {
            pulses.push(buffer[i]);
        }
    }
    const frames: string[] = [];
    let current: number[] = [];
    let end = 0;
    for (const pulse of pulses) {
        if (pulse < 400) {
            current.push(pulse);
            continue;
        }
        const data = current.slice(1);
        let bits = '';
        for (let i = 0; i < data.length; i += 2) {
            bits += data[i] < data[i + 1] ? '1' : '0';
        }
        frames.push(bits);
        current = [];
        end = pulse;
    }
    return {
        type: buffer[0],
        length: buffer.readUInt16LE(2),
        size: buffer.length - 4,
        carrierKhz: buffer.readUInt32LE(4),
        frames,
        end,
    };
}

describe('signal', () => {
    describe('isValidLevel', () => {
        for (let level = 0; level <= MAX_LEVEL; level++) {
            it(`accepts ${level}`, () => {
                expect(isValidLevel(level)).to.equal(true);
            });
        }
        for (const value of [-1, 5, 7, 2.5, Number.NaN, '2', null, undefined, true]) {
            it(`rejects ${String(value)}`, () => {
                expect(isValidLevel(value)).to.equal(false);
            });
        }
    });

    describe('encodeFrame', () => {
        const levelBits = ['000', '001', '010', '011', '100'];
        for (let level = 0; level <= MAX_LEVEL; level++) {
            for (const light of [false, true]) {
                it(`level ${level}, light ${light}: only the variable bits change`, () => {
                    const frame = encodeFrame(BASE, level, light);
                    expect(frame).to.have.length(16);
                    expect(frame.slice(6, 9)).to.equal(levelBits[level]);
                    expect(frame[9]).to.equal(light ? '1' : '0');
                    expect(frame.slice(0, 6)).to.equal(FIXED.slice(0, 6));
                    expect(frame.slice(10)).to.equal(FIXED.slice(10));
                });
            }
        }

        it('refuses levels the hood does not have', () => {
            expect(() => encodeFrame(BASE, 5, false)).to.throw(RangeError);
            expect(() => encodeFrame(BASE, 7, false)).to.throw(RangeError);
        });
    });

    describe('buildCode', () => {
        it('uses the RF type byte and a correct length', () => {
            const decoded = decode(buildCode(encodeFrame(BASE, 1, true)));
            expect(decoded.type).to.equal(0xb1);
            expect(decoded.length).to.equal(decoded.size);
        });

        it('starts with the carrier frequency, without which the hood does not react', () => {
            expect(decode(buildCode(encodeFrame(BASE, 1, true))).carrierKhz).to.equal(433800);
        });

        it('repeats the frame 10 times by default', () => {
            const frame = encodeFrame(BASE, 3, false);
            const decoded = decode(buildCode(frame));
            expect(decoded.frames).to.deep.equal(new Array(10).fill(frame));
        });

        it('honours the number of repeats', () => {
            const frame = encodeFrame(BASE, 2, true);
            expect(decode(buildCode(frame, 3)).frames).to.deep.equal([frame, frame, frame]);
        });

        it('ends with the long gap', () => {
            expect(decode(buildCode(encodeFrame(BASE, 0, false))).end).to.equal(1500);
        });
    });

    describe('isSendSuccess', () => {
        it('accepts the success text of broadlink2', () => {
            expect(isSendSuccess('RM:example sent CODE_abc, 0')).to.equal(true);
        });

        for (const value of [null, undefined, '', 'error', 0, {}]) {
            it(`rejects ${JSON.stringify(value)}`, () => {
                expect(isSendSuccess(value)).to.equal(false);
            });
        }
    });
});
