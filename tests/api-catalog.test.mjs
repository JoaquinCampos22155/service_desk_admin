import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import test from "node:test";
import { createApp } from "../api/app.mjs";
import { CATALOG_ENDPOINTS, createCatalogRoutes } from "../api/catalog.mjs";
import { loadConfig } from "../api/config.mjs";
import { createSimulator, seededRandom, SLOW_REQUEST_MULTIPLIER } from "../api/simulation.mjs";

const SAMPLE_REQUESTS = {
  "new-store": { path: "/api/stores", body: { brand: "Altura Gin", domain: "alturagin.example" } },
  "shipping-rules": { path: "/api/stores/STORE-10001/shipping-rules", body: { zones: ["zona-12"] } },
  "product-config": { path: "/api/products/SKU-501", body: { title: "Gin 750 ml" } },
  "operational-config": { path: "/api/stores/STORE-10001/operational-config", body: { orderCutoff: "15:00" } },
  "unprocessed-order": { path: "/api/orders", body: { items: [{ sku: "SKU-501", qty: 2 }] } },
  "incorrect-inventory": { path: "/api/inventory/SKU-501" },
  "payment-without-order": { path: "/api/payments", body: { orderId: "ORD-78421", amount: 45 } },
  "shipping-unavailable": { path: "/api/shipping/options?zone=12" },
};

