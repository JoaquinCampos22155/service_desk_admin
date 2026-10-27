const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadApp() {
  const appPath = path.join(__dirname, "..", "app.js");
  let source = fs.readFileSync(appPath, "utf8");
  source = source.replace(/\ndocument\.querySelector\("#today-label"\)\.textContent = [\s\S]*?;\s*render\(\);\s*$/, "");
  source += `
    globalThis.__testApi = {
      state,
      problemPatterns: typeof problemPatterns === "function" ? problemPatterns : null,
      renderProblems: typeof renderProblems === "function" ? renderProblems : null,
      renderTicketQueue: typeof renderTicketQueue === "function" ? renderTicketQueue : null,
      renderCatalog: typeof renderCatalog === "function" ? renderCatalog : null,
      renderServiceLevels: typeof renderServiceLevels === "function" ? renderServiceLevels : null,
      renderDashboard: typeof renderDashboard === "function" ? renderDashboard : null,
      buildTicketIntakeTrend: typeof buildTicketIntakeTrend === "function" ? buildTicketIntakeTrend : null,
      businessMinutesBetween: typeof businessMinutesBetween === "function" ? businessMinutesBetween : null,
      responseMetricsByPriority: typeof responseMetricsByPriority === "function" ? responseMetricsByPriority : null,
      activeTicketAgingBuckets: typeof activeTicketAgingBuckets === "function" ? activeTicketAgingBuckets : null,
      ticketCountsByCategory: typeof ticketCountsByCategory === "function" ? ticketCountsByCategory : null,
      calculatePriority: typeof calculatePriority === "function" ? calculatePriority : null,
      catalog: CATALOG,
      upsertProblemRecord: typeof upsertProblemRecord === "function" ? upsertProblemRecord : null,
      commentAuthorFor: typeof commentAuthorFor === "function" ? commentAuthorFor : null,
    };
  `;

  const elements = new Map([
    ["#app-content", { innerHTML: "" }],
    ["#page-crumb", { textContent: "" }],
  ]);
  const context = {
    document: {
      querySelector: (selector) => elements.get(selector) || null,
      querySelectorAll: () => [],
      body: { addEventListener() {} },
      addEventListener() {},
    },
    localStorage: { getItem: () => null, setItem() {} },
    console,
    Intl,
    Date,
    JSON,
    Map,
    Set,
    Object,
    Array,
    String,
    Number,
    Math,
    FormData,
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: appPath });
  return context.__testApi;
}

function incident(id, categoryId, priority, brand, reopenedCount = 0) {
  return { id, type: "Incidente", categoryId, priority, brand, reopenedCount, createdAt: "2026-10-01T12:00:00.000Z" };
}

test("maps incident patterns by priority, affected brands, reopenings, then volume", () => {
  const api = loadApp();
  assert.equal(typeof api.problemPatterns, "function", "the problem analysis must expose incident patterns");
  api.state.tickets = [
    incident("BV-1", "payment-without-order", "P1", "Marca A"),
    incident("BV-2", "payment-without-order", "P1", "Marca B"),
    incident("BV-3", "shipping-unavailable", "P1", "Marca A", 2),
    incident("BV-4", "shipping-unavailable", "P1", "Marca A", 1),
    incident("BV-5", "incorrect-inventory", "P2", "Marca A", 2),
    incident("BV-6", "incorrect-inventory", "P2", "Marca B", 1),
    incident("BV-7", "unprocessed-order", "P2", "Marca A", 1),
    incident("BV-8", "unprocessed-order", "P2", "Marca B"),
    incident("BV-9", "unprocessed-order", "P2", "Marca A"),
    { id: "BV-10", type: "Solicitud", categoryId: "new-store", priority: "P1", brand: "Marca D" },
  ];

  assert.deepEqual(Array.from(api.problemPatterns(), (pattern) => pattern.categoryId), [
    "payment-without-order",
    "shipping-unavailable",
    "incorrect-inventory",
    "unprocessed-order",
  ]);
});

