#!/usr/bin/env node
// Regenerates logs/sample-api.log (Phase 3 deliverable): starts the real API in-process,
// drives it with the traffic generator and keeps the NDJSON lines the API wrote.
// Usage: pnpm logs:sample [-- --requests 200 --rps 20]
import { readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { parseArgs } from "node:util";
import { createApp } from "../api/app.mjs";
import { createCatalogRoutes } from "../api/catalog.mjs";
import { loadConfig } from "../api/config.mjs";
import { createLogger } from "../api/logger.mjs";
import { createSimulator } from "../api/simulation.mjs";
import { formatStats, readNumber, runTraffic } from "./traffic-generator.mjs";

let requests;
let requestsPerSecond;
let output;
try {
  const { values } = parseArgs({ options: { requests: { type: "string" }, rps: { type: "string" }, output: { type: "string" } } });
  requests = readNumber("requests", values.requests, 200);
  requestsPerSecond = readNumber("rps", values.rps, 20);
  output = values.output || "logs/sample-api.log";
  if (!Number.isInteger(requests) || requests < 50) throw new Error(`--requests debe ser un entero mayor o igual a 50: ${values.requests}`);
} catch (error) {
  console.error(`[sample] ${error.message}`);
  process.exit(1);
}

const config = loadConfig({ ...process.env, LOG_FILE: output, LOG_TO_STDOUT: "false" });
rmSync(output, { force: true });
const logger = createLogger({ file: config.logFile, writeToStdout: false });
const server = createServer(createApp({ config, logger, routes: createCatalogRoutes({ simulator: createSimulator(config.simulation) }) }));
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

console.log(`[sample] generando ${requests} peticiones a ~${requestsPerSecond} req/s contra la API real…`);
// A few health checks, as Heartbeat would make them, so the sample shows that endpoint too.
const healthChecks = setInterval(() => fetch(`${baseUrl}/api/health`).then((response) => response.arrayBuffer()).catch(() => {}), 2000);
const { stats, elapsedMs } = await runTraffic({ baseUrl, requestsPerSecond, maxRequests: requests });
clearInterval(healthChecks);
console.log(formatStats(stats, elapsedMs));

await new Promise((resolve) => server.close(resolve));
await logger.close();

const lines = readFileSync(output, "utf8").trim().split("\n").map((line) => JSON.parse(line));
const levels = lines.reduce((counts, line) => ({ ...counts, [line.log.level]: (counts[line.log.level] || 0) + 1 }), {});
console.log(`[sample] ${lines.length} registros escritos en ${output} · niveles ${JSON.stringify(levels)}`);
