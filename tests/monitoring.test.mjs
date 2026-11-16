import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateSignals, reconcileSignals } from "../monitoring/engine.mjs";
import { collectMetrics, runCycle, completePending } from "../monitoring/observer.mjs";

const policy = JSON.parse(readFileSync(new URL("../monitoring/policy.json", import.meta.url)));
const now = new Date("2026-11-15T18:00:00.000Z");
const ago = (seconds) => new Date(now - seconds * 1000).toISOString();

function metrics(overrides = {}) {
  return {
    heartbeat: [{ timestamp: ago(2), status: "up" }, { timestamp: ago(12), status: "up" }],
    latestLogAt: ago(3), latestBusinessAt: ago(3),
    total: 500, serverErrors: 25,
    routes: [{ route: "/api/payments", total: 100, successes: 80, clientErrors: 15, serverErrors: 5, p95Ms: 800 }],
    ...overrides,
  };
}

const signal = (data, id) => evaluateSignals(data, policy, now).find((x) => x.id === id);

test("normal configured traffic is not treated as an incident", () => {
  assert.equal(evaluateSignals(metrics(), policy, now).some((s) => s.breach === true), false);
});

test("API outage needs two distinct recent down checks, not two evaluations of one check", () => {
  const one = metrics({ heartbeat: [{ timestamp: ago(2), status: "down" }, { timestamp: ago(12), status: "up" }] });
  assert.notEqual(signal(one, "api-down").breach, true);
  const down = metrics({ heartbeat: [{ timestamp: ago(2), status: "down" }, { timestamp: ago(12), status: "down" }] });
  const s = signal(down, "api-down");
  assert.equal(s.breach, true);
  assert.equal(s.priority, "P1");
  assert.match(s.action, /Tech/);
  assert.match(s.action, /Account Management/);
});

test("stale heartbeat becomes unknown and triggers an observability alert, not a fresh up", () => {
  const old = metrics({ heartbeat: [{ timestamp: ago(80), status: "up" }, { timestamp: ago(90), status: "up" }] });
  assert.equal(signal(old, "api-down").breach, null);
  assert.equal(signal(old, "heartbeat-stale").breach, true);
  assert.equal(signal(old, "heartbeat-stale").priority, "P2");
});

test("missing logs and unexpected lack of business traffic have different meanings", () => {
  assert.equal(signal(metrics({ latestLogAt: ago(90) }), "logs-stale").breach, true);
  const idle = metrics({ latestBusinessAt: ago(90), total: 0, routes: [] });
  assert.equal(signal(idle, "logs-stale").breach, false);
  assert.equal(signal(idle, "traffic-missing").breach, true);
  assert.equal(evaluateSignals(idle, { ...policy, expectedTraffic: false }, now).find((s) => s.id === "traffic-missing").breach, false);
});

test("business error rates exclude the health probe and require a minimum sample", () => {
  assert.equal(signal(metrics({ total: 8, serverErrors: 8 }), "server-errors-global").breach, null);
  assert.equal(signal(metrics({ total: 200, serverErrors: 90 }), "server-errors-global").priority, "P1");
  assert.equal(signal(metrics({ total: 200, serverErrors: 90 }), "server-errors-global").breach, true);
});

test("endpoint percentiles require enough successful responses; errors do not make latency look better", () => {
  const low = metrics({ routes: [{ route: "/api/payments", total: 100, successes: 4, serverErrors: 96, clientErrors: 0, p95Ms: 2200 }] });
  assert.equal(signal(low, "latency:/api/payments").breach, null);
  const slow = metrics({ routes: [{ route: "/api/payments", total: 100, successes: 80, serverErrors: 5, clientErrors: 15, p95Ms: 2200 }] });
  assert.equal(signal(slow, "latency:/api/payments").breach, true);
  assert.equal(signal(slow, "latency:/api/payments").priority, "P2");
});

test("one breach does not alert; sustained breaches create one transition and survive restart", () => {
  const signals = evaluateSignals(metrics({ total: 200, serverErrors: 90 }), policy, now);
  const first = reconcileSignals(signals, {}, now, policy);
  assert.equal(first.documents.find((d) => d.alert.rule_id === "server-errors-global").alert.active, false);
  const second = reconcileSignals(signals, first.state, new Date(+now + 10000), policy);
  assert.equal(second.documents.find((d) => d.alert.rule_id === "server-errors-global").alert.active, true);
  assert.equal(second.events.filter((d) => d.alert.rule_id === "server-errors-global").length, 1);
  const repeated = reconcileSignals(signals, JSON.parse(JSON.stringify(second.state)), new Date(+now + 20000), policy);
  assert.equal(repeated.events.filter((d) => d.alert.rule_id === "server-errors-global").length, 0);
});

test("unknown and hysteresis-band observations never resolve an active alert", () => {
  const base = { id: "test", title: "Prueba", priority: "P2", owner: "Tech", action: "Revisar", evidence: "n=100", breach: true, recover: false };
  let r = reconcileSignals([base], {}, now, policy);
  r = reconcileSignals([base], r.state, new Date(+now + 10000), policy);
  const unknown = reconcileSignals([{ ...base, breach: null, recover: false, reason: "Muestra insuficiente" }], r.state, new Date(+now + 20000), policy);
  assert.equal(unknown.documents[0].alert.active, true);
  assert.match(unknown.documents[0].alert.evidence, /Muestra insuficiente/);
  const band = reconcileSignals([{ ...base, breach: false, recover: false }], unknown.state, new Date(+now + 30000), policy);
  assert.equal(band.documents[0].alert.active, true);
});

