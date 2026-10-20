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
  assert.match(html, /OLAs/);
  assert.match(html, /N1 AM\/CS → N2 Tech → N3 proveedor/);
  assert.match(html, /Tech Lead → directora de Tech \/ CEO/);
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
