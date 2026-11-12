#!/usr/bin/env node
// Continuous traffic generator for the simulated Bevstack e-commerce API (Phase 3).
// Usage: pnpm traffic [-- --url http://127.0.0.1:4000 --rps 5 --duration 0 --max 0]
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as wait } from "node:timers/promises";

const SKUS = ["SKU-501", "SKU-502", "SKU-618", "SKU-733", "SKU-840", "SKU-912"];
const STORES = ["STORE-10001", "STORE-10002", "STORE-10003", "STORE-10004"];
const BRANDS = ["Nébula Spirits", "Casa Nómada", "Altura Gin", "Fuego Norte"];
const ZONES = ["1", "4", "10", "12", "15", "16"];

function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

// Weights shape a realistic mix: catalog reads dominate, configuration changes are rare.
export const TRAFFIC_MIX = [
  { id: "incorrect-inventory", weight: 25, build: (r) => ({ method: "GET", path: `/api/inventory/${pick(r, SKUS)}` }) },
  { id: "shipping-unavailable", weight: 20, build: (r) => ({ method: "GET", path: `/api/shipping/options?zone=${pick(r, ZONES)}` }) },
  { id: "unprocessed-order", weight: 15, build: (r) => ({ method: "POST", path: "/api/orders", body: { brand: pick(r, BRANDS), items: [{ sku: pick(r, SKUS), qty: 1 + Math.floor(r() * 3) }] } }) },
  { id: "payment-without-order", weight: 12, build: (r) => ({ method: "POST", path: "/api/payments", body: { orderId: `ORD-${78000 + Math.floor(r() * 1000)}`, amount: Math.round(20 + r() * 180) } }) },
  { id: "product-config", weight: 10, build: (r) => ({ method: "PATCH", path: `/api/products/${pick(r, SKUS)}`, body: { price: Math.round(15 + r() * 60) } }) },
  { id: "shipping-rules", weight: 6, build: (r) => ({ method: "PUT", path: `/api/stores/${pick(r, STORES)}/shipping-rules`, body: { zones: [pick(r, ZONES), pick(r, ZONES)] } }) },
  { id: "operational-config", weight: 5, build: (r) => ({ method: "PUT", path: `/api/stores/${pick(r, STORES)}/operational-config`, body: { orderCutoff: pick(r, ["14:00", "15:00", "16:00"]) } }) },
  { id: "new-store", weight: 4, build: (r) => ({ method: "POST", path: "/api/stores", body: { brand: pick(r, BRANDS), domain: `tienda-${Math.floor(r() * 1000)}.example` } }) },
];

const TOTAL_WEIGHT = TRAFFIC_MIX.reduce((sum, item) => sum + item.weight, 0);

export function buildRequest(random = Math.random) {
  let roll = random() * TOTAL_WEIGHT;
  for (const item of TRAFFIC_MIX) {
    roll -= item.weight;
    if (roll < 0) return { id: item.id, ...item.build(random) };
  }
  const last = TRAFFIC_MIX.at(-1);
  return { id: last.id, ...last.build(random) };
}

function emptyStats() {
  return { sent: 0, completed: 0, networkErrors: 0, byStatusClass: { "2xx": 0, "4xx": 0, "5xx": 0, other: 0 }, byStatus: {} };
}

function recordStatus(stats, status) {
  stats.completed += 1;
  stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
  const statusClass = status >= 200 && status < 300 ? "2xx" : status >= 400 && status < 500 ? "4xx" : status >= 500 ? "5xx" : "other";
  stats.byStatusClass[statusClass] += 1;
}

export function formatStats(stats, elapsedMs) {
  const seconds = Math.max(elapsedMs / 1000, 0.001);
  const { "2xx": ok, "4xx": client, "5xx": server } = stats.byStatusClass;
  const total = Math.max(stats.completed, 1);
  const percent = (value) => `${((value / total) * 100).toFixed(1)}%`;
  return `[traffic] ${stats.completed}/${stats.sent} respuestas en ${seconds.toFixed(0)} s (${(stats.completed / seconds).toFixed(1)} req/s) · 2xx ${ok} (${percent(ok)}) · 4xx ${client} (${percent(client)}) · 5xx ${server} (${percent(server)}) · sin respuesta ${stats.networkErrors}`;
}