test("recovery needs confirmation and emits one recovered event", () => {
  const s = { id: "test", title: "Prueba", priority: "P2", owner: "Tech", action: "Revisar", evidence: "n=100", breach: true };
  let r = reconcileSignals([s], {}, now, policy);
  r = reconcileSignals([s], r.state, new Date(+now + 10000), policy);
  const ok = { ...s, breach: false, recover: true };
  r = reconcileSignals([ok], r.state, new Date(+now + 20000), policy);
  assert.equal(r.documents[0].alert.active, true);
  r = reconcileSignals([ok], r.state, new Date(+now + 30000), policy);
  assert.equal(r.documents[0].alert.active, false);
  assert.equal(r.events[0].alert.status, "Recuperada");
});

test("outage correlates subordinate symptoms without generating duplicate incidents", () => {
  const data = metrics({ latestLogAt: ago(90), heartbeat: [{ timestamp: ago(2), status: "down" }, { timestamp: ago(12), status: "down" }], total: 200, serverErrors: 100 });
  const r = reconcileSignals(evaluateSignals(data, policy, now), {}, now, policy);
  assert.equal(r.documents.filter((d) => d.alert.active).length, 1);
  assert.equal(r.documents.find((d) => d.alert.rule_id === "api-down").alert.priority, "P1");
  assert.equal(r.documents.find((d) => d.alert.rule_id === "logs-stale").alert.status, "Correlacionada");
});

test("collection scopes the API, business requests, successful latency and recent window", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return new Response(JSON.stringify(String(url).includes("heartbeat") ? { hits: { hits: [] } } : {
      hits: { hits: [] }, aggregations: { business: { doc_count: 0, last: {}, serverErrors: { doc_count: 0 }, routes: { buckets: [] } } },
    }), { status: 200 });
  };
  const r = await collectMetrics("http://elasticsearch:9200", policy, now, { fetchImpl });
  const body = JSON.stringify(calls[0].body);
  assert.match(body, /bevstack-ecommerce-api/);
  assert.match(body, /labels.catalog_item/);
  assert.match(body, /event.duration/);
  assert.match(body, /percentiles/);
  assert.match(body, /2026-11-15T17:55:00/);
  assert.equal(r.total, 0);
});

test("failed collection or publication cannot falsely clear alerts or advance persisted state", async () => {
  const previous = { sentinel: { active: true } };
  let saved = false;
  await assert.rejects(runCycle({ previous, policy, now, collect: async () => { throw new Error("offline"); }, publish: async () => {}, save: async () => { saved = true; } }), /offline/);
  assert.equal(saved, false);
  await assert.rejects(runCycle({ previous, policy, now, collect: async () => metrics(), publish: async () => { throw new Error("write failed"); }, save: async () => { saved = true; } }), /write failed/);
  assert.equal(saved, false);
  assert.deepEqual(previous, { sentinel: { active: true } });
});


test("recovery bands accommodate the configured simulation baseline without flapping", () => {
  const data = metrics({ routes: [{ route: "/api/payments", total: 100, successes: 73, serverErrors: 7, clientErrors: 20, p95Ms: 800 }] });
  assert.equal(signal(data, "server-errors:/api/payments").recover, true);
  assert.equal(signal(data, "client-errors:/api/payments").recover, true);
  const band = metrics({ routes: [{ route: "/api/payments", total: 100, successes: 71, serverErrors: 9, clientErrors: 20, p95Ms: 800 }] });
  assert.equal(signal(band, "server-errors:/api/payments").breach, false);
  assert.equal(signal(band, "server-errors:/api/payments").recover, false);
});


test("a published batch survives save failure and restart before newer metrics are processed", async () => {
  let journal, saved;
  const indexed = new Map();
  const publish = async (r) => { for (const event of r.events) indexed.set(event.event.id, event); };
  const signals = evaluateSignals(metrics({ total: 200, serverErrors: 90 }), policy, now);
  const first = reconcileSignals(signals, {}, now, policy);
  await assert.rejects(runCycle({ previous: first.state, policy, now: new Date(+now + 10000),
    collect: async () => metrics({ total: 200, serverErrors: 90 }),
    stage: async (r) => { journal = JSON.parse(JSON.stringify(r)); }, publish,
    save: async () => { throw new Error('disk failure'); },
  }), /disk failure/);
  assert.equal(journal.events.length, 1);
  assert.equal(indexed.size, 1);
  // Replay the exact journal after restart; do not collect newer observations first.
  const committed = await completePending(JSON.parse(JSON.stringify(journal)), {
    publish, save: async (s) => { saved = s; }, clear: async () => { journal = null; },
  });
  assert.equal(journal, null);
  assert.equal(committed.state['server-errors-global'].active, true);
  assert.equal(indexed.size, 1);
  for (const elapsed of [20000, 30000]) {
    const r = await runCycle({ previous: saved, policy, now: new Date(+now + elapsed),
      collect: async () => metrics(), publish, save: async (s) => { saved = s; },
    });
    assert.equal(r.state['server-errors-global'].active, elapsed === 20000);
  }
  assert.deepEqual([...indexed.values()].map((d) => d.alert.status), ['Activa', 'Recuperada']);
});
