// This file extends the AdapterConfig type from "@iobroker/types"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
    namespace ioBroker {
        interface AdapterConfig {
            /** broadlink2 instance that sends the signals, e.g. broadlink2.0 */
            broadlinkInstance: string;
            /** Device name inside the broadlink2 instance, starts with RM: */
            deviceName: string;
            /** Fixed 16-bit signal of the hood with all level and light bits set to 0 */
            basePattern: string;
            /** Also switch the light off when the timer expires */
            timerLightOff: boolean;
        }
    }
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
