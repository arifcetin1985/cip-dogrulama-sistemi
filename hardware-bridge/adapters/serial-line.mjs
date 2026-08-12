export function createSerialLineReader({ path, baudRate, onScan }) {
  let serialPort;
  if (!path) throw new Error("READER_PORT zorunludur. Örnek: COM4 veya /dev/ttyUSB0");
  return {
    async start() {
      const [{ SerialPort }, { ReadlineParser }] = await Promise.all([
        import("serialport"), import("@serialport/parser-readline"),
      ]);
      serialPort = new SerialPort({ path, baudRate });
      const parser = serialPort.pipe(new ReadlineParser({ delimiter: "\n" }));
      parser.on("data", (line) => {
        const candidate = String(line).trim();
        if (candidate) onScan(candidate);
      });
      await new Promise((resolve, reject) => {
        serialPort.once("open", resolve);
        serialPort.once("error", reject);
      });
    },
    async stop() {
      if (serialPort?.isOpen) await new Promise((resolve) => serialPort.close(resolve));
    },
    status() { return { connected: Boolean(serialPort?.isOpen), protocol: "serial-line", path, baudRate }; },
  };
}
