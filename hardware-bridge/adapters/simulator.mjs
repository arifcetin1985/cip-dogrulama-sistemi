export function createSimulator({ onScan }) {
  let sequence = 1000;
  return {
    async start() {},
    async stop() {},
    status() { return { connected: true, protocol: "simulator" }; },
    next() {
      sequence += 1;
      const chipId = `E280-11A0-${String(sequence).padStart(8, "0")}`;
      onScan(chipId);
      return chipId;
    },
  };
}
