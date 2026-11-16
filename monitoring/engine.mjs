// Technical priorities are proposals for the simulation, not agreed business SLAs.
export function evaluateSignals(m, p, now = new Date()) {
  const age = (value) => value ? Math.max(0, (+now - Date.parse(value)) / 1000) : Infinity;
  const recent = m.heartbeat.filter((h) => age(h.timestamp) <= p.freshnessSeconds);
  const unique = [...new Map(recent.map((h) => [h.timestamp, h])).values()];
  const fresh = unique.length > 0;
  const down = unique.length >= 2 && unique.slice(0, 2).every((h) => h.status === 'down');
  const up = unique.length >= 2 && unique.slice(0, 2).every((h) => h.status === 'up');
  const signals = [];
  function add(id, title, priority, owner, action, breach, recover, evidence, extra = {}) {
    signals.push({ id, title, priority, owner, action, breach, recover, evidence, ...extra });
  }
  add('api-down', 'API no disponible', 'P1', 'Tech; Account Management comunica',
    'Tech: revisar contenedor, /api/health y dependencias; restaurar servicio. Account Management: validar marcas e impacto y coordinar comunicación.',
    fresh ? down : null, up, `Heartbeat: ${unique.slice(0, 2).map((h) => h.status).join(', ') || 'sin datos recientes'}`,
    { activationEvaluations: 1, recoveryEvaluations: 1 });
  add('heartbeat-stale', 'Sin señal reciente de Heartbeat', 'P2', 'Tech',
    'Revisar Heartbeat y Elasticsearch; verificar API directamente. Estado desconocido hasta recuperar telemetría.',
    !fresh, fresh, `Último chequeo: ${m.heartbeat[0]?.timestamp || 'ninguno'}; máximo ${p.freshnessSeconds} s`);
  const logsFresh = age(m.latestLogAt) <= p.freshnessSeconds;
  add('logs-stale', 'Logs de API sin actualizar', 'P2', 'Tech',
    'Revisar API, archivo api.log, Filebeat y su salida a Elasticsearch; contrastar disponibilidad con Heartbeat.',
    !logsFresh, logsFresh, `Último log: ${m.latestLogAt || 'ninguno'}; máximo ${p.freshnessSeconds} s`, { suppressedBy: ['api-down'] });
  const gap = p.expectedTraffic && age(m.latestBusinessAt) > p.trafficGapSeconds;
  add('traffic-missing', 'Tráfico esperado ausente', 'P3', 'Tech; Account Management valida demanda',
    'Revisar generador y demanda esperada; Account Management confirma si es horario sin actividad o impacto comercial.',
    logsFresh ? gap : null, logsFresh && !gap, `Última petición de catálogo: ${m.latestBusinessAt || 'ninguna'}; tráfico esperado: ${p.expectedTraffic}`, { suppressedBy: ['api-down', 'logs-stale'] });
  function rate(id, title, priority, owner, action, count, total, threshold, recoveryThreshold, minimum, extra) {
    const enough = total >= minimum && logsFresh;
    const value = total ? count / total : 0;
    add(id, title, priority, owner, action, enough ? value >= threshold : null,
      enough && value < recoveryThreshold, `${count}/${total} (${(value * 100).toFixed(1)}%); umbral ${(threshold * 100).toFixed(0)}%; ventana ${p.windowSeconds}s; mínimo ${minimum}`,
      { reason: enough ? '' : 'Muestra insuficiente o logs atrasados', ...extra });
  }
  rate('server-errors-global', 'Errores 5xx generalizados', 'P1', 'Tech; Account Management valida impacto',
    'Tech: agrupar por ruta y error.code, revisar cambio reciente y restaurar servicio; Account Management valida impacto y comunicación.',
    m.serverErrors, m.total, p.globalServerRate, p.globalServerRecoveryRate, p.globalMinimum, { suppressedBy: ['api-down'] });
  // Include every expected route, even when absent: missing samples cannot clear an alert.
  const routes = new Map(m.routes.map((r) => [r.route, r]));
  for (const [route, target] of Object.entries(p.latencyTargetsMs)) {
    const r = routes.get(route) || { total: 0, successes: 0, serverErrors: 0, clientErrors: 0, p95Ms: null };
    rate(`server-errors:${route}`, `5xx en ${route}`, 'P2', 'Tech',
      'Revisar logs de la ruta y error.code; contrastar con despliegues y dependencias. Escalar impacto comercial a Account Management.',
      r.serverErrors, r.total, p.routeServerRate, p.routeServerRecoveryRate, p.routeMinimum, { route, suppressedBy: ['api-down', 'server-errors-global'] });
    rate(`client-errors:${route}`, `4xx en ${route}`, 'P3', 'Account Management / Customer Success; Tech apoya',
      'Validar datos, configuración y experiencia del cliente; Tech analiza errores de autenticación o regresiones. No tratar cada 4xx como caída.',
      r.clientErrors, r.total, p.clientRate, p.clientRecoveryRate, p.routeMinimum, { route, suppressedBy: ['api-down', 'logs-stale'] });
    const enough = logsFresh && r.successes >= p.routeMinimum && Number.isFinite(r.p95Ms);
    add(`latency:${route}`, `Lentitud en ${route}`, 'P2', 'Tech',
      'Revisar p95, volumen y dependencias de la ruta; Account Management confirma la experiencia e impacto antes de comprometer un SLA.',
      enough ? r.p95Ms > target : null, enough && r.p95Ms <= target * 0.8,
      `p95 exitosas: ${r.p95Ms == null ? 'sin datos' : r.p95Ms.toFixed(0) + ' ms'}; n exitosas=${r.successes}; objetivo provisional ${target} ms`,
      { route, reason: enough ? '' : 'Muestra insuficiente o logs atrasados', suppressedBy: ['api-down', 'logs-stale'] });
  }
  return signals;
}