test("marks repeated incidents and P1 incidents as candidates without labeling isolated low-priority cases", () => {
  const api = loadApp();
  assert.equal(typeof api.problemPatterns, "function", "the problem analysis must expose candidate detection");
  api.state.tickets = [
    incident("BV-1", "payment-without-order", "P1", "Marca A"),
    incident("BV-2", "shipping-unavailable", "P3", "Marca B"),
    incident("BV-3", "shipping-unavailable", "P3", "Marca C"),
    incident("BV-4", "incorrect-inventory", "P3", "Marca D"),
  ];

  assert.deepEqual(Array.from(api.problemPatterns(), (pattern) => [pattern.categoryId, pattern.isCandidate]), [
    ["payment-without-order", true],
    ["shipping-unavailable", true],
    ["incorrect-inventory", false],
  ]);
});

test("renders a problem map with related incident links and observed evidence", () => {
  const api = loadApp();
  assert.equal(typeof api.renderProblems, "function", "the service desk must render its problem analysis section");
  api.state.tickets = [incident("BV-91", "payment-without-order", "P1", "Marca A")];

  const html = api.renderProblems();
  assert.match(html, /Análisis de problemas/);
  assert.match(html, /BV-91/);
  assert.match(html, /por determinar/);
  assert.match(html, /Tickets relacionados/);
});

test("counts every ticket by catalog category while separating incidents and requests", () => {
  const api = loadApp();
  assert.equal(typeof api.ticketCountsByCategory, "function");
  const counts = api.ticketCountsByCategory([
    { categoryId: "payment-without-order", type: "Incidente" },
    { categoryId: "payment-without-order", type: "Incidente" },
    { categoryId: "payment-without-order", type: "Solicitud" },
    { categoryId: "new-store", type: "Solicitud" },
  ]);
  assert.equal(counts.length, 8);
  assert.deepEqual(Array.from(counts.slice(0, 2), (entry) => [entry.category.id, entry.incidents, entry.requests, entry.total]), [
    ["payment-without-order", 2, 1, 3],
    ["new-store", 0, 1, 1],
  ]);
  assert.equal(counts.filter((entry) => entry.total === 0).length, 6);
});

test("shows all-ticket category volume in the analysis view without changing the incident problem map", () => {
  const api = loadApp();
  api.state.tickets = [
    { id: "BV-91", type: "Incidente", categoryId: "payment-without-order", priority: "P1", status: "Nuevo", brand: "Marca A", createdAt: "2026-10-26T12:00:00Z" },
    { id: "BV-92", type: "Solicitud", categoryId: "payment-without-order", priority: "P3", status: "Cerrado", brand: "Marca A", createdAt: "2026-10-26T13:00:00Z" },
  ];
  const html = api.renderProblems();
  assert.match(html, /Tickets ingresados por categoría/);
  assert.match(html, /Incidente/);
  assert.match(html, /Solicitud/);
  assert.match(html, /Gráfico de todos los tickets agrupados por categoría/);
  assert.match(html, /BV-91/);
  assert.doesNotMatch(html, /BV-92/);
});

test("creates and updates a problem analysis record without changing its identifier", () => {
  const api = loadApp();
  assert.equal(typeof api.upsertProblemRecord, "function", "the problem analysis must be persistable");
  const initial = api.upsertProblemRecord({}, "payment-without-order", {
    status: "Investigando", owner: "Team de Tech", cause: "  Pendiente de RCA  ", workaround: "  Revisar el pago  ", permanentAction: "",
  }, ["BV-91"], "2026-10-20T10:00:00.000Z");
  assert.equal(initial["payment-without-order"].id, "PRB-001");
  assert.equal(initial["payment-without-order"].cause, "Pendiente de RCA");
  assert.deepEqual(Array.from(initial["payment-without-order"].relatedTicketIds), ["BV-91"]);

  const updated = api.upsertProblemRecord(initial, "payment-without-order", {
    status: "Error conocido", owner: "Team de Tech", cause: "Causa validada", workaround: "", permanentAction: "Corregir sincronización",
  }, ["BV-91", "BV-92"], "2026-10-21T10:00:00.000Z");
  assert.equal(updated["payment-without-order"].id, "PRB-001");
  assert.equal(updated["payment-without-order"].status, "Error conocido");
  assert.equal(updated["payment-without-order"].cause, "Causa validada");
  assert.deepEqual(Array.from(updated["payment-without-order"].relatedTicketIds), ["BV-91", "BV-92"]);
});

