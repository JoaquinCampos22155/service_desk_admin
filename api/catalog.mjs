import { HttpError } from "./app.mjs";

const MAX_BODY_BYTES = 64 * 1024;

const COMMON_CLIENT_ERRORS = [
  { status: 400, code: "validation_error", message: "La petición no cumple el formato esperado." },
  { status: 401, code: "unauthorized", message: "Credenciales de la marca ausentes o vencidas." },
];

const COMMON_SERVER_ERRORS = [
  { status: 500, code: "internal_error", message: "Error interno del servicio." },
  { status: 503, code: "service_unavailable", message: "Servicio temporalmente no disponible." },
];

function shortId(random, prefix) {
  return `${prefix}-${Math.floor(10000 + random() * 90000)}`;
}

export async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "payload_too_large", "El cuerpo de la petición es demasiado grande.");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  try {
    const value = JSON.parse(text);
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value;
  } catch {
    throw new HttpError(400, "invalid_json", "El cuerpo debe ser un objeto JSON válido.");
  }
}

// One endpoint per item of the Phase 1 service catalog (docs/modelo-operativo.md).
// latency: base range in ms before LATENCY_SCALE and slow-request spikes.
// clientErrors / serverErrors: responses drawn when the simulator picks a 4xx / 5xx outcome.
export const CATALOG_ENDPOINTS = [
  {
    id: "new-store",
    name: "Activación de una nueva tienda",
    type: "Solicitud",
    method: "POST",
    path: "/api/stores",
    latency: { min: 120, max: 450 },
    clientErrors: [...COMMON_CLIENT_ERRORS, { status: 409, code: "store_already_exists", message: "La marca ya tiene una tienda con ese dominio." }],
    serverErrors: [...COMMON_SERVER_ERRORS, { status: 502, code: "provisioning_failed", message: "El proveedor de la plataforma no respondió al crear la tienda." }],
    success: ({ body, random }) => ({
      status: 201,
      body: { storeId: shortId(random, "STORE"), brand: body.brand || "Marca demo", status: "provisioning" },
    }),
  },
  {
    id: "shipping-rules",
    name: "Cambio en reglas de envío",
    type: "Solicitud",
    method: "PUT",
    path: "/api/stores/:storeId/shipping-rules",
    latency: { min: 80, max: 250 },
    clientErrors: [...COMMON_CLIENT_ERRORS, { status: 404, code: "store_not_found", message: "La tienda no existe." }],
    serverErrors: COMMON_SERVER_ERRORS,
    success: ({ params, body }) => ({
      status: 200,
      body: { storeId: params.storeId, zones: Array.isArray(body.zones) ? body.zones : [], status: "applied" },
    }),
  },
  {
    id: "product-config",
    name: "Actualización de configuración de productos",
    type: "Solicitud",
    method: "PATCH",
    path: "/api/products/:sku",
    latency: { min: 60, max: 200 },
    clientErrors: [...COMMON_CLIENT_ERRORS, { status: 404, code: "product_not_found", message: "El producto no existe." }],
    serverErrors: COMMON_SERVER_ERRORS,
    success: ({ params, body }) => ({
      status: 200,
      body: { sku: params.sku, updatedFields: Object.keys(body), status: "updated" },
    }),
  },
  {
    id: "operational-config",
    name: "Cambio de configuración operativa",
    type: "Solicitud",
    method: "PUT",
    path: "/api/stores/:storeId/operational-config",
    latency: { min: 70, max: 220 },
    clientErrors: [...COMMON_CLIENT_ERRORS, { status: 404, code: "store_not_found", message: "La tienda no existe." }],
    serverErrors: COMMON_SERVER_ERRORS,
    success: ({ params, body }) => ({
      status: 200,
      body: { storeId: params.storeId, orderCutoff: body.orderCutoff || "16:00", status: "applied" },
    }),
  },
  {
    id: "unprocessed-order",
    name: "Pedido no procesado",
    type: "Incidente",
    method: "POST",
    path: "/api/orders",
    latency: { min: 150, max: 600 },
    clientErrors: [...COMMON_CLIENT_ERRORS, { status: 409, code: "duplicate_order", message: "El pedido ya fue registrado." }],
    serverErrors: [...COMMON_SERVER_ERRORS, { status: 502, code: "fulfillment_unavailable", message: "Fulfillment no aceptó el pedido." }],
    success: ({ body, random }) => ({
      status: 201,
      body: { orderId: shortId(random, "ORD"), items: Array.isArray(body.items) ? body.items.length : 0, status: "processing" },
    }),
  },
  {
    id: "incorrect-inventory",
    name: "Inventario incorrecto",
    type: "Incidente",
    method: "GET",
    path: "/api/inventory/:sku",
    latency: { min: 20, max: 120 },
    clientErrors: [...COMMON_CLIENT_ERRORS, { status: 404, code: "product_not_found", message: "El producto no existe." }],
    serverErrors: [...COMMON_SERVER_ERRORS, { status: 502, code: "inventory_feed_error", message: "El feed de inventario del retailer falló." }],
    success: ({ params, random }) => ({
      status: 200,
      body: { sku: params.sku, available: Math.floor(random() * 120), source: "retailer-feed" },
    }),
  },
  {
    id: "payment-without-order",
    name: "Pago completado sin creación del pedido",
    type: "Incidente",
    method: "POST",
    path: "/api/payments",
    latency: { min: 200, max: 800 },
    clientErrors: [...COMMON_CLIENT_ERRORS, { status: 409, code: "duplicate_payment", message: "El pago ya fue procesado." }],
    serverErrors: [...COMMON_SERVER_ERRORS, { status: 502, code: "payment_gateway_error", message: "La pasarela de pago no respondió." }],
    success: ({ body, random }) => ({
      status: 201,
      body: { paymentId: shortId(random, "PAY"), orderId: body.orderId || shortId(random, "ORD"), status: "captured" },
    }),
  },
  {
    id: "shipping-unavailable",
    name: "Opción de envío no disponible",
    type: "Incidente",
    method: "GET",
    path: "/api/shipping/options",
    latency: { min: 40, max: 180 },
    clientErrors: [...COMMON_CLIENT_ERRORS, { status: 404, code: "zone_not_covered", message: "No hay cobertura para el destino indicado." }],
    serverErrors: [...COMMON_SERVER_ERRORS, { status: 502, code: "carrier_unavailable", message: "La transportista no respondió." }],
    success: ({ request }) => {
      const zone = new URL(request.url || "/", "http://localhost").searchParams.get("zone") || "1";
      return { status: 200, body: { zone, options: [{ id: "standard", etaDays: 3 }, { id: "express", etaDays: 1 }] } };
    },
  },
];

const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

export function createCatalogRoutes({ simulator, endpoints = CATALOG_ENDPOINTS }) {
  return endpoints.map((endpoint) => ({
    method: endpoint.method,
    path: endpoint.path,
    labels: { catalog_item: endpoint.id, catalog_type: endpoint.type },
    async handler({ request, params }) {
      // Malformed JSON is a real (not simulated) 400 so clients get honest feedback.
      const body = BODY_METHODS.has(endpoint.method) ? await readJsonBody(request) : {};
      await simulator.delay(endpoint.latency);
      const outcome = simulator.pickOutcome();
      if (outcome !== "success") {
        const error = simulator.pick(outcome === "server_error" ? endpoint.serverErrors : endpoint.clientErrors);
        throw new HttpError(error.status, error.code, error.message);
      }
      return endpoint.success({ request, params, body, random: simulator.random });
    },
  }));
}
