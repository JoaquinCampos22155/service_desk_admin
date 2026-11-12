import { createServer } from "node:http";
import { createApp } from "./app.mjs";
import { createCatalogRoutes } from "./catalog.mjs";
import { loadConfig } from "./config.mjs";
import { createLogger } from "./logger.mjs";
import { createSimulator } from "./simulation.mjs";

const config = loadConfig();
const logger = createLogger({ file: config.logFile, writeToStdout: config.logToStdout });
const simulator = createSimulator(config.simulation);
const server = createServer(createApp({ config, logger, routes: createCatalogRoutes({ simulator }) }));

server.listen(config.port, config.host, () => {
  const { clientErrorRate, serverErrorRate } = config.simulation;
  console.error(`[api] ${config.serviceName} escuchando en http://${config.host}:${config.port} · logs en ${config.logFile}`);
  console.error(`[api] errores simulados: ${Math.round(clientErrorRate * 100)}% 4xx, ${Math.round(serverErrorRate * 100)}% 5xx`);
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
