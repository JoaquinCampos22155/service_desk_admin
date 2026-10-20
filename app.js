"use strict";

const STORAGE_KEY = "bevstack-service-desk-v1";
const PROBLEM_STORAGE_KEY = "bevstack-service-desk-problems-v1";
const STATUSES = ["Nuevo", "En triage", "En progreso", "En espera", "Escalado", "Resuelto", "Cerrado"];
const ASSIGNEES = ["Account Management", "Customer Service", "Team de Tech", "Directora de Tech", "Proveedor externo"];
const PRIORITY_RULES = {
  Alto: { Alta: "P1", Media: "P1", Baja: "P2" },
  Medio: { Alta: "P1", Media: "P2", Baja: "P3" },
  Bajo: { Alta: "P2", Media: "P3", Baja: "P3" },
};
const PRIORITY_TARGETS = {
  P1: { response: "15 min", resolution: "4 h" },
  P2: { response: "1 h", resolution: "24 h" },
  P3: { response: "4 h", resolution: "3 días hábiles" },
};
const CATALOG = [
  { id: "new-store", name: "Activación de una nueva tienda", type: "Solicitud", owner: "Account Management", reporter: "Equipo de e-commerce u operaciones de la marca", description: "Incorporar una tienda al servicio y dejarla lista para operar pedidos." },
  { id: "shipping-rules", name: "Cambio en reglas de envío", type: "Solicitud", owner: "Account Management", reporter: "Equipo de e-commerce u operaciones de la marca", description: "Modificar cobertura, tarifas o condiciones de envío de la tienda." },
  { id: "product-config", name: "Actualización de configuración de productos", type: "Solicitud", owner: "Account Management", reporter: "Equipo de e-commerce u operaciones de la marca", description: "Modificar información operativa de productos que afecta su venta o cumplimiento." },
  { id: "operational-config", name: "Cambio de configuración operativa", type: "Solicitud", owner: "Account Management", reporter: "Responsable autorizado de la marca", description: "Ajustar parámetros de la tienda relacionados con su operación diaria." },
  { id: "unprocessed-order", name: "Pedido no procesado", type: "Incidente", owner: "Account Management / Customer Service", reporter: "Operaciones, e-commerce o atención al cliente", description: "Una compra se realizó, pero el pedido no avanzó correctamente hacia su procesamiento." },
  { id: "incorrect-inventory", name: "Inventario incorrecto", type: "Incidente", owner: "Account Management / Customer Service", reporter: "Operaciones, e-commerce o consumidor vía Customer Service", description: "La disponibilidad mostrada no coincide con el inventario esperado para el producto." },
  { id: "payment-without-order", name: "Pago completado sin creación del pedido", type: "Incidente", owner: "Customer Service / Team de Tech", reporter: "Operaciones, e-commerce o consumidor vía Customer Service", description: "El pago se registró, pero la orden correspondiente no aparece correctamente en la operación." },
  { id: "shipping-unavailable", name: "Opción de envío no disponible", type: "Incidente", owner: "Account Management / Customer Service", reporter: "Operaciones, e-commerce o consumidor vía Customer Service", description: "No se puede utilizar una opción de envío que debería estar habilitada para el pedido." },
];

const state = {
  view: "dashboard",
  typeFilter: "Todos",
  search: "",
  statusFilter: "Todos los estados",
  priorityFilter: "Todas las prioridades",
  selectedTicketId: null,
  tickets: loadTickets(),
  problemRecords: loadProblemRecords(),
};

const appContent = document.querySelector("#app-content");
const pageCrumb = document.querySelector("#page-crumb");

function isoAgo(minutes) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function seedTickets() {
  const seed = [
    ["BV-1048", "Pago confirmado, pero el pedido no aparece", "payment-without-order", "Incidente", "Alto", "Alta", "En progreso", "Customer Service", "Portal de marca", "Nébula Spirits", "ORD-78421", 32, "El cliente recibió confirmación del cobro. La orden no aparece en el panel de operaciones y hay tres consumidores afectados.", ["Validamos el cobro y estamos revisando la sincronización de órdenes."]],
    ["BV-1047", "La tienda no procesa pedidos desde esta mañana", "unprocessed-order", "Incidente", "Alto", "Alta", "Escalado", "Team de Tech", "Portal de marca", "Casa Nómada", "", 54, "El flujo de compra falla para varias marcas; el problema empezó después de una actualización del proveedor.", ["AM registró el caso y notificó a Tech. Se abrió seguimiento con el proveedor."]],
    ["BV-1046", "Agregar cobertura de envío para zona 12", "shipping-rules", "Solicitud", "Medio", "Baja", "En triage", "Account Management", "Portal de marca", "Altura Gin", "", 145, "Solicitamos habilitar la zona 12 a partir del próximo lunes. Las tarifas existentes se mantienen.", ["Recibimos la solicitud. Validaremos la cobertura y la fecha solicitada."]],
    ["BV-1045", "Disponibilidad de producto no coincide con inventario", "incorrect-inventory", "Incidente", "Medio", "Alta", "En espera", "Team de Tech", "Correo de Customer Service", "Nébula Spirits", "ORD-78396", 205, "El producto aparece disponible en la tienda, pero el retailer reporta inventario agotado.", ["CS confirmó la discrepancia. Estamos esperando la confirmación del feed de inventario."]],
    ["BV-1044", "Preparar una nueva tienda para el lanzamiento", "new-store", "Solicitud", "Bajo", "Baja", "En progreso", "Account Management", "Portal de marca", "Fuego Norte", "", 370, "Activar la tienda de Fuego Norte antes de la campaña del próximo mes. Credenciales entregadas.", ["Checklist de onboarding iniciado; faltan validar reglas de envío."]],
    ["BV-1043", "No aparece el envío express en el checkout", "shipping-unavailable", "Incidente", "Medio", "Alta", "Nuevo", "Customer Service", "Correo de Customer Service", "Casa Nómada", "ORD-78122", 520, "Una persona consumidora no puede elegir envío express aunque el destino está dentro de cobertura.", []],
    ["BV-1042", "Actualizar datos operativos de dos productos", "product-config", "Solicitud", "Bajo", "Media", "Cerrado", "Account Management", "Portal de marca", "Altura Gin", "", 1440, "Actualizar descripción y contenido de dos productos antes de publicarlos.", ["Cambios aplicados y confirmados por la marca."]],
    ["BV-1041", "Modificar horario de corte de pedidos", "operational-config", "Solicitud", "Medio", "Baja", "Resuelto", "Account Management", "Portal de marca", "Nébula Spirits", "", 1950, "Cambiar el horario operativo de corte de pedidos de lunes a viernes.", ["Se actualizó la configuración y se verificó con la marca."]],
    ["BV-1040", "Orden cobrada dos veces durante el checkout", "payment-without-order", "Incidente", "Alto", "Media", "En progreso", "Team de Tech", "Correo de Customer Service", "Fuego Norte", "ORD-77804", 2380, "El consumidor reporta dos cargos para una sola compra. CS está coordinando la comunicación.", ["CS solicitó los comprobantes. Tech está revisando los eventos de pago."]],
    ["BV-1039", "Revisar reglas de envío para temporada alta", "shipping-rules", "Solicitud", "Bajo", "Baja", "Cerrado", "Account Management", "Portal de marca", "Casa Nómada", "", 2870, "Ajuste programado de tarifas para temporada alta, sujeto a aprobación de la marca.", ["Solicitud completada dentro del plazo acordado."]],
  ];
  return seed.map((row, index) => ({
    id: row[0], subject: row[1], categoryId: row[2], type: row[3], impact: row[4], urgency: row[5], priority: PRIORITY_RULES[row[4]][row[5]], status: row[6], assignee: row[7], communicationOwner: row[8].includes("Customer Service") ? "Customer Service" : "Account Management", channel: row[8], brand: row[9], orderId: row[10], createdAt: isoAgo(row[11]), updatedAt: isoAgo(Math.max(5, row[11] - 10)), description: row[12], requesterType: row[8].includes("Customer Service") ? "Consumidor" : "Marca", requesterName: row[8].includes("Customer Service") ? "Persona consumidora" : `Equipo de ${row[9]}`, requesterEmail: row[8].includes("Customer Service") ? "consumidor@example.com" : `operaciones@${slugify(row[9])}.com`, comments: row[13].map((content, commentIndex) => ({ id: `${row[0]}-C${commentIndex}`, author: row[8].includes("Customer Service") ? "Customer Service" : "Account Management", body: content, visibility: "Público", createdAt: isoAgo(Math.max(1, row[11] - 8)) })), firstResponseAt: index < 8 ? isoAgo(Math.max(1, row[11] - 8)) : null, resolvedAt: ["Resuelto", "Cerrado"].includes(row[6]) ? isoAgo(Math.max(1, row[11] - 3)) : null, reopenedCount: 0 }));
}

