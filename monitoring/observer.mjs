import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluateSignals, reconcileSignals } from './engine.mjs';

export async function collectMetrics(baseUrl, policy, now, { fetchImpl = fetch } = {}) {
  const search = async (index, body) => {
    const response = await fetchImpl(`${baseUrl}/${index}/_search?ignore_unavailable=true`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Elasticsearch search ${response.status}: ${await response.text()}`);
    const result = await response.json();
    if (result.timed_out || result._shards?.failed) throw new Error('Consulta incompleta de Elasticsearch');
    return result;
  };
  const from = new Date(+now - policy.windowSeconds * 1000).toISOString();
  const recent = { range: { '@timestamp': { gte: from, lte: now.toISOString() } } };
  const errors = (gte, lt) => ({ filter: { range: { 'http.response.status_code': { gte, lt } } } });
  const logs = await search('filebeat-*', {
    size: 1, sort: [{ '@timestamp': 'desc' }], query: { bool: { filter: [{ term: { 'service.name': policy.serviceName } }, recent] } },
    aggs: { business: { filter: { exists: { field: 'labels.catalog_item' } }, aggs: {
      last: { max: { field: '@timestamp' } }, serverErrors: errors(500, 600),
      routes: { terms: { field: 'labels.route', size: 100 }, aggs: {
        serverErrors: errors(500, 600), clientErrors: errors(400, 500),
        successes: { filter: { range: { 'http.response.status_code': { gte: 200, lt: 400 } } },
          aggs: { latency: { percentiles: { field: 'event.duration', percents: [95] } } } },
      } },
    } } },
  });
  const hb = await search('heartbeat-*', { size: 2, sort: [{ '@timestamp': 'desc' }],
    query: { bool: { filter: [recent, { term: { 'monitor.id': policy.monitorId } }] } } });
  const b = logs.aggregations?.business;
  return {
    heartbeat: (hb.hits?.hits || []).map((h) => ({ timestamp: h._source['@timestamp'], status: h._source.monitor.status })),
    latestLogAt: logs.hits?.hits[0]?._source['@timestamp'] || null,
    latestBusinessAt: b?.last?.value_as_string || null, total: b?.doc_count || 0, serverErrors: b?.serverErrors?.doc_count || 0,
    routes: (b?.routes?.buckets || []).map((r) => ({ route: r.key, total: r.doc_count, serverErrors: r.serverErrors.doc_count,
      clientErrors: r.clientErrors.doc_count, successes: r.successes.doc_count,
      p95Ms: r.successes.latency.values['95.0'] == null ? null : r.successes.latency.values['95.0'] / 1e6 })),
  };
}

export async function completePending(result, { publish, save, clear = async () => {} }) {
  await publish(result);
  await save(result.state);
  await clear();
  return result;
}

export async function runCycle({ previous, policy, now, collect, publish, save, stage = async () => {}, clear }) {
  const metrics = await collect();
  const result = reconcileSignals(evaluateSignals(metrics, policy, now), previous, now, policy);
  await stage(result);
  return completePending(result, { publish, save, clear });
}

async function request(base, path, method, body, contentType = 'application/json') {
  const r = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': contentType }, body: typeof body === 'string' ? body : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function main() {
  const policy = JSON.parse(await readFile(new URL('./policy.json', import.meta.url)));
  if (process.env.EXPECTED_TRAFFIC != null) policy.expectedTraffic = process.env.EXPECTED_TRAFFIC === 'true';
  const base = process.env.ELASTICSEARCH_URL || 'http://127.0.0.1:9200';
  const stateFile = process.env.MONITORING_STATE_FILE || '/tmp/bevstack-monitoring/state.json';
  await mkdir(dirname(stateFile), { recursive: true });
  let previous = {};
  try { previous = JSON.parse(await readFile(stateFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const pendingFile = `${stateFile}.pending`;
  let pending = null;
  try { pending = JSON.parse(await readFile(pendingFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const atomicWrite = async (file, value) => {
    await writeFile(`${file}.tmp`, JSON.stringify(value));
    await rename(`${file}.tmp`, file);
  };
  const transaction = {
    stage: async (result) => { await atomicWrite(pendingFile, result); pending = result; },
    publish: async ({ documents, events }) => {
      const lines = [];
      for (const d of documents) lines.push(JSON.stringify({ index: { _index: 'bevstack-monitoring-current', _id: d.alert.rule_id } }), JSON.stringify(d));
      // Fixed index and IDs keep exact journal retries idempotent across midnight.
      for (const d of events) lines.push(JSON.stringify({ index: { _index: 'bevstack-monitoring-events', _id: d.event.id } }), JSON.stringify(d));
      const r = await request(base, '/_bulk?refresh=wait_for', 'POST', lines.join('\n') + '\n', 'application/x-ndjson');
      if (r.errors) throw new Error(`Bulk incompleto: ${JSON.stringify(r.items.filter((i) => i.index?.error))}`);
    },
    save: (state) => atomicWrite(stateFile, state),
    clear: async () => { await unlink(pendingFile); pending = null; },
  };
  let stopped = false, wake;
  const stop = () => { stopped = true; wake?.(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  const started = Date.now();
  let initialized = false;
  while (!stopped) {
    try {
      if (!initialized) {
        await request(base, '/_index_template/bevstack-monitoring', 'PUT', {
          index_patterns: ['bevstack-monitoring-*'], priority: 200,
          template: { mappings: { dynamic_templates: [{ strings: { match_mapping_type: 'string', mapping: { type: 'keyword', ignore_above: 4096 } } }],
            properties: { '@timestamp': { type: 'date' }, alert: { properties: {
              ...Object.fromEntries(['rule_id', 'title', 'priority', 'owner', 'action', 'route', 'status', 'evidence'].map((field) => [field, { type: 'keyword', ignore_above: 4096 }])),
              changed_at: { type: 'date' }, active: { type: 'boolean' }, priority_rank: { type: 'integer' },
            } } } } },
        });
        const exists = await fetch(`${base}/bevstack-monitoring-current`, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
        if (exists.status === 404) await request(base, '/bevstack-monitoring-current', 'PUT', {});
        else if (!exists.ok) throw new Error(`Índice actual no disponible: ${exists.status}`);
        initialized = true;
      }
      if (Date.now() - started >= policy.startupGraceSeconds * 1000) {
        const now = new Date();
        // An uncertain publication must finish the exact batch before new metrics.
        const result = pending ? await completePending(pending, transaction) : await runCycle({
          previous, policy, now, collect: () => collectMetrics(base, policy, now), ...transaction,
        });
        previous = result.state;
        console.log(JSON.stringify({ timestamp: now.toISOString(), active: result.documents.filter((d) => d.alert.active).map((d) => d.alert.rule_id), transitions: result.events.length }));
      }
    } catch (e) { console.error(`Evaluador: ${e.message}. Se conserva el estado anterior; revisar frescura del evaluador.`); }
    if (!stopped) await new Promise((resolve) => { const timer = setTimeout(resolve, policy.intervalSeconds * 1000); wake = () => { clearTimeout(timer); resolve(); }; });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e); process.exitCode = 1; });
