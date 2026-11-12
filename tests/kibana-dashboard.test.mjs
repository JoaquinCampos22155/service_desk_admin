import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { DASHBOARD_ID, importSavedObjects, waitForKibana } from "../scripts/kibana-import.mjs";

const DASHBOARD_FILE = fileURLToPath(new URL("../kibana/dashboard.ndjson", import.meta.url));
const objects = readFileSync(DASHBOARD_FILE, "utf8").split("\n").filter((line) => line.trim()).map((line) => JSON.parse(line)).filter((object) => object.type);
const dashboard = objects.find((object) => object.type === "dashboard");
const panels = JSON.parse(dashboard.attributes.panelsJSON);
const lensStates = panels.map((panel) => panel.embeddableConfig.attributes);

function columnsOf(attributes) {
  return Object.values(attributes.state.datasourceStates.formBased.layers).flatMap((layer) => Object.values(layer.columns));
}

test("export contains both data views and the dashboard", () => {
  assert.equal(dashboard.id, DASHBOARD_ID);
  const dataViews = objects.filter((object) => object.type === "index-pattern").map((object) => object.attributes.title).sort();
  assert.deepEqual(dataViews, ["filebeat-*", "heartbeat-*"]);
});

test("dashboard has the six visualizations required by the phase", () => {
  const titles = panels.map((panel) => panel.title);
  for (const required of ["Tráfico de peticiones", "Tiempo de respuesta promedio", "Estado del sistema (up / down)", "Distribución por códigos HTTP", "Error rate en el tiempo", "Top endpoints (rutas más consultadas)"]) {
    assert.ok(titles.includes(required), `falta el panel "${required}"`);
  }
});

test("visualizations use the logged ECS fields and Heartbeat status", () => {
  const fields = new Set(lensStates.flatMap(columnsOf).map((column) => column.sourceField).filter(Boolean));
  for (const field of ["@timestamp", "event.duration", "http.response.status_code", "labels.route", "monitor.status"]) {
    assert.ok(fields.has(field), `ningún panel usa ${field}`);
  }
  const formulas = lensStates.flatMap(columnsOf).filter((column) => column.operationType === "formula").map((column) => column.params.formula);
  assert.ok(formulas.includes("count(kql='http.response.status_code >= 400') / count()"), "error rate formula");
  assert.ok(formulas.includes("average(event.duration) / 1000000"), "latency in ms formula");
});

test("every panel layer has a matching data view reference on the dashboard", () => {
  const referenceNames = new Set(dashboard.references.map((reference) => reference.name));
  const dataViewIds = new Set(objects.filter((object) => object.type === "index-pattern").map((object) => object.id));
  for (const panel of panels) {
    for (const layerId of Object.keys(panel.embeddableConfig.attributes.state.datasourceStates.formBased.layers)) {
      assert.ok(referenceNames.has(`${panel.panelIndex}:indexpattern-datasource-layer-${layerId}`), `${panel.title}: falta la referencia`);
    }
  }
  assert.ok(dashboard.references.every((reference) => dataViewIds.has(reference.id)));
});

test("waitForKibana returns once Kibana reports available", async () => {
  const levels = ["unavailable", "degraded", "available"];
  let calls = 0;
  const fetchImpl = async () => new Response(JSON.stringify({ status: { overall: { level: levels[calls++] } } }), { status: 200 });
  await waitForKibana("http://kibana:5601", { fetchImpl, delayMs: 0 });
  assert.equal(calls, 3);
});

test("waitForKibana gives up with a helpful message", async () => {
  const fetchImpl = async () => { throw new Error("ECONNREFUSED"); };
  await assert.rejects(waitForKibana("http://kibana:5601", { fetchImpl, attempts: 2, delayMs: 0 }), /docker compose up -d/);
});

test("importSavedObjects posts the NDJSON with overwrite and reports failures", async () => {
  const requests = [];
  const ok = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify({ success: true, successCount: 3, successResults: [] }), { status: 200 });
  };
  const result = await importSavedObjects("http://kibana:5601", DASHBOARD_FILE, { fetchImpl: ok });
  assert.equal(result.successCount, 3);
  assert.equal(requests[0].url, "http://kibana:5601/api/saved_objects/_import?overwrite=true");
  assert.equal(requests[0].options.headers["kbn-xsrf"], "true");
  assert.ok(requests[0].options.body instanceof FormData);

  const failing = async () => new Response(JSON.stringify({ success: false, errors: [{ type: "dashboard", id: "x", error: { type: "conflict" } }] }), { status: 200 });
  await assert.rejects(importSavedObjects("http://kibana:5601", DASHBOARD_FILE, { fetchImpl: failing }), /dashboard\/x: conflict/);
});