function loadTickets() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.warn("No se pudo leer el almacenamiento local de la demo.", error);
  }
  const seeded = seedTickets();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function loadProblemRecords() {
  try {
    const saved = localStorage.getItem(PROBLEM_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.warn("No se pudo leer el registro de problemas de la demo.", error);
  }
  return {};
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tickets));
  updateNavCounts();
}

function persistProblemRecords() {
  localStorage.setItem(PROBLEM_STORAGE_KEY, JSON.stringify(state.problemRecords));
  updateNavCounts();
}

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function formatDate(value, options = {}) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short", ...options }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function timeAgo(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
}

function categoryById(id) {
  return CATALOG.find((category) => category.id === id) || CATALOG[0];
}

function calculatePriority(impact, urgency) {
  return PRIORITY_RULES[impact]?.[urgency] || "P3";
}

function statusClass(status) {
  return ({ "Nuevo": "new", "En triage": "triage", "En progreso": "progress", "En espera": "waiting", "Escalado": "triage", "Resuelto": "resolved", "Cerrado": "closed" })[status] || "";
}

function priorityPill(priority) {
  return `<span class="priority-pill ${priority.toLowerCase()}">${escapeHTML(priority)}</span>`;
}

function statusPill(status) {
  return `<span class="status-pill ${statusClass(status)}">${escapeHTML(status)}</span>`;
}

function typePill(type) {
  const isIncident = type === "Incidente";
  return `<span class="type-pill ${isIncident ? "incident" : "request"}">${isIncident ? "◉" : "◇"} ${escapeHTML(type)}</span>`;
}

function updateNavCounts() {
  const total = document.querySelector("#nav-total");
  const incidents = document.querySelector("#nav-incidents");
  const requests = document.querySelector("#nav-requests");
  const problems = document.querySelector("#nav-problems");
  if (total) total.textContent = state.tickets.filter((ticket) => !["Cerrado", "Resuelto"].includes(ticket.status)).length;
  if (incidents) incidents.textContent = state.tickets.filter((ticket) => ticket.type === "Incidente" && !["Cerrado", "Resuelto"].includes(ticket.status)).length;
  if (requests) requests.textContent = state.tickets.filter((ticket) => ticket.type === "Solicitud" && !["Cerrado", "Resuelto"].includes(ticket.status)).length;
  if (problems) problems.textContent = problemPatterns().filter((pattern) => pattern.isCandidate && pattern.record.status !== "Resuelto").length;
}

function sortedTickets(tickets) {
  const rank = { P1: 1, P2: 2, P3: 3 };
  return [...tickets].sort((a, b) => rank[a.priority] - rank[b.priority] || new Date(a.createdAt) - new Date(b.createdAt));
}

function problemPatterns() {
  const grouped = new Map();
  state.tickets.filter((ticket) => ticket.type === "Incidente").forEach((ticket) => {
    if (!grouped.has(ticket.categoryId)) grouped.set(ticket.categoryId, []);
    grouped.get(ticket.categoryId).push(ticket);
  });
  const priorityRank = { P1: 1, P2: 2, P3: 3 };
  return [...grouped.entries()].map(([categoryId, tickets]) => {
    const priorities = { P1: 0, P2: 0, P3: 0 };
    tickets.forEach((ticket) => { priorities[ticket.priority] = (priorities[ticket.priority] || 0) + 1; });
    return {
      categoryId,
      category: categoryById(categoryId),
      tickets: sortedTickets(tickets),
      count: tickets.length,
      p1Count: priorities.P1,
      brands: [...new Set(tickets.map((ticket) => ticket.brand).filter(Boolean))],
      reopenedCount: tickets.reduce((total, ticket) => total + (ticket.reopenedCount || 0), 0),
      priority: priorities.P1 ? "P1" : priorities.P2 ? "P2" : "P3",
      isCandidate: tickets.length >= 2 || priorities.P1 > 0,
      record: state.problemRecords[categoryId] || {},
    };
  }).sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || b.brands.length - a.brands.length || b.reopenedCount - a.reopenedCount || b.count - a.count);
}

function upsertProblemRecord(records, categoryId, values, relatedTicketIds, now) {
  const existing = records[categoryId] || {};
  const nextSequence = Math.max(0, ...Object.values(records).map((record) => Number(record.id?.match(/\d+$/)?.[0] || 0))) + 1;
  return {
    ...records,
    [categoryId]: {
      ...existing,
      id: existing.id || `PRB-${String(nextSequence).padStart(3, "0")}`,
      categoryId,
      status: values.status,
      owner: values.owner,
      cause: (values.cause || "").trim(),
      workaround: (values.workaround || "").trim(),
      permanentAction: (values.permanentAction || "").trim(),
      relatedTicketIds: [...relatedTicketIds],
      updatedAt: now,
    },
  };
}

function commentAuthorFor(ticket, visibility) {
  if (visibility === "Interno") return "Agente de soporte";
  return ticket.communicationOwner || (ticket.requesterType === "Consumidor" ? "Customer Service" : "Account Management");
}

function openTickets() {
  return state.tickets.filter((ticket) => !["Resuelto", "Cerrado"].includes(ticket.status));
}

function viewTitle(view) {
  return ({ dashboard: "Resumen", tickets: "Todos los tickets", incidents: "Cola de incidentes", requests: "Cola de solicitudes", problems: "Análisis de problemas", catalog: "Catálogo del servicio", "service-levels": "Niveles de servicio" })[view] || "Resumen";
}

