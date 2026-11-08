/** Manually driven clock for the logic tests. */
export class FakeClock {
    public time = 1_000_000;
    private nextId = 1;
    private readonly entries = new Map<number, { at: number; callback: () => void }>();

    public readonly now = (): number => this.time;

    public readonly schedule = (callback: () => void, ms: number): unknown => {
        const id = this.nextId++;
        this.entries.set(id, { at: this.time + ms, callback });
        return id;
    };

    public readonly cancel = (handle: unknown): void => {
        this.entries.delete(handle as number);
    };

    /**
     * Moves the time forward and runs everything that gets due.
     *
     * @param ms Time span in milliseconds
     */
    public async advance(ms: number): Promise<void> {
        const end = this.time + ms;
        await settle();
        for (;;) {
            const due = [...this.entries.entries()]
                .filter(([, entry]) => entry.at <= end)
                .sort((a, b) => a[1].at - b[1].at)[0];
            if (!due) {
                break;
            }
            this.entries.delete(due[0]);
            this.time = Math.max(this.time, due[1].at);
            due[1].callback();
            await settle();
        }
        this.time = end;
    }
}

/**
 * Lets all waiting promises finish.
 */
export async function settle(): Promise<void> {
    await new Promise(resolve => setImmediate(resolve));
}