export async function runTraffic({
  baseUrl = "http://127.0.0.1:4000",
  requestsPerSecond = 5,
  durationSeconds = 0,
  maxRequests = 0,
  maxInFlight = 20,
  timeoutMs = 10_000,
  random = Math.random,
  fetchImpl = fetch,
  signal,
  onProgress,
  progressEveryMs = 10_000,
} = {}) {
  const stats = emptyStats();
  const startedAt = Date.now();
  const deadline = durationSeconds > 0 ? startedAt + durationSeconds * 1000 : Infinity;
  const inFlight = new Set();
  let lastProgress = startedAt;

  const shouldContinue = () => !signal?.aborted && Date.now() < deadline && (maxRequests === 0 || stats.sent < maxRequests);

  while (shouldContinue()) {
    if (inFlight.size >= maxInFlight) {
      await Promise.race(inFlight);
      continue;
    }
    const request = buildRequest(random);
    stats.sent += 1;
    const task = fetchImpl(new URL(request.path, baseUrl), {
      method: request.method,
      headers: request.body ? { "content-type": "application/json" } : undefined,
      body: request.body ? JSON.stringify(request.body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    })
      .then(async (response) => {
        await response.arrayBuffer();
        recordStatus(stats, response.status);
      })
      .catch(() => {
        stats.networkErrors += 1;
      })
      .finally(() => inFlight.delete(task));
    inFlight.add(task);

    if (onProgress && Date.now() - lastProgress >= progressEveryMs) {
      lastProgress = Date.now();
      onProgress(stats, lastProgress - startedAt);
    }
    // Jittered pacing (±50%) so traffic is bursty rather than a flat line.
    if (requestsPerSecond > 0 && shouldContinue()) {
      const gap = (1000 / requestsPerSecond) * (0.5 + random());
      await wait(gap, undefined, { signal }).catch(() => {});
    }
  }

  await Promise.allSettled([...inFlight]);
  return { stats, elapsedMs: Date.now() - startedAt };
}

function readNumber(name, value, fallback) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`--${name} debe ser un número mayor o igual a 0: ${value}`);
  return number;
}

export function parseCliOptions(argv = process.argv.slice(2), env = process.env) {
  const { values } = parseArgs({
    args: argv,
    options: {
      url: { type: "string" },
      rps: { type: "string" },
      duration: { type: "string" },
      max: { type: "string" },
      concurrency: { type: "string" },
    },
  });
  return {
    baseUrl: values.url || env.TARGET_URL || "http://127.0.0.1:4000",
    requestsPerSecond: readNumber("rps", values.rps ?? env.REQUESTS_PER_SECOND, 5),
    durationSeconds: readNumber("duration", values.duration ?? env.DURATION_SECONDS, 0),
    maxRequests: readNumber("max", values.max ?? env.MAX_REQUESTS, 0),
    maxInFlight: Math.max(1, readNumber("concurrency", values.concurrency ?? env.MAX_IN_FLIGHT, 20)),
  };
}

async function main() {
  const options = parseCliOptions();
  const controller = new AbortController();
  process.on("SIGINT", () => controller.abort());
  process.on("SIGTERM", () => controller.abort());
  const limits = [options.durationSeconds ? `${options.durationSeconds} s` : null, options.maxRequests ? `${options.maxRequests} peticiones` : null].filter(Boolean).join(" o ") || "sin límite (Ctrl+C para detener)";
  console.log(`[traffic] enviando ~${options.requestsPerSecond} req/s a ${options.baseUrl} · ${limits}`);
  const { stats, elapsedMs } = await runTraffic({
    ...options,
    signal: controller.signal,
    onProgress: (current, elapsed) => console.log(formatStats(current, elapsed)),
  });
  console.log(formatStats(stats, elapsedMs));
  if (stats.completed === 0 && stats.networkErrors > 0) {
    console.error(`[traffic] ninguna petición obtuvo respuesta. ¿Está corriendo la API en ${options.baseUrl}? (pnpm api)`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(`[traffic] ${error.message}`);
    process.exit(1);
  });
}