function render() {
  pageCrumb.textContent = viewTitle(state.view);
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view));
  updateNavCounts();
  if (state.view === "dashboard") appContent.innerHTML = renderDashboard();
  else if (["tickets", "incidents", "requests"].includes(state.view)) appContent.innerHTML = renderTicketQueue();
  else if (state.view === "problems") appContent.innerHTML = renderProblems();
  else if (state.view === "catalog") appContent.innerHTML = renderCatalog();
  else if (state.view === "service-levels") appContent.innerHTML = renderServiceLevels();
}

function renderDashboard() {
  const active = openTickets();
  const incidents = active.filter((ticket) => ticket.type === "Incidente");
  const requests = active.filter((ticket) => ticket.type === "Solicitud");
  const p1 = active.filter((ticket) => ticket.priority === "P1");
  const open = sortedTickets(active).slice(0, 5);
  const categoryCounts = CATALOG.map((category) => ({
    ...category,
    incidents: state.tickets.filter((ticket) => ticket.categoryId === category.id && ticket.type === "Incidente").length,
    requests: state.tickets.filter((ticket) => ticket.categoryId === category.id && ticket.type === "Solicitud").length,
  })).sort((a, b) => b.incidents + b.requests - a.incidents - a.requests);
  const chartMax = Math.max(1, ...categoryCounts.map((category) => category.incidents + category.requests));
  return `
    <div class="page-heading"><div><div class="eyebrow">Vista de operación · ${formatDate(new Date().toISOString(), { year: "numeric" })}</div><h1>Buenos días, equipo</h1><p class="page-subtitle">Una vista clara de lo que necesita atención y quién lo está atendiendo.</p></div><button class="primary-button" data-action="new-ticket"><span>＋</span> Crear ticket</button></div>
    <section class="metric-grid" aria-label="Resumen de tickets">
      ${metricCard("Tickets activos", active.length, "Casos pendientes de atención", "▤", "green")}
      ${metricCard("Incidentes", incidents.length, "Cola de restauración", "◉", "red")}
      ${metricCard("Solicitudes", requests.length, "Cola de cumplimiento", "◇", "amber")}
      ${metricCard("Prioridad crítica", p1.length, "Incidentes y solicitudes P1", "↗", "blue")}
    </section>
    <section class="dashboard-grid">
      <div class="panel"><div class="panel-heading"><div><h2>Tickets registrados por categoría</h2><p>Conteo de todos los casos guardados; los segmentos separan incidentes y solicitudes.</p></div><div class="chart-legend"><span><i class="legend-dot"></i>Incidente</span><span><i class="legend-dot request"></i>Solicitud</span></div></div>
        ${categoryCounts.length ? `<div class="category-chart" role="img" aria-label="Gráfico de tickets registrados agrupados por categoría">${categoryCounts.map((category) => {
    const total = category.incidents + category.requests;
    const scale = total / chartMax * 100;
    const incidentWidth = total ? category.incidents / total * 100 : 0;
    const requestWidth = total ? category.requests / total * 100 : 0;
    return `<div class="chart-row"><span class="chart-label" title="${escapeHTML(category.name)}">${escapeHTML(category.name)}</span><div class="chart-track"><div class="chart-bar" style="width:${scale}%"><span class="incident-part" style="width:${incidentWidth}%"></span><span class="request-part" style="width:${requestWidth}%"></span></div></div><span class="chart-value">${total}</span></div>`;
  }).join("")}</div>` : `<div class="chart-empty">No hay tickets activos para graficar.</div>`}
      </div>
      <div class="panel"><div class="panel-heading"><div><h2>Atención prioritaria</h2><p>Primero los casos de mayor impacto y urgencia.</p></div><button class="panel-action" data-view="tickets">Ver cola →</button></div>
        <div class="priority-list">${open.length ? open.map((ticket) => `<div class="priority-item" data-ticket-id="${escapeHTML(ticket.id)}"> <span class="priority-number ${ticket.priority.toLowerCase()}">${escapeHTML(ticket.priority)}</span><span class="priority-copy"><strong>${escapeHTML(ticket.subject)}</strong><small>${escapeHTML(ticket.brand)} · ${escapeHTML(ticket.assignee)}</small></span><span class="priority-age">${timeAgo(ticket.createdAt)}</span></div>`).join("") : `<div class="empty-state"><strong>Todo al día</strong>No hay casos pendientes de atención.</div>`}</div>
      </div>
    </section>
    <section class="panel"><div class="panel-heading"><div><h2>Un solo registro, dos tipos de demanda</h2><p>El Service Desk centraliza los casos; cada cola protege su propio objetivo.</p></div><button class="panel-action" data-view="catalog">Explorar catálogo →</button></div>
      <div class="queue-strip"><div class="queue-chip"><span>Incidentes · objetivo</span><strong>Restaurar</strong></div><div class="queue-chip"><span>Solicitudes · objetivo</span><strong>Cumplir</strong></div><div class="queue-chip"><span>Modelo de atención</span><strong>Virtual · N1 → N2 → N3</strong></div></div>
    </section>`;
}

function metricCard(label, value, foot, icon, color) {
  return `<div class="metric-card"><div class="metric-head"><span>${escapeHTML(label)}</span><span class="metric-icon ${color}">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-foot">${escapeHTML(foot)}</div></div>`;
}

