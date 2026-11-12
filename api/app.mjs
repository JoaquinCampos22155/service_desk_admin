import { buildRequestLog } from "./logger.mjs";

export class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function compilePattern(pattern) {
  const names = [];
  const source = pattern.split("/").map((segment) => {
    if (!segment.startsWith(":")) return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    names.push(segment.slice(1));
    return "([^/]+)";
  }).join("/");
  return { regex: new RegExp(`^${source}/?$`), names };
}

export function createRouter(routes) {
  const compiled = routes.map((route) => ({ ...route, method: route.method.toUpperCase(), ...compilePattern(route.path) }));
  return function match(method, path) {
    const allowed = [];
    for (const route of compiled) {
      const result = route.regex.exec(path);
      if (!result) continue;
      if (route.method !== method) {
        allowed.push(route.method);
        continue;
      }
      const params = Object.fromEntries(route.names.map((name, index) => [name, decodeURIComponent(result[index + 1])]));
      return { route, params };
    }
    return allowed.length ? { allowed } : null;
  };
}

function sendJson(response, statusCode, body, headers = {}) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    ...headers,
  });
  response.end(payload);
}

export function healthRoute({ serviceName, environment, startedAt = new Date() }) {
  return {
    method: "GET",
    path: "/api/health",
    handler: () => ({
      status: 200,
      body: {
        status: "up",
        service: serviceName,
        environment,
        uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
        timestamp: new Date().toISOString(),
      },
    }),
  };
}

export function createApp({ config, logger, routes = [], now = () => new Date(), clock = () => process.hrtime.bigint() }) {
  const match = createRouter([healthRoute(config), ...routes]);

  return async function handleRequest(request, response) {
    const startedAt = clock();
    const timestamp = now();
    const method = String(request.method || "GET").toUpperCase();
    const path = new URL(request.url || "/", "http://localhost").pathname;
    let statusCode = 500;
    let message;

    try {
      const found = match(method, path);
      if (!found) throw new HttpError(404, "not_found", `No existe la ruta ${path}.`);
      if (found.allowed) {
        statusCode = 405;
        sendJson(response, 405, { error: "method_not_allowed", message: `Método ${method} no permitido en ${path}.` }, { allow: found.allowed.join(", ") });
        return;
      }
      const result = await found.route.handler({ request, params: found.params, path, method });
      statusCode = result?.status ?? 200;
      sendJson(response, statusCode, result?.body ?? {}, result?.headers);
    } catch (error) {
      if (error instanceof HttpError) {
        statusCode = error.statusCode;
        message = `${method} ${path} ${statusCode} ${error.code}`;
        sendJson(response, statusCode, { error: error.code, message: error.message });
      } else {
        statusCode = 500;
        message = `${method} ${path} 500 ${error?.message || "unexpected_error"}`;
        sendJson(response, 500, { error: "internal_error", message: "Error interno del servicio." });
      }
    } finally {
      logger.write(buildRequestLog({
        timestamp,
        serviceName: config.serviceName,
        environment: config.environment,
        method,
        path,
        statusCode,
        durationNs: Number(clock() - startedAt),
        message,
      }));
    }
  };
}
