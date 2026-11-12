import { createServer } from "node:http";
import { createApp } from "./app.mjs";
import { loadConfig } from "./config.mjs";
import { createLogger } from "./logger.mjs";

const config = loadConfig();
const logger = createLogger({ file: config.logFile, writeToStdout: config.logToStdout });
const server = createServer(createApp({ config, logger }));

server.listen(config.port, config.host, () => {
  console.error(`[api] ${config.serviceName} escuchando en http://${config.host}:${config.port} · logs en ${config.logFile}`);
});

function shutdown(signal) {
  console.error(`[api] ${signal} recibido, cerrando…`);
  server.close(async () => {
    await logger.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