function renderTicketQueue() {
  const selectedType = state.view === "incidents" ? "Incidente" : state.view === "requests" ? "Solicitud" : state.typeFilter;
  const base = state.tickets.filter((ticket) => (selectedType === "Todos" || ticket.type === selectedType) && (state.statusFilter === "Todos los estados" || ticket.status === state.statusFilter) && (state.priorityFilter === "Todas las prioridades" || ticket.priority === state.priorityFilter));
  const filtered = sortedTickets(base.filter((ticket) => {
    const needle = state.search.trim().toLocaleLowerCase("es");
    const category = categoryById(ticket.categoryId).name;
    return !needle || [ticket.id, ticket.subject, ticket.brand, ticket.assignee, category, ticket.orderId].some((value) => String(value || "").toLocaleLowerCase("es").includes(needle));
  }));
  const pageTitle = state.view === "incidents" ? "Incidentes" : state.view === "requests" ? "Solicitudes de servicio" : "Todos los tickets";
  const subtitle = state.view === "incidents" ? "Restaurar una operación interrumpida o degradada." : state.view === "requests" ? "Cumplir acciones acordadas, repetibles y planificables." : "El registro único del Service Desk, organizado en colas distintas.";
  const counts = { all: base.length, incidents: base.filter((ticket) => ticket.type === "Incidente").length, requests: base.filter((ticket) => ticket.type === "Solicitud").length };
  return `<div class="page-heading"><div><div class="eyebrow">Operación · Bandeja de trabajo</div><h1>${pageTitle}</h1><p class="page-subtitle">${subtitle}</p></div><button class="primary-button" data-action="new-ticket"><span>＋</span> Crear ticket</button></div>
    <section class="ticket-panel"><div class="ticket-panel-head"><div><h2>Registro de casos</h2><p>Ordenado por prioridad; P1 aparece antes que P2 y P3.</p></div><div class="table-tools"><label class="search-box"><span class="sr-only">Buscar tickets</span><input id="ticket-search" type="search" placeholder="Buscar por ticket, marca o pedido" value="${escapeHTML(state.search)}" /></label><select class="filter-select" id="priority-filter" aria-label="Filtrar por prioridad"><option ${state.priorityFilter === "Todas las prioridades" ? "selected" : ""}>Todas las prioridades</option>${["P1", "P2", "P3"].map((priority) => `<option ${state.priorityFilter === priority ? "selected" : ""}>${priority}</option>`).join("")}</select><select class="filter-select" id="status-filter" aria-label="Filtrar por estado"><option ${state.statusFilter === "Todos los estados" ? "selected" : ""}>Todos los estados</option>${STATUSES.map((status) => `<option ${state.statusFilter === status ? "selected" : ""}>${status}</option>`).join("")}</select></div></div>
    <div class="queue-tabs" role="tablist"><button class="queue-tab ${selectedType === "Todos" ? "active" : ""}" data-type-filter="Todos">Todos<span>${counts.all}</span></button><button class="queue-tab ${selectedType === "Incidente" ? "active" : ""}" data-type-filter="Incidente">Incidentes<span>${counts.incidents}</span></button><button class="queue-tab ${selectedType === "Solicitud" ? "active" : ""}" data-type-filter="Solicitud">Solicitudes<span>${counts.requests}</span></button></div>
    <div class="ticket-table-wrap"><table class="ticket-table"><thead><tr><th>Ticket</th><th>Tipo / categoría</th><th>Marca y canal</th><th>Prioridad</th><th>Estado</th><th>Responsable</th><th>Creado</th></tr></thead><tbody>${filtered.length ? filtered.map(ticketRow).join("") : `<tr><td colspan="7" class="table-empty">No hay tickets que coincidan con estos filtros.</td></tr>`}</tbody></table></div></section>
    <div class="queue-strip"><div class="queue-chip"><span>Incidentes activos</span><strong>${openTickets().filter((ticket) => ticket.type === "Incidente").length}</strong></div><div class="queue-chip"><span>Solicitudes activas</span><strong>${openTickets().filter((ticket) => ticket.type === "Solicitud").length}</strong></div><div class="queue-chip"><span>Tickets en espera</span><strong>${openTickets().filter((ticket) => ticket.status === "En espera").length}</strong></div></div>`;
}

function ticketRow(ticket) {
  const category = categoryById(ticket.categoryId);
  return `<tr data-ticket-id="${escapeHTML(ticket.id)}"><td><span class="ticket-number">${escapeHTML(ticket.id)}</span><div class="ticket-subject"><strong>${escapeHTML(ticket.subject)}</strong><small>${ticket.orderId ? `Pedido ${escapeHTML(ticket.orderId)}` : `${escapeHTML(ticket.requesterName)} · ${escapeHTML(ticket.requesterType)}`}</small></div></td><td>${typePill(ticket.type)}<div class="ticket-id">${escapeHTML(category.name)}</div></td><td><strong>${escapeHTML(ticket.brand)}</strong><div class="ticket-id">${escapeHTML(ticket.channel)}</div></td><td>${priorityPill(ticket.priority)}</td><td>${statusPill(ticket.status)}</td><td>${escapeHTML(ticket.assignee)}</td><td>${formatDate(ticket.createdAt)}</td></tr>`;
}

function renderCatalog() {
  const requests = CATALOG.filter((item) => item.type === "Solicitud");
  const incidents = CATALOG.filter((item) => item.type === "Incidente");
  return `<div class="page-heading"><div><div class="eyebrow">Gestión del servicio · 8 elementos</div><h1>Catálogo del servicio</h1><p class="page-subtitle">Qué puede solicitar o reportar cada usuario y quién lo atiende.</p></div><button class="primary-button" data-action="new-ticket"><span>＋</span> Crear ticket</button></div>
    <div class="section-note"><strong>Un punto de contacto:</strong> las marcas usan Account Management; Customer Service registra los casos de consumidores recibidos por los canales de la marca. Toda la demanda termina en el mismo registro.</div>
    <div class="panel-heading"><div><h2>Solicitudes de servicio <span class="nav-count">${requests.length}</span></h2><p>Acciones previstas: el objetivo es cumplirlas dentro del plazo acordado.</p></div></div><div class="catalog-grid">${requests.map(catalogCard).join("")}</div>
    <div class="panel-heading" style="margin-top:25px"><div><h2>Incidentes <span class="nav-count">${incidents.length}</span></h2><p>Fallas no planificadas: el objetivo es restaurar el servicio afectado.</p></div></div><div class="catalog-grid">${incidents.map(catalogCard).join("")}</div>`;
}

function catalogCard(item) {
  return `<article class="catalog-card"><div class="catalog-card-top"><span class="type-label ${item.type === "Incidente" ? "incident" : "request"}">${item.type}</span><span class="ticket-id">${item.type === "Incidente" ? "Restaurar" : "Cumplir"}</span></div><h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.description)}</p><div class="catalog-owner"><span>Reporta:</span><strong>${escapeHTML(item.reporter)}</strong></div><div class="catalog-owner" style="margin-top:7px;padding-top:0;border-top:0"><span>Primera atención:</span><strong>${escapeHTML(item.owner)}</strong></div></article>`;
}