test("routes public ticket updates through AM or CS, not the technical assignee", () => {
  const api = loadApp();
  assert.equal(typeof api.commentAuthorFor, "function", "ticket updates must identify the communication owner");
  assert.equal(api.commentAuthorFor({ assignee: "Team de Tech", requesterType: "Marca" }, "Público"), "Account Management");
  assert.equal(api.commentAuthorFor({ assignee: "Proveedor externo", requesterType: "Consumidor" }, "Público"), "Customer Service");
  assert.equal(api.commentAuthorFor({ assignee: "Team de Tech", requesterType: "Marca" }, "Interno"), "Agente de soporte");
});

test("filters the support queue by selected priority", () => {
  const api = loadApp();
  assert.equal(typeof api.renderTicketQueue, "function");
  api.state.view = "tickets";
  api.state.typeFilter = "Todos";
  api.state.statusFilter = "Todos los estados";
  api.state.priorityFilter = "P1";
  api.state.tickets = [
    { id: "BV-P1", subject: "Caso prioritario", categoryId: "payment-without-order", type: "Incidente", priority: "P1", status: "Nuevo", brand: "Marca A", channel: "Portal de marca", assignee: "Account Management", createdAt: "2026-10-01T12:00:00.000Z", requesterName: "Equipo", requesterType: "Marca" },
    { id: "BV-P3", subject: "Caso planificable", categoryId: "shipping-rules", type: "Solicitud", priority: "P3", status: "Nuevo", brand: "Marca B", channel: "Portal de marca", assignee: "Account Management", createdAt: "2026-10-01T13:00:00.000Z", requesterName: "Equipo", requesterType: "Marca" },
  ];

  const html = api.renderTicketQueue();
  assert.match(html, /BV-P1/);
  assert.doesNotMatch(html, /BV-P3/);
});

test("calculates all nine impact and urgency combinations", () => {
  const api = loadApp();
  assert.equal(typeof api.calculatePriority, "function");
  const expected = {
    Alto: { Alta: "P1", Media: "P1", Baja: "P2" },
    Medio: { Alta: "P1", Media: "P2", Baja: "P3" },
    Bajo: { Alta: "P2", Media: "P3", Baja: "P3" },
  };
  for (const [impact, urgencyMap] of Object.entries(expected)) {
    for (const [urgency, priority] of Object.entries(urgencyMap)) {
      assert.equal(api.calculatePriority(impact, urgency), priority, `${impact}/${urgency}`);
    }
  }
});

test("keeps the phase-one catalog at four requests and four incidents", () => {
  const api = loadApp();
  assert.equal(api.catalog.filter((item) => item.type === "Solicitud").length, 4);
  assert.equal(api.catalog.filter((item) => item.type === "Incidente").length, 4);
  assert.match(api.renderCatalog(), /Account Management/);
  assert.match(api.renderCatalog(), /Customer Service/);
});

test("shows internal SLO, OLA, and separate escalation paths", () => {
  const html = loadApp().renderServiceLevels();
  assert.match(html, /SLO internos/);
  assert.match(html, /Acuerdos internos \(OLAs?\)/);
  assert.match(html, /N1 AM\/CS/);
  assert.match(html, /N2 Tech/);
  assert.match(html, /N3 proveedor/);
  assert.match(html, /Tech Lead/);
  assert.match(html, /dirección \/ CEO/);
});

test("compares requester origins and active priorities on the dashboard", () => {
  const api = loadApp();
  assert.equal(typeof api.renderDashboard, "function");
  api.state.tickets = [
    { id: "BV-1", type: "Incidente", categoryId: "payment-without-order", priority: "P1", status: "Nuevo", requesterType: "Marca", brand: "Marca A", assignee: "Account Management", createdAt: "2026-10-01T12:00:00.000Z" },
    { id: "BV-2", type: "Incidente", categoryId: "incorrect-inventory", priority: "P2", status: "En progreso", requesterType: "Consumidor", brand: "Marca A", assignee: "Customer Service", createdAt: "2026-10-01T13:00:00.000Z" },
    { id: "BV-3", type: "Solicitud", categoryId: "shipping-rules", priority: "P3", status: "Cerrado", requesterType: "Marca", brand: "Marca B", assignee: "Account Management", createdAt: "2026-10-01T14:00:00.000Z" },
  ];

  const html = api.renderDashboard();
  assert.match(html, /Origen de los tickets/);
  assert.match(html, /Marcas<\/span><strong>2<\/strong>/);
  assert.match(html, /Consumidores<\/span><strong>1<\/strong>/);
  assert.match(html, /Prioridad de la cola activa/);
  assert.match(html, /P1<\/span><strong>1<\/strong>/);
  assert.match(html, /P2<\/span><strong>1<\/strong>/);
  assert.match(html, /P3<\/span><strong>0<\/strong>/);
  assert.match(html, /Tickets activos/);
});

