import { startServer, stopAudits } from "./index.js";
const server = startServer(4001).once("listening", () => {
  console.log("Lighthouse API listening at http://127.0.0.1:4001");
});
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close();
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  try {
    await stopAudits();
    server.closeAllConnections();
    clearTimeout(deadline);
    process.exit(0);
  } catch {
    process.exit(1);
  }
}
process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});