function renderProblems() {
  const patterns = problemPatterns();
  const candidates = patterns.filter((pattern) => pattern.isCandidate);
  const totalIncidents = patterns.reduce((total, pattern) => total + pattern.count, 0);
  const chartMax = Math.max(1, ...patterns.map((pattern) => pattern.count));
  return `<div class="page-heading"><div><div class="eyebrow">Mejora continua · análisis basado en tickets</div><h1>Análisis de problemas</h1><p class="page-subtitle">Agrupa incidentes por categoría, enlaza sus casos y documenta la investigación de recurrencias.</p></div><button class="primary-button" data-view="incidents">Abrir cola de incidentes →</button></div>
    <div class="section-note"><strong>Lectura responsable:</strong> el patrón por categoría es una señal para investigar, no una causa raíz confirmada. Orden provisional: prioridad, marcas afectadas, reaperturas y volumen. Un patrón con dos o más incidentes o algún P1 se marca para investigación; ambos criterios deben validarse con Bevstack.</div>
    <section class="metric-grid" aria-label="Resumen del análisis de problemas">
      ${metricCard("Incidentes analizados", totalIncidents, "Todos los incidentes registrados", "◉", "red")}
      ${metricCard("Patrones candidatos", candidates.length, "Dos o más casos o algún P1", "⌕", "blue")}
      ${metricCard("Marcas afectadas", new Set(patterns.flatMap((pattern) => pattern.brands)).size, "Marcas distintas en los casos", "▤", "green")}
      ${metricCard("Casos reabiertos", patterns.reduce((total, pattern) => total + pattern.reopenedCount, 0), "Señal para revisar recurrencia", "↻", "amber")}
    </section>
    <section class="dashboard-grid problem-analysis-grid">
      <div class="panel"><div class="panel-heading"><div><h2>Incidentes por patrón de categoría</h2><p>Volumen observado; P1 se muestra aparte.</p></div></div>
        ${patterns.length ? `<div class="problem-chart" role="img" aria-label="Gráfico de incidentes agrupados por categoría">${patterns.map((pattern) => `<div class="problem-chart-row"><span class="chart-label" title="${escapeHTML(pattern.category.name)}">${escapeHTML(pattern.category.name)}</span><div class="chart-track"><div class="problem-chart-bar" style="width:${pattern.count / chartMax * 100}%"></div></div><strong class="chart-value">${pattern.count}</strong><span class="problem-p1-count">${pattern.p1Count} P1</span></div>`).join("")}</div>` : `<div class="empty-state"><strong>Aún no hay incidentes</strong>Al registrarlos, el análisis agrupará patrones por categoría.</div>`}
      </div>
      <div class="panel problem-method"><div class="panel-heading"><div><h2>De incidente a problema</h2><p>Investigar causa y evitar que los síntomas vuelvan a ocurrir.</p></div></div><ol><li>Detectar recurrencia, prioridad, marcas y reaperturas.</li><li>Relacionar los tickets del patrón.</li><li>Investigar la causa con Tech y registrar workaround.</li><li>Documentar solución permanente y comprobar que no se repita.</li></ol><div class="problem-cause-note"><strong>Sin evidencia, no se atribuye causa:</strong> cada análisis inicia pendiente de investigación.</div></div>
    </section>
    <section class="ticket-panel problem-register"><div class="ticket-panel-head"><div><h2>Mapa de patrones y seguimiento</h2><p>Tickets vinculados, prioridad, marcas, reaperturas y estado de investigación.</p></div></div>
      ${patterns.length ? `<div class="ticket-table-wrap"><table class="ticket-table"><thead><tr><th>Patrón / categoría</th><th>Tickets relacionados</th><th>Prioridad / marcas</th><th>Casos / reaperturas</th><th>Investigación</th><th>Responsable</th><th></th></tr></thead><tbody>${patterns.map((pattern) => {
    const record = pattern.record;
    const related = pattern.tickets.map((ticket) => `<button class="problem-ticket-link" data-ticket-id="${escapeHTML(ticket.id)}">${escapeHTML(ticket.id)}</button>`).join(" ");
    return `<tr><td><strong>${escapeHTML(pattern.category.name)}</strong><div class="ticket-id">${pattern.isCandidate ? "Candidato a problema" : "Incidente observado"}</div></td><td>${related || "—"}</td><td>${priorityPill(pattern.priority)}<div class="ticket-id">${pattern.brands.length} marca(s) · ${pattern.p1Count} P1</div></td><td><strong>${pattern.count}</strong><div class="ticket-id">${pattern.reopenedCount} reapertura(s)</div></td><td><span class="status-pill ${record.status ? statusClass(record.status) : "waiting"}">${escapeHTML(record.status || "Pendiente de investigación")}</span><div class="ticket-id">Causa: ${escapeHTML(record.cause || "por determinar")}</div></td><td>${escapeHTML(record.owner || "Team de Tech")}</td><td><button class="quiet-button" data-action="analyze-problem" data-category-id="${escapeHTML(pattern.categoryId)}">${record.status ? "Actualizar análisis" : "Documentar"}</button></td></tr>`;
  }).join("")}</tbody></table></div>` : `<div class="empty-state"><strong>Sin patrones para mapear</strong>El análisis se actualizará cuando se registren incidentes.</div>`}
    </section>`;
}

function renderServiceLevels() {
  const priorityRows = ["P1", "P2", "P3"].map((priority) => `<tr><td><strong>${priority}</strong></td><td>${PRIORITY_TARGETS[priority].response}</td><td>${PRIORITY_TARGETS[priority].resolution}</td><td>${priority === "P3" ? "3 días hábiles" : PRIORITY_TARGETS[priority].resolution}</td></tr>`).join("");
  return `<div class="page-heading"><div><div class="eyebrow">Gestión del servicio · Objetivos medibles</div><h1>Niveles de servicio</h1><p class="page-subtitle">Metas visibles para las marcas y acuerdos internos que permiten cumplirlas.</p></div></div>
    <div class="section-note"><strong>Distinción para esta demo:</strong> la Fase 1 fija metas mensuales de desempeño de 95%. Como no define una consecuencia contractual por incumplimiento, aquí se presentan como <strong>SLO internos</strong>. Un SLA formal con la marca requiere acordar la consecuencia.</div>
    <section class="levels-grid"><div class="panel"><div class="panel-heading"><div><h2>Metas por prioridad</h2><p>Ventana de medición del SLO: mensual, según prioridad.</p></div></div><table class="sla-table"><thead><tr><th>Prioridad</th><th>Primera respuesta</th><th>Restaurar incidente</th><th>Cumplir solicitud</th></tr></thead><tbody>${priorityRows}</tbody></table><div class="service-window" style="margin-top:13px"><span class="service-window-icon">◷</span><div><strong>Horario de atención</strong><br/>Lunes a viernes, 9:00 a. m. a 6:00 p. m., hora del Este de EE. UU. Fuera de horario se escala la afectación crítica.</div></div><div class="info-banner" style="margin-top:12px"><strong>Ventana de medición:</strong> al menos 95% de los casos respondidos, resueltos/restaurados y registrados/asignados dentro del objetivo correspondiente, revisado mensualmente. El indicador de solicitudes mide cumplimiento; el de incidentes mide restauración.</div></div>
      <div class="panel"><div class="panel-heading"><div><h2>Cadena de compromisos</h2><p>Los acuerdos internos deben caber dentro de la meta ofrecida a la marca.</p></div></div><div class="sla-chain"><div class="chain-row"><strong>Account Management / Customer Service</strong><span class="chain-arrow">→</span><span>Registrar y asignar<br/><b>P1 10 min · P2 30 min · P3 1 h</b></span></div><div class="chain-row"><strong>Team de Tech</strong><span class="chain-arrow">→</span><span>Iniciar revisión<br/><b>P1 15 min · P2 1 h · P3 4 h</b></span></div><div class="chain-row"><strong>Directora de Tech</strong><span class="chain-arrow">→</span><span>Revisar escalación crítica<br/><b>Máximo 30 min</b></span></div><div class="chain-row"><strong>Developer externo</strong><span class="chain-arrow">→</span><span>Confirmar recepción<br/><b>Máximo 2 h cuando aplique</b></span></div></div><div class="info-banner" style="margin-top:12px"><strong>UC por validar:</strong> la dependencia con developers o proveedores requiere confirmar el compromiso externo y comprobar que el camino crítico cabe dentro del objetivo de resolución al cliente.</div></div>
    </section>
    <section class="panel" style="margin-top:15px"><div class="panel-heading"><div><h2>Escalamientos: dos rutas</h2><p>El equipo aplica el movimiento que desbloquea el caso; ambos pueden coexistir.</p></div></div><div class="queue-strip"><div class="queue-chip"><span>Funcional · más conocimiento</span><strong>N1 AM/CS → N2 Tech → N3 proveedor</strong></div><div class="queue-chip"><span>Jerárquico · más autoridad</span><strong>Tech Lead → directora de Tech / CEO</strong></div><div class="queue-chip"><span>Comunicación al usuario</span><strong>AM o CS conserva seguimiento</strong></div></div></section>
    <section class="panel" style="margin-top:15px"><div class="panel-heading"><div><h2>Indicadores de mejora</h2><p>Segmentar por marca, tipo de usuario, tipo de demanda y categoría para que el promedio no esconda una mala experiencia.</p></div></div><div class="queue-strip"><div class="queue-chip"><span>Service Desk</span><strong>Primera respuesta</strong></div><div class="queue-chip"><span>Service Desk</span><strong>Resolución en primer contacto</strong></div><div class="queue-chip"><span>Service Desk</span><strong>Satisfacción y reaperturas</strong></div><div class="queue-chip"><span>Niveles de servicio</span><strong>Objetivos cumplidos</strong></div><div class="queue-chip"><span>Niveles de servicio</span><strong>OLAs que sostienen cada SLO</strong></div><div class="queue-chip"><span>Experiencia</span><strong>Brecha entre métricas y satisfacción</strong></div></div></section>`;
}

