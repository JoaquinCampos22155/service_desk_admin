import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const ECS_VERSION = "8.11.0";

export function levelForStatus(statusCode) {
  if (statusCode >= 500) return "error";
  if (statusCode >= 400) return "warn";
  return "info";
}

// One ECS document per HTTP request. Nested objects keep the field names
// (http.request.method, event.duration, ...) unambiguous for Elasticsearch.
export function buildRequestLog({ timestamp, serviceName, environment, method, path, statusCode, durationNs, message }) {
  return {
    "@timestamp": timestamp.toISOString(),
    log: { level: levelForStatus(statusCode), logger: "http" },
    message: message || `${method} ${path} ${statusCode}`,
    ecs: { version: ECS_VERSION },
    service: { name: serviceName, environment },
    event: { kind: "event", category: ["web"], type: ["access"], outcome: statusCode >= 400 ? "failure" : "success", duration: durationNs },
    http: { request: { method }, response: { status_code: statusCode } },
    url: { path },
  };
}

export function createLogger({ file, stdout = process.stdout, writeToStdout = true }) {
  let stream = null;
  if (file) {
    mkdirSync(dirname(file), { recursive: true });
    stream = createWriteStream(file, { flags: "a" });
  }
  return {
    write(document) {
      const line = `${JSON.stringify(document)}\n`;
      stream?.write(line);
      if (writeToStdout) stdout.write(line);
    },
    close() {
      return new Promise((resolve) => {
        if (!stream) return resolve();
        stream.end(resolve);
      });
    },
  };
}