test("builds a seven-day incident and request intake trend including empty days", () => {
  const api = loadApp();
  assert.equal(typeof api.buildTicketIntakeTrend, "function");
  const now = new Date(2026, 9, 26, 12, 0, 0);
  const trend = api.buildTicketIntakeTrend([
    { type: "Incidente", createdAt: new Date(2026, 9, 26, 9).toISOString() },
    { type: "Solicitud", createdAt: new Date(2026, 9, 26, 10).toISOString() },
    { type: "Incidente", createdAt: new Date(2026, 9, 19, 23).toISOString() },
  ], now);
  assert.equal(trend.length, 7);
  assert.deepEqual(Array.from(trend, (day) => [day.incidents, day.requests]), [
    [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [1, 1],
  ]);
});

test("measures first response only in weekday operating hours and handles weekends", () => {
  const api = loadApp();
  assert.equal(typeof api.businessMinutesBetween, "function");
  assert.equal(api.businessMinutesBetween(new Date("2026-10-26T13:00:00Z"), new Date("2026-10-26T15:30:00Z")), 150);
  assert.equal(api.businessMinutesBetween("2026-10-26T11:00:00Z", "2026-10-26T23:00:00Z"), 540);
  assert.equal(api.businessMinutesBetween("2026-10-25T13:00:00Z", "2026-10-25T15:00:00Z"), 0);
  assert.equal(api.businessMinutesBetween(new Date("2026-10-23T20:00:00Z"), new Date("2026-10-26T14:30:00Z")), 210);
});

test("summarizes first-response p50/p95 and target attainment by priority", () => {
  const api = loadApp();
  assert.equal(typeof api.responseMetricsByPriority, "function");
  const metrics = api.responseMetricsByPriority([
    ...[10, 40, 120].map((minutes, index) => ({ priority: "P1", createdAt: new Date(Date.UTC(2026, 9, 26, 13, index)).toISOString(), firstResponseAt: new Date(Date.UTC(2026, 9, 26, 13, index) + minutes * 60_000).toISOString() })),
    { priority: "P2", createdAt: "2026-10-26T13:00:00.000Z", firstResponseAt: null },
  ]);
  assert.equal(metrics.P1.count, 3);
  assert.equal(metrics.P1.p50, 40);
  assert.equal(metrics.P1.p95, 112);
  assert.equal(metrics.P1.withinTarget, 1);
  assert.equal(metrics.P1.targetMinutes, 15);
  assert.equal(metrics.P2.count, 0);
});

test("groups active queue age by priority using elapsed clock time, excluding resolved and closed", () => {
  const api = loadApp();
  assert.equal(typeof api.activeTicketAgingBuckets, "function");
  const now = new Date("2026-10-26T12:00:00Z");
  const tickets = [
    { status: "Nuevo", priority: "P1", createdAt: new Date(now - 3 * 60 * 60_000).toISOString() },
    { status: "En progreso", priority: "P2", createdAt: new Date(now - 8 * 60 * 60_000).toISOString() },
    { status: "En espera", priority: "P3", createdAt: new Date(now - 2 * 24 * 60 * 60_000).toISOString() },
    { status: "Resuelto", priority: "P1", createdAt: new Date(now - 5 * 24 * 60 * 60_000).toISOString() },
    { status: "Cerrado", priority: "P2", createdAt: new Date(now - 5 * 24 * 60 * 60_000).toISOString() },
  ];
  const buckets = api.activeTicketAgingBuckets(tickets, now);
  assert.deepEqual(Array.from(buckets, (bucket) => [bucket.label, bucket.P1, bucket.P2, bucket.P3]), [
    ["<4 h", 1, 0, 0], ["4–24 h", 0, 1, 0], ["1–3 d", 0, 0, 1], [">3 d", 0, 0, 0],
  ]);
});

test("dashboard explains the decision and limits of its three monitoring charts", () => {
  const html = loadApp().renderDashboard();
  assert.match(html, /Entrada diaria de tickets/);
  assert.match(html, /class="legend-dot intake-incident"/);
  assert.match(html, /class="legend-dot intake-request"/);
  assert.match(html, /Primera respuesta por prioridad/);
  assert.match(html, /p50/);
  assert.match(html, /p95/);
  assert.match(html, /Antigüedad de la cola activa/);
  assert.match(html, /tiempo corrido/);
  assert.match(html, /no equivale.*incumplimiento/i);
  assert.match(html, /decisión/i);
});

test("keeps the dashboard concise without removing its operating rules or service navigation", () => {
  const api = loadApp();
  const html = api.renderDashboard();
  assert.equal((html.match(/class="metric-card"/g) || []).length, 3);
  assert.doesNotMatch(html, /Prioridad crítica/);
  assert.doesNotMatch(html, /Un solo registro, dos tipos de demanda/);
  assert.match(html, /Incidente = restaurar/i);
  assert.match(html, /solicitud = cumplir/i);
  assert.match(html, /Account Management y Customer Service comunican avances/i);
  assert.match(html, /data-view="catalog"/);
  assert.match(api.renderServiceLevels(), /Niveles de servicio/);
});

test("shows all-ticket active, resolved, and closed counts with distinct meanings", () => {
  const api = loadApp();
  api.state.view = "tickets";
  api.state.statusFilter = "Resuelto";
  api.state.tickets = [
    { id: "BV-1", type: "Incidente", categoryId: "payment-without-order", priority: "P1", status: "En progreso", brand: "Marca A", channel: "Portal", assignee: "Tech", createdAt: "2026-10-01T12:00:00.000Z" },
    { id: "BV-2", type: "Incidente", categoryId: "incorrect-inventory", priority: "P2", status: "Resuelto", brand: "Marca B", channel: "Correo", assignee: "CS", createdAt: "2026-10-01T13:00:00.000Z" },
    { id: "BV-3", type: "Solicitud", categoryId: "shipping-rules", priority: "P3", status: "Cerrado", brand: "Marca C", channel: "Portal", assignee: "AM", createdAt: "2026-10-01T14:00:00.000Z" },
  ];

  const html = api.renderTicketQueue();
  assert.match(html, /Estado de todos los tickets/);
  assert.match(html, /Activos<\/span><strong>1<\/strong>/);
  assert.match(html, /Resueltos<\/span><strong>1<\/strong>/);
  assert.match(html, /Cerrados<\/span><strong>1<\/strong>/);
  assert.match(html, /BV-2/);
  assert.doesNotMatch(html, /BV-1|BV-3/);
  assert.match(html, /<strong>Resuelto<\/strong> significa solución aplicada/);
  assert.match(html, /<strong>Cerrado<\/strong> significa caso validado y finalizado/);
});

test("explains improvement indicators, targets, formulas, data coverage, and unmeasurable KPIs", () => {
  const html = loadApp().renderServiceLevels();
  assert.match(html, /Primera respuesta dentro del objetivo/);
  assert.match(html, /≥ 95%/);
  assert.match(html, /casos dentro del objetivo ÷ casos con respuesta registrada/i);
  assert.match(html, /Resolución en primer contacto/);
  assert.match(html, /No medible aún/);
  assert.match(html, /satisfacción/i);
  assert.match(html, /reaperturas/);
  assert.match(html, /Muestra de demostración/);
});

test("uses the navy, black, white, and cyan brand palette without emoji presentation glyphs", () => {
  const root = path.join(__dirname, "..");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const interfaceSource = ["app.js", "index.html", "styles.css"].map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  assert.match(css, /--brand-navy:\s*#[0-9a-f]{6}/i);
  assert.match(css, /--brand-black:\s*#[0-9a-f]{6}/i);
  assert.match(css, /--brand-cyan:\s*#[0-9a-f]{6}/i);
  assert.match(css, /--brand-blue:\s*#[0-9a-f]{6}/i);
  assert.match(html, /name="theme-color" content="#0a1930"/i);
  assert.doesNotMatch(interfaceSource, /\p{Emoji_Presentation}/u);
});
