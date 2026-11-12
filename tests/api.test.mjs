import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp, HttpError } from "../api/app.mjs";
import { loadConfig } from "../api/config.mjs";
import { buildRequestLog, createLogger, levelForStatus } from "../api/logger.mjs";

const REQUIRED_FIELDS = [
  ["@timestamp"],
  ["http", "request", "method"],
  ["http", "response", "status_code"],
  ["event", "duration"],
  ["url", "path"],
  ["service", "name"],
  ["log", "level"],
];

function pick(document, path) {
  return path.reduce((value, key) => value?.[key], document);
}

async function startTestServer(routes = []) {
  const lines = [];
  const logger = { write: (document) => lines.push(document), close: async () => {} };
  const config = loadConfig({ SERVICE_NAME: "test-api", SERVICE_ENVIRONMENT: "test" });
  let tick = 0n;
  const server = createServer(createApp({ config, logger, routes, clock: () => (tick += 2_500_000n) }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    lines,
    url: (path) => `http://127.0.0.1:${port}${path}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test("config uses documented defaults", () => {
  const config = loadConfig({});
  assert.equal(config.port, 4000);
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.serviceName, "bevstack-ecommerce-api");
  assert.equal(config.logFile, "logs/api.log");
  assert.deepEqual(config.simulation, { clientErrorRate: 0.15, serverErrorRate: 0.05, latencyScale: 1, slowRequestRate: 0.05, maxLatencyMs: 3000 });
});

test("config rejects invalid ports and error rates", () => {
  assert.throws(() => loadConfig({ PORT: "abc" }), /PORT/);
  assert.throws(() => loadConfig({ CLIENT_ERROR_RATE: "1.5" }), /CLIENT_ERROR_RATE/);
  assert.throws(() => loadConfig({ CLIENT_ERROR_RATE: "0.7", SERVER_ERROR_RATE: "0.5" }), /no puede ser mayor que 1/);
});

test("log level follows the HTTP status class", () => {
  assert.equal(levelForStatus(200), "info");
  assert.equal(levelForStatus(201), "info");
  assert.equal(levelForStatus(404), "warn");
  assert.equal(levelForStatus(503), "error");
});

test("request log includes every field required by the phase", () => {
  const document = buildRequestLog({
    timestamp: new Date("2026-11-11T15:00:00.000Z"),
    serviceName: "bevstack-ecommerce-api",
    environment: "local",
    method: "POST",
    path: "/api/orders",
    statusCode: 502,
    durationNs: 123_000_000,
  });
  for (const field of REQUIRED_FIELDS) assert.notEqual(pick(document, field), undefined, field.join("."));
  assert.equal(document["@timestamp"], "2026-11-11T15:00:00.000Z");
  assert.equal(document.http.request.method, "POST");
  assert.equal(document.http.response.status_code, 502);
  assert.equal(document.event.duration, 123_000_000);
  assert.equal(document.event.outcome, "failure");
  assert.equal(document.log.level, "error");
});

test("file logger appends one JSON document per line", async () => {
  const directory = mkdtempSync(join(tmpdir(), "bevstack-api-"));
  try {
    const file = join(directory, "nested", "api.log");
    const logger = createLogger({ file, writeToStdout: false });
    logger.write({ a: 1 });
    logger.write({ b: 2 });
    await logger.close();
    const lines = readFileSync(file, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(lines, [{ a: 1 }, { b: 2 }]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("health endpoint answers up and is logged automatically", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(server.url("/api/health?probe=1"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, "up");
    assert.equal(body.service, "test-api");
    assert.equal(server.lines.length, 1);
    const [log] = server.lines;
    assert.equal(log.url.path, "/api/health");
    assert.equal(log.http.request.method, "GET");
    assert.equal(log.http.response.status_code, 200);
    assert.equal(log.event.duration, 2_500_000);
    assert.equal(log.service.name, "test-api");
    assert.equal(log.log.level, "info");
  } finally {
    await server.close();
  }
});

test("unknown routes return 404 and are logged as warnings", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(server.url("/api/missing"));
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, "not_found");
    assert.equal(server.lines[0].http.response.status_code, 404);
    assert.equal(server.lines[0].log.level, "warn");
  } finally {
    await server.close();
  }
});

test("wrong method returns 405 with an Allow header", async () => {
  const server = await startTestServer();
  try {
    const response = await fetch(server.url("/api/health"), { method: "DELETE" });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD");
    assert.equal(server.lines[0].http.response.status_code, 405);
  } finally {
    await server.close();
  }
});

test("route params, HttpError and unexpected errors are handled and logged", async () => {
  const server = await startTestServer([
    { method: "GET", path: "/api/items/:sku", handler: ({ params }) => ({ status: 200, body: { sku: params.sku } }) },
    { method: "GET", path: "/api/conflict", handler: () => { throw new HttpError(409, "conflict", "Choque."); } },
    { method: "GET", path: "/api/crash", handler: async () => { throw new Error("boom"); } },
  ]);
  try {
    const item = await fetch(server.url("/api/items/SKU%2D1"));
    assert.deepEqual(await item.json(), { sku: "SKU-1" });

    const conflict = await fetch(server.url("/api/conflict"));
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).error, "conflict");

    const crash = await fetch(server.url("/api/crash"));
    assert.equal(crash.status, 500);
    assert.equal((await crash.json()).error, "internal_error");

    assert.deepEqual(server.lines.map((line) => [line.url.path, line.http.response.status_code, line.log.level]), [
      ["/api/items/SKU%2D1", 200, "info"],
      ["/api/conflict", 409, "warn"],
      ["/api/crash", 500, "error"],
    ]);
  } finally {
    await server.close();
  }
});

test("malformed percent-encoding in a route param is a 400, not a 500", async () => {
  const server = await startTestServer([
    { method: "GET", path: "/api/items/:sku", handler: ({ params }) => ({ status: 200, body: { sku: params.sku } }) },
  ]);
  try {
    const response = await fetch(server.url("/api/items/%E0%A4%A"));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "invalid_path");
    assert.equal(server.lines[0].log.level, "warn");
    assert.equal(server.lines[0].error.code, "invalid_path");
  } finally {
    await server.close();
  }
});

test("HEAD is answered by GET routes without a body and advertised in Allow", async () => {
  const server = await startTestServer([{ method: "POST", path: "/api/orders", handler: () => ({ status: 201, body: {} }) }]);
  try {
    const head = await fetch(server.url("/api/health"), { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.equal(server.lines[0].http.request.method, "HEAD");

    const wrong = await fetch(server.url("/api/health"), { method: "POST" });
    assert.equal(wrong.status, 405);
    assert.equal(wrong.headers.get("allow"), "GET, HEAD");

    const headOnPost = await fetch(server.url("/api/orders"), { method: "HEAD" });
    assert.equal(headOnPost.status, 405);
    assert.equal(headOnPost.headers.get("allow"), "POST");
  } finally {
    await server.close();
  }
});

test("logs carry route template, route labels and error details", async () => {
  const server = await startTestServer([
    { method: "GET", path: "/api/items/:sku", labels: { catalog_item: "demo", catalog_type: "Incidente" }, handler: () => { throw new HttpError(502, "upstream_down", "Proveedor caído."); } },
  ]);
  try {
    await fetch(server.url("/api/items/SKU-9"));
    await fetch(server.url("/api/nowhere"));
    const [failed, missing] = server.lines;
    assert.equal(failed.url.path, "/api/items/SKU-9");
    assert.deepEqual(failed.labels, { route: "/api/items/:sku", catalog_item: "demo", catalog_type: "Incidente" });
    assert.deepEqual(failed.error, { code: "upstream_down", message: "Proveedor caído." });
    assert.equal(missing.labels, undefined, "unmatched routes have no route label");
    assert.equal(missing.error.code, "not_found");
  } finally {
    await server.close();
  }
});

test("successful requests have no error object", () => {
  const document = buildRequestLog({ timestamp: new Date(), serviceName: "s", environment: "e", method: "GET", path: "/api/health", statusCode: 200, durationNs: 1, route: "/api/health" });
  assert.equal(document.error, undefined);
  assert.deepEqual(document.labels, { route: "/api/health" });
});
