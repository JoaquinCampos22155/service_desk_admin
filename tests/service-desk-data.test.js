const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadAdapter(client) {
  const source = fs.readFileSync(path.join(__dirname, "..", "public", "service-desk-data.js"), "utf8");
  const window = { bevstackSupabase: client };
  vm.runInNewContext(source, { window, console, Error, Object, Array, String });
  return window.ServiceDeskData;
}

function queryClient(handlers) {
  const calls = [];
  return {
    calls,
    from(table) {
      const query = { table, operation: "select", filters: [], payload: null };
      const chain = {
        select(columns) { query.columns = columns; return chain; },
        order(column, options) { query.order = [column, options]; return chain; },
        insert(payload) { query.operation = "insert"; query.payload = payload; return chain; },
        update(payload) { query.operation = "update"; query.payload = payload; return chain; },
        eq(column, value) { query.filters.push([column, value]); return chain; },
        async maybeSingle() { calls.push(query); return handlers(query); },
        async single() { calls.push(query); return handlers(query); },
        then(resolve, reject) { calls.push(query); return Promise.resolve(handlers(query)).then(resolve, reject); },
      };
      return chain;
    },
  };
}

test("loads shared ticket and category rows", async () => {
  const ticket = { id: "BV-1049", subject: "Pedido detenido", category_id: "orders", type: "Incidente", impact: "Alto", urgency: "Alta", priority: "P1", status: "Nuevo", assignee: "Customer Service", communication_owner: "Customer Service", channel: "Correo", brand: "Nébula", order_id: "ORD-1", description: "Caso", requester_type: "Consumidor", requester_name: "Ana", requester_email: "ana@example.com", comments: [], created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-01T10:00:00Z", first_response_at: null, resolved_at: null, reopened_count: 0, priority_changed_at: null };
  const category = { id: "orders", name: "Problemas de pedidos", type: "Incidente", description: "Pedidos", reporter: "CS", owner: "Tech" };
  const client = queryClient((query) => ({ data: query.table === "tickets" ? [ticket] : [category], error: null }));
  const data = loadAdapter(client);
  const result = await data.load();
  assert.equal(result.tickets[0].categoryId, "orders");
  assert.equal(result.tickets[0].requesterType, "Consumidor");
  assert.equal(result.customCategories[0].reporter, "CS");
  assert.deepEqual(client.calls.map((call) => call.table).sort(), ["custom_categories", "tickets"]);
});

test("creates with the server ID and rejects stale updates", async () => {
  const created = { id: "BV-1050", subject: "Nuevo", category_id: "orders", type: "Incidente", impact: "Medio", urgency: "Alta", priority: "P1", status: "Nuevo", assignee: "Customer Service", communication_owner: "Customer Service", channel: "Correo", brand: "Nébula", order_id: "", description: "Caso", requester_type: "Marca", requester_name: "Equipo", requester_email: "", comments: [], created_at: "2026-11-02T10:00:00Z", updated_at: "2026-11-02T10:00:00Z", reopened_count: 0 };
  const client = queryClient((query) => {
    if (query.operation === "insert") return { data: created, error: null };
    return { data: null, error: null };
  });
  const data = loadAdapter(client);
  const result = await data.createTicket({ subject: "Nuevo", categoryId: "orders", type: "Incidente", impact: "Medio", urgency: "Alta", priority: "P1", status: "Nuevo", assignee: "Customer Service", communicationOwner: "Customer Service", channel: "Correo", brand: "Nébula", orderId: "", description: "Caso", requesterType: "Marca", requesterName: "Equipo", requesterEmail: "", comments: [] });
  assert.equal(result.id, "BV-1050");
  assert.equal(client.calls[0].payload.id, undefined);
  await assert.rejects(data.updateTicket({ id: "BV-1049", status: "En progreso" }, "2026-11-01T10:00:00Z"), { name: "TicketConflictError" });
  assert.deepEqual(client.calls[1].filters, [["id", "BV-1049"], ["updated_at", "2026-11-01T10:00:00Z"]]);
});

test("duplicate category or database failure returns a typed error", async () => {
  const client = queryClient(() => ({ data: null, error: { code: "23505", message: "duplicate key" } }));
  const data = loadAdapter(client);
  await assert.rejects(data.createCategory({ id: "shipping", name: "Envíos", type: "Solicitud", description: "Cambio", reporter: "Marca", owner: "AM" }), { name: "ServiceDeskDataError" });
});
