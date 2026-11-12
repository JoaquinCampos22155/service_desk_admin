import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createApp } from "../api/app.mjs";
import { CATALOG_ENDPOINTS, createCatalogRoutes } from "../api/catalog.mjs";
import { loadConfig } from "../api/config.mjs";
import { createSimulator, seededRandom } from "../api/simulation.mjs";
import { buildRequest, formatStats, parseCliOptions, runTraffic, TRAFFIC_MIX } from "../scripts/traffic-generator.mjs";

async function startApi() {
  const lines = [];
  const config = loadConfig({});
  const simulator = createSimulator({ ...config.simulation, latencyScale: 0, random: seededRandom(11) });
  const server = createServer(createApp({ config, logger: { write: (line) => lines.push(line) }, routes: createCatalogRoutes({ simulator }) }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { lines, baseUrl: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

test("traffic mix covers every catalog endpoint", () => {
  assert.deepEqual(TRAFFIC_MIX.map((item) => item.id).sort(), CATALOG_ENDPOINTS.map((endpoint) => endpoint.id).sort());
  const random = seededRandom(5);
  const seen = new Set(Array.from({ length: 2000 }, () => buildRequest(random).id));
  assert.equal(seen.size, CATALOG_ENDPOINTS.length);
});

test("built requests match the method of their catalog endpoint", () => {
  const random = seededRandom(9);
  const methods = Object.fromEntries(CATALOG_ENDPOINTS.map((endpoint) => [endpoint.id, endpoint.method]));
  for (let index = 0; index < 500; index += 1) {
    const request = buildRequest(random);
    assert.equal(request.method, methods[request.id]);
    assert.match(request.path, /^\/api\//);
    assert.equal(request.body !== undefined, request.method !== "GET");
  }
});

test("generator drives the real API and every request is logged", async () => {
  const api = await startApi();
  try {
    const { stats } = await runTraffic({ baseUrl: api.baseUrl, requestsPerSecond: 0, maxRequests: 120, random: seededRandom(21) });
    assert.equal(stats.sent, 120);
    assert.equal(stats.completed, 120);
    assert.equal(stats.networkErrors, 0);
    assert.equal(api.lines.length, 120);
    const classes = stats.byStatusClass;
    assert.equal(classes["2xx"] + classes["4xx"] + classes["5xx"], 120);
    assert.ok(classes["2xx"] > 0 && classes["4xx"] > 0, JSON.stringify(stats.byStatus));
    assert.equal(api.lines.filter((line) => line.http.response.status_code >= 500).length, classes["5xx"]);
  } finally {
    await api.close();
  }
});

test("generator counts unreachable API as network errors without crashing", async () => {
  const { stats } = await runTraffic({
    baseUrl: "http://127.0.0.1:9",
    requestsPerSecond: 0,
    maxRequests: 5,
    fetchImpl: async () => { throw new Error("ECONNREFUSED"); },
  });
  assert.equal(stats.sent, 5);
  assert.equal(stats.networkErrors, 5);
  assert.equal(stats.completed, 0);
});

test("generator stops when aborted", async () => {
  const controller = new AbortController();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 3) controller.abort();
    return new Response("{}", { status: 200 });
  };
  const { stats } = await runTraffic({ requestsPerSecond: 1000, fetchImpl, signal: controller.signal });
  assert.equal(stats.sent, 3);
  assert.equal(stats.completed, 3);
});

test("CLI options read flags, environment and defaults", () => {
  assert.deepEqual(parseCliOptions([], {}), { baseUrl: "http://127.0.0.1:4000", requestsPerSecond: 5, durationSeconds: 0, maxRequests: 0, maxInFlight: 20 });
  assert.deepEqual(
    parseCliOptions(["--url", "http://api:4000", "--rps", "12", "--max", "300"], { DURATION_SECONDS: "60" }),
    { baseUrl: "http://api:4000", requestsPerSecond: 12, durationSeconds: 60, maxRequests: 300, maxInFlight: 20 },
  );
  assert.throws(() => parseCliOptions(["--rps", "-1"], {}), /--rps/);
});

test("progress line reports totals and status class percentages", () => {
  const line = formatStats({ sent: 10, completed: 10, networkErrors: 0, byStatusClass: { "2xx": 8, "4xx": 1, "5xx": 1, other: 0 }, byStatus: {} }, 2000);
  assert.match(line, /10\/10 respuestas en 2 s \(5\.0 req\/s\)/);
  assert.match(line, /2xx 8 \(80\.0%\)/);
  assert.match(line, /5xx 1 \(10\.0%\)/);
});