async function startCatalogServer(simulation) {
  const lines = [];
  const config = loadConfig({ SERVICE_NAME: "test-api" });
  const simulator = createSimulator({ latencyScale: 0, slowRequestRate: 0, random: seededRandom(7), ...simulation });
  const server = createServer(createApp({ config, logger: { write: (line) => lines.push(line) }, routes: createCatalogRoutes({ simulator }) }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    lines,
    request(endpoint, overrides = {}) {
      const sample = SAMPLE_REQUESTS[endpoint.id];
      return fetch(`http://127.0.0.1:${port}${sample.path}`, {
        method: endpoint.method,
        headers: sample.body ? { "content-type": "application/json" } : undefined,
        body: sample.body ? JSON.stringify(sample.body) : undefined,
        ...overrides,
      });
    },
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("there is one endpoint per Phase 1 catalog item", () => {
  const appSource = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const catalogIds = [...appSource.matchAll(/\{ id: "([a-z-]+)", name: "[^"]+", type: "(?:Solicitud|Incidente)"/g)].map((match) => match[1]);
  assert.equal(catalogIds.length, 8);
  assert.deepEqual(CATALOG_ENDPOINTS.map((endpoint) => endpoint.id).sort(), [...catalogIds].sort());
  assert.equal(new Set(CATALOG_ENDPOINTS.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).size, 8);
  for (const endpoint of CATALOG_ENDPOINTS) {
    assert.ok(endpoint.clientErrors.every((error) => error.status >= 400 && error.status < 500), endpoint.id);
    assert.ok(endpoint.serverErrors.every((error) => error.status >= 500 && error.status < 600), endpoint.id);
  }
});

test("outcome picks follow the configured error proportions", () => {
  const simulator = createSimulator({ clientErrorRate: 0.15, serverErrorRate: 0.05, random: seededRandom(42) });
  const counts = { success: 0, client_error: 0, server_error: 0 };
  const total = 20_000;
  for (let index = 0; index < total; index += 1) counts[simulator.pickOutcome()] += 1;
  assert.ok(Math.abs(counts.client_error / total - 0.15) < 0.01, JSON.stringify(counts));
  assert.ok(Math.abs(counts.server_error / total - 0.05) < 0.01, JSON.stringify(counts));
  assert.ok(Math.abs(counts.success / total - 0.8) < 0.01, JSON.stringify(counts));
});

test("latency varies inside the profile, spikes on slow requests and respects the cap", () => {
  const steady = createSimulator({ clientErrorRate: 0, serverErrorRate: 0, slowRequestRate: 0, random: seededRandom(3) });
  const values = Array.from({ length: 200 }, () => steady.latencyMs({ min: 100, max: 300 }));
  assert.ok(values.every((value) => value >= 100 && value <= 300));
  assert.ok(new Set(values).size > 50, "latency should vary between requests");

  const spiky = createSimulator({ clientErrorRate: 0, serverErrorRate: 0, slowRequestRate: 1, maxLatencyMs: 1000, random: () => 0.5 });
  assert.equal(spiky.latencyMs({ min: 100, max: 300 }), 200 * SLOW_REQUEST_MULTIPLIER);
  assert.equal(spiky.latencyMs({ min: 200, max: 400 }), 1000);

  const scaled = createSimulator({ clientErrorRate: 0, serverErrorRate: 0, latencyScale: 0.5, random: () => 0.5 });
  assert.equal(scaled.latencyMs({ min: 100, max: 300 }), 100);
});

test("delay waits for the simulated latency", async () => {
  const waits = [];
  const simulator = createSimulator({ clientErrorRate: 0, serverErrorRate: 0, random: () => 0, sleep: async (ms) => waits.push(ms) });
  assert.equal(await simulator.delay({ min: 40, max: 80 }), 40);
  assert.deepEqual(waits, [40]);
});

test("every catalog endpoint answers successfully when no errors are configured", async () => {
  const server = await startCatalogServer({ clientErrorRate: 0, serverErrorRate: 0 });
  try {
    for (const endpoint of CATALOG_ENDPOINTS) {
      const response = await server.request(endpoint);
      const body = await response.json();
      assert.ok([200, 201].includes(response.status), `${endpoint.id}: ${response.status}`);
      assert.equal(typeof body, "object");
    }
    assert.equal(server.lines.length, 8);
    assert.ok(server.lines.every((line) => line.log.level === "info" && line.event.outcome === "success"));
    assert.deepEqual(server.lines.map((line) => line.url.path), CATALOG_ENDPOINTS.map((endpoint) => SAMPLE_REQUESTS[endpoint.id].path.split("?")[0]));
  } finally {
    await server.close();
  }
});

test("success responses carry data from the request", async () => {
  const server = await startCatalogServer({ clientErrorRate: 0, serverErrorRate: 0 });
  try {
    const byId = Object.fromEntries(CATALOG_ENDPOINTS.map((endpoint) => [endpoint.id, endpoint]));
    assert.deepEqual(await (await server.request(byId["shipping-rules"])).json(), { storeId: "STORE-10001", zones: ["zona-12"], status: "applied" });
    assert.equal((await (await server.request(byId["shipping-unavailable"])).json()).zone, "12");
    assert.match((await (await server.request(byId["new-store"])).json()).storeId, /^STORE-\d{5}$/);
  } finally {
    await server.close();
  }
});

test("forced client errors return a 4xx from the endpoint list and log a warning", async () => {
  const server = await startCatalogServer({ clientErrorRate: 1, serverErrorRate: 0 });
  try {
    for (const endpoint of CATALOG_ENDPOINTS) {
      const response = await server.request(endpoint);
      const body = await response.json();
      assert.ok(endpoint.clientErrors.some((error) => error.status === response.status && error.code === body.error), `${endpoint.id}: ${response.status} ${body.error}`);
    }
    assert.ok(server.lines.every((line) => line.log.level === "warn" && line.event.outcome === "failure"));
  } finally {
    await server.close();
  }
});

test("forced server errors return a 5xx from the endpoint list and log an error", async () => {
  const server = await startCatalogServer({ clientErrorRate: 0, serverErrorRate: 1 });
  try {
    for (const endpoint of CATALOG_ENDPOINTS) {
      const response = await server.request(endpoint);
      const body = await response.json();
      assert.ok(endpoint.serverErrors.some((error) => error.status === response.status && error.code === body.error), `${endpoint.id}: ${response.status} ${body.error}`);
    }
    assert.ok(server.lines.every((line) => line.log.level === "error"));
  } finally {
    await server.close();
  }
});

test("malformed JSON is always rejected with 400 invalid_json", async () => {
  const server = await startCatalogServer({ clientErrorRate: 0, serverErrorRate: 0 });
  try {
    const orders = CATALOG_ENDPOINTS.find((endpoint) => endpoint.id === "unprocessed-order");
    for (const body of ["{not json", "[1,2]", "42"]) {
      const response = await server.request(orders, { body, headers: { "content-type": "application/json" } });
      assert.equal(response.status, 400, body);
      assert.equal((await response.json()).error, "invalid_json");
    }
  } finally {
    await server.close();
  }
});