export function reconcileSignals(signals, previous, now, policy) {
  const state = structuredClone(previous);
  const documents = [], events = [];
  const timestamp = now.toISOString();
  // Parent signals precede children, so correlation is deterministic.
  for (const s of signals) {
    const old = previous[s.id] || { active: false, breaches: 0, recoveries: 0, revision: 0 };
    const current = { ...old };
    current.breaches = s.breach === true ? old.breaches + 1 : 0;
    current.recoveries = s.recover === true ? old.recoveries + 1 : 0;
    if (!old.active && current.breaches >= (s.activationEvaluations ?? policy.activationEvaluations)) current.active = true;
    if (old.active && current.recoveries >= (s.recoveryEvaluations ?? policy.recoveryEvaluations)) current.active = false;
    const correlated = (s.suppressedBy || []).find((id) => state[id]?.active);
    const visible = current.active && !correlated;
    const wasVisible = old.visible ?? old.active;
    current.visible = visible;
    if (current.active !== old.active) current.changedAt = timestamp;
    const alert = {
      rule_id: s.id, title: s.title, priority: s.priority, priority_rank: Number(s.priority.slice(1)),
      owner: s.owner, action: s.action, route: s.route || 'Servicio completo', active: visible,
      status: correlated ? 'Correlacionada' : current.active ? 'Activa' : s.breach === null ? 'Sin datos suficientes' : current.breaches ? 'En observación' : 'Normal',
      evidence: [s.evidence, s.reason, correlated && `Relacionada con ${correlated}`].filter(Boolean).join(' | '),
      changed_at: current.changedAt || timestamp,
    };
    const doc = { '@timestamp': timestamp, service: { name: policy.serviceName }, alert };
    documents.push(doc);
    // Only transitions of visible alerts; stable IDs make retries idempotent.
    if (visible !== wasVisible) {
      current.revision = old.revision + 1;
      events.push({ ...doc, event: { id: `${s.id}:${current.revision}`, kind: 'alert' },
        alert: { ...alert, status: visible ? 'Activa' : correlated ? 'Correlacionada' : 'Recuperada' } });
    }
    state[s.id] = current;
  }
  return { state, documents, events };
}
