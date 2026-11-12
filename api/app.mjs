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

function decodeParam(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new HttpError(400, "invalid_path", "La ruta contiene una codificación inválida.");
  }
}

export function createRouter(routes) {
  const compiled = routes.map((route) => ({ ...route, method: route.method.toUpperCase(), ...compilePattern(route.path) }));
  return function match(method, path) {
    const allowed = [];
    for (const route of compiled) {
      const result = route.regex.exec(path);
      if (!result) continue;
      // HEAD is answered by the GET handler (headers only), as HTTP specifies.
      if (route.method !== method && !(method === "HEAD" && route.method === "GET")) {
        allowed.push(route.method);
        continue;
      }
      const params = Object.fromEntries(route.names.map((name, index) => [name, decodeParam(result[index + 1])]));
      return { route, params };
    }
    if (!allowed.length) return null;
    if (allowed.includes("GET")) allowed.push("HEAD");
    return { allowed };
  };
}

function sendJson(response, statusCode, body, headers = {}, method = "GET") {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    ...headers,
  });
  response.end(method === "HEAD" ? undefined : payload);
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
    let matchedRoute;
    let logError;

    try {
      const found = match(method, path);
      if (!found) throw new HttpError(404, "not_found", `No existe la ruta ${path}.`);
      if (found.allowed) {
        statusCode = 405;
        logError = { code: "method_not_allowed", message: `Método ${method} no permitido en ${path}.` };
        message = `${method} ${path} 405 method_not_allowed`;
        sendJson(response, 405, { error: logError.code, message: logError.message }, { allow: found.allowed.join(", ") }, method);
        return;
      }
      matchedRoute = found.route;
      const result = await found.route.handler({ request, params: found.params, path, method });
      statusCode = result?.status ?? 200;
      sendJson(response, statusCode, result?.body ?? {}, result?.headers, method);
    } catch (error) {
      if (error instanceof HttpError) {
        statusCode = error.statusCode;
        logError = { code: error.code, message: error.message };
        message = `${method} ${path} ${statusCode} ${error.code}`;
        sendJson(response, statusCode, { error: error.code, message: error.message }, {}, method);
      } else {
        statusCode = 500;
        logError = { code: "internal_error", message: error?.message || "unexpected_error" };
        message = `${method} ${path} 500 ${logError.message}`;
        sendJson(response, 500, { error: "internal_error", message: "Error interno del servicio." }, {}, method);
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
        route: matchedRoute?.path,
        labels: matchedRoute?.labels,
        error: logError,
      }));
    }
  };
}