function showToast(message, type = "success") {
  const region = document.querySelector("#toast-region");
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.textContent = message;
  region.append(toast);
  setTimeout(() => toast.remove(), 3300);
}

function dialogMarkup(title, subtitle, body, footer = "", wide = false) {
  return `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}"><header class="modal-header"><div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(subtitle)}</p></div><button class="modal-close" data-action="close-modal" aria-label="Cerrar">×</button></header><div class="modal-body">${body}</div>${footer ? `<footer class="modal-footer">${footer}</footer>` : ""}</section></div>`;
}

function openCreateDialog() {
  const modalHost = document.createElement("div");
  modalHost.id = "modal-host";
  modalHost.innerHTML = dialogMarkup("Crear ticket", "La marca ingresa por el portal; Customer Service registra los casos que recibe de consumidores.", createFormMarkup(), `<button class="secondary-button" data-action="close-modal">Cancelar</button><button class="primary-button" type="submit" form="ticket-form">Crear ticket</button>`);
  document.body.append(modalHost);
  const form = modalHost.querySelector("#ticket-form");
  bindCreateForm(form);
  form.querySelector("#ticket-type").dispatchEvent(new Event("change"));
  form.querySelector("#ticket-impact").dispatchEvent(new Event("change"));
  form.querySelector("#ticket-subject").focus();
}

