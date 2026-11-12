#!/usr/bin/env node
// Imports the Phase 3 Kibana dashboard (data views + dashboard) from kibana/dashboard.ndjson.
// Usage: pnpm kibana:import [-- --url http://localhost:5601 --file kibana/dashboard.ndjson]
// In Docker it runs once as the `kibana-setup` service of docker-compose.yml.
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const DASHBOARD_ID = "bevstack-api-monitoring";

export async function waitForKibana(baseUrl, { fetchImpl = fetch, attempts = 60, delayMs = 5000, log = () => {} } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(new URL("/api/status", baseUrl));
      if (response.ok) {
        const body = await response.json();
        if (body?.status?.overall?.level === "available") return;
      }
    } catch {
      // Kibana not reachable yet.
    }
    log(`[kibana] esperando a Kibana (${attempt}/${attempts})…`);
    if (attempt < attempts) await wait(delayMs);
  }
  throw new Error(`Kibana no respondió en ${baseUrl}. ¿Está levantado el stack? (docker compose up -d)`);
}

export async function importSavedObjects(baseUrl, file, { fetchImpl = fetch } = {}) {
  const content = await readFile(file);
  const form = new FormData();
  form.append("file", new Blob([content], { type: "application/ndjson" }), basename(file));
  const response = await fetchImpl(new URL("/api/saved_objects/_import?overwrite=true", baseUrl), {
    method: "POST",
    headers: { "kbn-xsrf": "true" },
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) {
    const details = (body.errors || []).map((error) => `${error.type}/${error.id}: ${error.error?.type || error.error?.message || "error"}`).join("; ");
    throw new Error(`La importación falló (HTTP ${response.status}). ${details || body.message || ""}`.trim());
  }
  return body;
}

async function main() {
  const { values } = parseArgs({ options: { url: { type: "string" }, file: { type: "string" } } });
  const baseUrl = values.url || process.env.KIBANA_URL || "http://localhost:5601";
  const file = values.file || "kibana/dashboard.ndjson";
  await waitForKibana(baseUrl, { log: console.log });
  const result = await importSavedObjects(baseUrl, file);
  for (const item of result.successResults || []) console.log(`[kibana] importado ${item.type}: ${item.meta?.title || item.id}`);
  console.log(`[kibana] listo: ${baseUrl}/app/dashboards#/view/${DASHBOARD_ID}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(`[kibana] ${error.message}`);
    process.exit(1);
  });
}
