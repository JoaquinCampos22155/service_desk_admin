import { createServer } from "node:http";
import { createApp } from "./app.mjs";
import { createCatalogRoutes } from "./catalog.mjs";
import { ApiConfigError, loadConfig } from "./config.mjs";
import { createLogger } from "./logger.mjs";
import { createSimulator } from "./simulation.mjs";

function fail(message) {
  console.error(`[api] ${message}`);
  process.exit(1);
}

let config;
try {
  config = loadConfig();
} catch (error) {
  fail(error instanceof ApiConfigError ? `Configuración inválida: ${error.message}` : error.message);
}

const logFileError = (error) => fail(`No se pudo escribir el log en ${config.logFile}: ${error.code || error.message}. Revisa LOG_FILE y los permisos de la carpeta.`);
let logger;
try {
  logger = createLogger({ file: config.logFile, writeToStdout: config.logToStdout, onError: logFileError });
} catch (error) {
  logFileError(error);
}

const simulator = createSimulator(config.simulation);
const server = createServer(createApp({ config, logger, routes: createCatalogRoutes({ simulator }) }));

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") fail(`El puerto ${config.port} ya está en uso. Detén el otro proceso o usa otro puerto: PORT=4001 pnpm api`);
  if (error.code === "EACCES") fail(`Sin permiso para escuchar en ${config.host}:${config.port}. Usa un puerto mayor que 1024.`);
  fail(`El servidor falló: ${error.message}`);
});

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