function openProblemDialog(categoryId) {
  const category = categoryById(categoryId);
  const existing = state.problemRecords[categoryId] || {};
  const modalHost = document.createElement("div");
  modalHost.id = "modal-host";
  const body = `<form id="problem-form"><div class="form-grid"><div class="field"><label for="problem-status">Estado del análisis</label><select id="problem-status" name="status">${["Investigando", "Error conocido", "Mitigado", "Resuelto"].map((status) => `<option ${existing.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></div><div class="field"><label for="problem-owner">Responsable de investigación</label><select id="problem-owner" name="owner">${["Team de Tech", "Account Management", "Customer Service", "Directora de Tech", "Proveedor externo"].map((owner) => `<option ${existing.owner === owner ? "selected" : ""}>${owner}</option>`).join("")}</select></div><div class="field full"><label>Patrón</label><input value="${escapeHTML(category.name)}" disabled /></div><div class="field full"><label for="problem-cause">Causa raíz o hipótesis (indicar si está por validar)</label><textarea id="problem-cause" name="cause" placeholder="Pendiente de investigación técnica">${escapeHTML(existing.cause || "")}</textarea></div><div class="field full"><label for="problem-workaround">Workaround para el Service Desk</label><textarea id="problem-workaround" name="workaround" placeholder="Qué puede hacer AM/CS mientras se investiga">${escapeHTML(existing.workaround || "")}</textarea></div><div class="field full"><label for="problem-action">Acción o solución permanente</label><textarea id="problem-action" name="permanentAction" placeholder="Acción correctiva, responsable y validación">${escapeHTML(existing.permanentAction || "")}</textarea></div></div></form>`;
  const relatedCount = problemPatterns().find((pattern) => pattern.categoryId === categoryId)?.count || 0;
  modalHost.innerHTML = dialogMarkup(existing.id ? `Actualizar ${existing.id}` : "Documentar análisis de problema", `${category.name} · ${relatedCount} incidente(s) relacionados`, body, `<button class="secondary-button" data-action="close-modal">Cancelar</button><button class="primary-button" type="submit" form="problem-form">Guardar análisis</button>`, true);
  document.body.append(modalHost);
  modalHost.querySelector("#problem-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const relatedTicketIds = problemPatterns().find((pattern) => pattern.categoryId === categoryId)?.tickets.map((ticket) => ticket.id) || [];
    state.problemRecords = upsertProblemRecord(state.problemRecords, categoryId, values, relatedTicketIds, new Date().toISOString());
    persistProblemRecords();
    closeModal();
    render();
    showToast("Análisis de problema guardado.");
  });
}

function createFormMarkup() {
  return `<form id="ticket-form"><div class="form-grid"><div class="field"><label for="ticket-type">Tipo de demanda <span class="required">*</span></label><select id="ticket-type" name="type" required><option value="Incidente">Incidente</option><option value="Solicitud">Solicitud</option></select><small>Incidente = restaurar. Solicitud = cumplir una acción prevista.</small></div><div class="field"><label for="ticket-requester-type">Quién reporta <span class="required">*</span></label><select id="ticket-requester-type" name="requesterType" required><option value="Marca">Marca</option><option value="Consumidor">Consumidor</option></select></div><div class="field"><label for="ticket-category">Categoría del catálogo <span class="required">*</span></label><select id="ticket-category" name="categoryId" required></select></div><div class="field"><label for="ticket-brand">Marca <span class="required">*</span></label><input id="ticket-brand" name="brand" required placeholder="Ej. Nébula Spirits" /></div><div class="field"><label for="ticket-requester">Nombre de quien reporta <span class="required">*</span></label><input id="ticket-requester" name="requesterName" required placeholder="Nombre y equipo" /></div><div class="field"><label for="ticket-email">Correo de contacto</label><input id="ticket-email" name="requesterEmail" type="email" placeholder="nombre@marca.com" /></div><div class="field"><label for="ticket-channel">Canal de entrada</label><select id="ticket-channel" name="channel"><option value="Portal de marca">Portal de marca</option><option value="Correo de Customer Service">Correo de Customer Service</option></select></div><div class="field"><label for="ticket-order">Número de pedido</label><input id="ticket-order" name="orderId" placeholder="Opcional; si aplica" /></div><div class="field full"><label for="ticket-subject">Título del caso <span class="required">*</span></label><input id="ticket-subject" name="subject" required maxlength="120" placeholder="Describe brevemente lo ocurrido" /></div><div class="field full"><label for="ticket-description">Descripción <span class="required">*</span></label><textarea id="ticket-description" name="description" required placeholder="¿Qué pasó o qué acción se necesita? Indica el impacto observado."></textarea></div><div class="field"><label for="ticket-impact">Impacto <span class="required">*</span></label><select id="ticket-impact" name="impact" required><option value="Alto">Alto</option><option value="Medio">Medio</option><option selected value="Bajo">Bajo</option></select><small>Alto: varias marcas, pagos o pedidos afectados. Medio: una marca con workaround. Bajo: caso individual o función secundaria.</small></div><div class="field"><label for="ticket-urgency">Urgencia <span class="required">*</span></label><select id="ticket-urgency" name="urgency" required><option value="Alta">Alta</option><option value="Media">Media</option><option selected value="Baja">Baja</option></select><small>Alta: ocurre ahora y puede causar pérdidas. Media: resolver hoy. Baja: puede programarse.</small></div><div class="field full"><div class="priority-preview"><div><strong>Prioridad calculada</strong><small>Se determina por impacto y urgencia.</small></div><span id="priority-preview-pill" class="priority-pill p3">P3</span></div></div><div id="request-hint" class="field full request-hint" hidden>Esta solicitud entra a su cola separada para cumplir una acción planificada; no desplaza incidentes que requieren restauración.</div></div></form>`;
}

function bindCreateForm(form) {
  form.addEventListener("change", (event) => {
    if (event.target.id === "ticket-type") {
      const type = event.target.value;
      const requesterSelect = form.querySelector("#ticket-requester-type");
      const categorySelect = form.querySelector("#ticket-category");
      const items = CATALOG.filter((item) => item.type === type);
      categorySelect.innerHTML = items.map((item) => `<option value="${item.id}">${escapeHTML(item.name)}</option>`).join("");
      requesterSelect.querySelector('option[value="Consumidor"]')?.remove();
      if (type === "Incidente" && !requesterSelect.querySelector('option[value="Consumidor"]')) requesterSelect.insertAdjacentHTML("beforeend", `<option value="Consumidor">Consumidor</option>`);
      if (type === "Solicitud" && requesterSelect.value === "Consumidor") requesterSelect.value = "Marca";
      form.querySelector("#request-hint").hidden = type !== "Solicitud";
      updateAssignmentOptions(form);
    }
    if (event.target.id === "ticket-requester-type") updateAssignmentOptions(form);
    if (["ticket-impact", "ticket-urgency"].includes(event.target.id)) updatePriorityPreview(form);
  });
  form.addEventListener("input", (event) => {
    if (["ticket-impact", "ticket-urgency"].includes(event.target.id)) updatePriorityPreview(form);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const category = categoryById(values.categoryId);
    const type = values.type;
    const requesterType = values.requesterType;
    const ticketId = nextTicketId();
    const now = new Date().toISOString();
    const assignee = type === "Solicitud" ? "Account Management" : requesterType === "Consumidor" ? "Customer Service" : "Account Management";
    const ticket = {
      id: ticketId, type, categoryId: category.id, subject: values.subject.trim(), description: values.description.trim(),
      requesterType, communicationOwner: requesterType === "Consumidor" ? "Customer Service" : "Account Management", requesterName: values.requesterName.trim(), requesterEmail: values.requesterEmail.trim(),
      brand: values.brand.trim(), orderId: values.orderId.trim(), channel: values.channel,
      impact: values.impact, urgency: values.urgency, priority: calculatePriority(values.impact, values.urgency),
      status: "Nuevo", assignee, createdAt: now, updatedAt: now, comments: [], firstResponseAt: null,
      resolvedAt: null, reopenedCount: 0,
    };
    state.tickets.unshift(ticket);
    persist();
    closeModal();
    state.view = "tickets";
    state.typeFilter = type;
    state.search = "";
    state.statusFilter = "Todos los estados";
    state.priorityFilter = "Todas las prioridades";
    render();
    showToast(`${ticketId} creado y agregado a la cola de ${type.toLocaleLowerCase("es")}.`);
    openTicket(ticketId);
  });
}

function updateAssignmentOptions(form) {
  const requester = form.querySelector("#ticket-requester-type").value;
  const channel = form.querySelector("#ticket-channel");
  channel.value = requester === "Consumidor" ? "Correo de Customer Service" : "Portal de marca";
}

function updatePriorityPreview(form) {
  const priority = calculatePriority(form.querySelector("#ticket-impact").value, form.querySelector("#ticket-urgency").value);
  const pill = form.querySelector("#priority-preview-pill");
  pill.textContent = priority;
  pill.className = `priority-pill ${priority.toLowerCase()}`;
}

function nextTicketId() {
  const max = Math.max(1048, ...state.tickets.map((ticket) => Number(ticket.id.match(/\d+$/)?.[0] || 0)));
  return `BV-${max + 1}`;
}

function closeModal() {
  document.querySelector("#modal-host")?.remove();
}

function openTicket(ticketId) {
  const ticket = state.tickets.find((item) => item.id === ticketId);
  if (!ticket) return;
  state.selectedTicketId = ticketId;
  const host = document.createElement("div");
  host.id = "modal-host";
  host.innerHTML = dialogMarkup(`${ticket.id} · ${ticket.type}`, `${categoryById(ticket.categoryId).name} · Creado ${formatDateTime(ticket.createdAt)}`, ticketDetailMarkup(ticket), "", true);
  document.body.append(host);
  bindDetail(host, ticket.id);
}

function ticketDetailMarkup(ticket) {
  const category = categoryById(ticket.categoryId);
  const comments = ticket.comments || [];
  const formOptions = CATALOG.filter((item) => item.type === ticket.type);
  const body = `<div class="detail-topline">${typePill(ticket.type)}${priorityPill(ticket.priority)}${statusPill(ticket.status)}</div><h3 class="detail-title">${escapeHTML(ticket.subject)}</h3><p class="detail-description">${escapeHTML(ticket.description)}</p>
    <div class="detail-grid"><div class="detail-fact"><span>Marca</span><strong>${escapeHTML(ticket.brand)}</strong></div><div class="detail-fact"><span>Reporta</span><strong>${escapeHTML(ticket.requesterName)} (${escapeHTML(ticket.requesterType)})</strong></div><div class="detail-fact"><span>Canal</span><strong>${escapeHTML(ticket.channel)}</strong></div><div class="detail-fact"><span>Número de pedido</span><strong>${escapeHTML(ticket.orderId || "No aplica")}</strong></div><div class="detail-fact"><span>Impacto / urgencia</span><strong>${escapeHTML(ticket.impact)} / ${escapeHTML(ticket.urgency)}</strong></div><div class="detail-fact"><span>Investigación a cargo de</span><strong>${escapeHTML(ticket.assignee)}</strong></div><div class="detail-fact"><span>Comunicación al usuario</span><strong>${escapeHTML(ticket.communicationOwner || commentAuthorFor(ticket, "Público"))}</strong></div><div class="detail-fact"><span>Primera respuesta</span><strong>${formatDateTime(ticket.firstResponseAt)}</strong></div><div class="detail-fact"><span>Última actualización</span><strong>${formatDateTime(ticket.updatedAt)}</strong></div></div>
    <div class="detail-section-title">Actualizar ticket <span class="ticket-id">Reclasifica, reasigna o cambia el estado</span></div><form id="detail-edit-form" class="detail-edit-grid"><div class="field"><label for="edit-category">Categoría</label><select id="edit-category" name="categoryId">${formOptions.map((item) => `<option value="${item.id}" ${item.id === ticket.categoryId ? "selected" : ""}>${escapeHTML(item.name)}</option>`).join("")}</select></div><div class="field"><label for="edit-priority">Prioridad</label><select id="edit-priority" name="priority">${["P1", "P2", "P3"].map((priority) => `<option ${priority === ticket.priority ? "selected" : ""}>${priority}</option>`).join("")}</select></div><div class="field"><label for="edit-status">Estado</label><select id="edit-status" name="status">${STATUSES.map((status) => `<option ${status === ticket.status ? "selected" : ""}>${status}</option>`).join("")}</select></div><div class="field"><label for="edit-assignee">Responsable</label><select id="edit-assignee" name="assignee">${ASSIGNEES.map((assignee) => `<option ${assignee === ticket.assignee ? "selected" : ""}>${assignee}</option>`).join("")}</select></div><div class="field"><label for="edit-impact">Impacto</label><select id="edit-impact" name="impact">${["Alto", "Medio", "Bajo"].map((value) => `<option ${value === ticket.impact ? "selected" : ""}>${value}</option>`).join("")}</select></div><div class="field"><label for="edit-urgency">Urgencia</label><select id="edit-urgency" name="urgency">${["Alta", "Media", "Baja"].map((value) => `<option ${value === ticket.urgency ? "selected" : ""}>${value}</option>`).join("")}</select></div><div class="field full"><button class="secondary-button" type="submit">Guardar cambios</button></div></form>
    <div class="detail-section-title">Comentarios y seguimiento <span class="ticket-id">${comments.length} ${comments.length === 1 ? "actualización" : "actualizaciones"}</span></div><div class="comment-list">${comments.length ? comments.map(commentMarkup).join("") : `<div class="empty-state" style="padding:16px">Aún no hay comentarios. Registra la primera actualización del caso.</div>`}</div><form id="comment-form" class="comment-form"><textarea name="body" required placeholder="Escribe una actualización para dar seguimiento al caso..."></textarea><div class="comment-controls"><select name="visibility" aria-label="Visibilidad del comentario"><option>Público</option><option>Interno</option></select><span class="form-help">Los comentarios internos son para el equipo de soporte.</span></div><button class="primary-button" type="submit">Agregar comentario</button></form>`;
  return body;
}

function commentMarkup(comment) {
  const internal = comment.visibility === "Interno";
  const avatar = internal ? "IN" : comment.author === "Account Management" ? "AM" : comment.author === "Customer Service" ? "CS" : "SD";
  return `<article class="comment ${internal ? "internal" : ""}"><div class="comment-head"><span class="comment-avatar">${avatar}</span><strong>${escapeHTML(comment.author)}</strong><span class="comment-kind">${internal ? "Nota interna" : "Visible para usuario"}</span><small>${formatDateTime(comment.createdAt)}</small></div><p>${escapeHTML(comment.body)}</p></article>`;
}

function bindDetail(host, ticketId) {
  const editForm = host.querySelector("#detail-edit-form");
  editForm.addEventListener("change", (event) => {
    if (["edit-impact", "edit-urgency"].includes(event.target.id)) {
      editForm.querySelector("#edit-priority").value = calculatePriority(editForm.querySelector("#edit-impact").value, editForm.querySelector("#edit-urgency").value);
    }
  });
  editForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const ticket = state.tickets.find((item) => item.id === ticketId);
    const oldStatus = ticket.status;
    const oldPriority = ticket.priority;
    const values = Object.fromEntries(new FormData(editForm).entries());
    Object.assign(ticket, values);
    if (oldStatus !== "Resuelto" && values.status === "Resuelto") ticket.resolvedAt = new Date().toISOString();
    if (["Resuelto", "Cerrado"].includes(oldStatus) && !["Resuelto", "Cerrado"].includes(values.status)) {
      ticket.resolvedAt = null;
      ticket.reopenedCount = (ticket.reopenedCount || 0) + 1;
    }
    ticket.updatedAt = new Date().toISOString();
    if (ticket.priority !== oldPriority) ticket.priorityChangedAt = ticket.updatedAt;
    persist();
    closeModal();
    render();
    showToast(`${ticket.id} actualizado.`);
    openTicket(ticketId);
  });
  host.querySelector("#comment-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const ticket = state.tickets.find((item) => item.id === ticketId);
    const now = new Date().toISOString();
    ticket.comments.push({ id: `${ticket.id}-${Date.now()}`, author: commentAuthorFor(ticket, values.visibility), body: values.body.trim(), visibility: values.visibility, createdAt: now });
    if (!ticket.firstResponseAt && values.visibility === "Público") ticket.firstResponseAt = now;
    ticket.updatedAt = now;
    persist();
    closeModal();
    render();
    openTicket(ticketId);
    showToast(values.visibility === "Interno" ? "Nota interna agregada." : "Actualización compartida en el caso.");
  });
}

document.body.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    state.view = viewButton.dataset.view;
    if (["tickets", "incidents", "requests"].includes(state.view)) {
      state.search = "";
      state.statusFilter = "Todos los estados";
      state.priorityFilter = "Todas las prioridades";
      state.typeFilter = state.view === "incidents" ? "Incidente" : state.view === "requests" ? "Solicitud" : "Todos";
    }
    render();
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "new-ticket") { openCreateDialog(); return; }
  if (action === "analyze-problem") { openProblemDialog(event.target.closest("[data-category-id]").dataset.categoryId); return; }
  if (action === "close-modal") { closeModal(); return; }
  if (action === "backdrop-close" && event.target.classList.contains("modal-backdrop")) { closeModal(); return; }
  const ticketNode = event.target.closest("[data-ticket-id]");
  if (ticketNode) { openTicket(ticketNode.dataset.ticketId); return; }
  const typeTab = event.target.closest("[data-type-filter]");
  if (typeTab) {
    state.typeFilter = typeTab.dataset.typeFilter;
    state.view = "tickets";
    render();
  }
});

document.body.addEventListener("input", (event) => {
  if (event.target.id === "ticket-search") {
    state.search = event.target.value;
    const cursor = event.target.selectionStart;
    const content = appContent.querySelector(".ticket-table-wrap");
    const nextRows = sortedTickets(state.tickets.filter((ticket) => {
      const selectedType = state.view === "incidents" ? "Incidente" : state.view === "requests" ? "Solicitud" : state.typeFilter;
      return (selectedType === "Todos" || ticket.type === selectedType) && (state.statusFilter === "Todos los estados" || ticket.status === state.statusFilter) && (state.priorityFilter === "Todas las prioridades" || ticket.priority === state.priorityFilter);
    }).filter((ticket) => {
      const needle = state.search.trim().toLocaleLowerCase("es");
      const category = categoryById(ticket.categoryId).name;
      return !needle || [ticket.id, ticket.subject, ticket.brand, ticket.assignee, category, ticket.orderId].some((value) => String(value || "").toLocaleLowerCase("es").includes(needle));
    }));
    if (content) content.querySelector("tbody").innerHTML = nextRows.length ? nextRows.map(ticketRow).join("") : `<tr><td colspan="7" class="table-empty">No hay tickets que coincidan con estos filtros.</td></tr>`;
    event.target.setSelectionRange(cursor, cursor);
  }
});

document.body.addEventListener("change", (event) => {
  if (event.target.id === "priority-filter") {
    state.priorityFilter = event.target.value;
    render();
  }
  if (event.target.id === "status-filter") {
    state.statusFilter = event.target.value;
    render();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeModal();
});

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("es-GT", { weekday: "short", day: "numeric", month: "short" }).format(new Date());
render();
