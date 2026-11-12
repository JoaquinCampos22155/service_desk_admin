export class ApiConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ApiConfigError";
  }
}

function readPort(value, fallback) {
  if (value === undefined || value === "") return fallback;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new ApiConfigError(`PORT inválido: ${value}`);
  return port;
}

function readRate(name, value, fallback) {
  if (value === undefined || value === "") return fallback;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new ApiConfigError(`${name} debe ser un número entre 0 y 1: ${value}`);
  return rate;
}

function readNonNegativeInteger(name, value, fallback) {
  if (value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new ApiConfigError(`${name} debe ser un entero mayor o igual a 0: ${value}`);
  return number;
}

export function loadConfig(env = process.env) {
  const config = {
    host: String(env.HOST || "127.0.0.1"),
    port: readPort(env.PORT, 4000),
    serviceName: String(env.SERVICE_NAME || "bevstack-ecommerce-api"),
    environment: String(env.SERVICE_ENVIRONMENT || "local"),
    logFile: String(env.LOG_FILE || "logs/api.log"),
    logToStdout: env.LOG_TO_STDOUT !== "false",
    simulation: {
      clientErrorRate: readRate("CLIENT_ERROR_RATE", env.CLIENT_ERROR_RATE, 0.15),
      serverErrorRate: readRate("SERVER_ERROR_RATE", env.SERVER_ERROR_RATE, 0.05),
      latencyScale: readRate("LATENCY_SCALE", env.LATENCY_SCALE, 1),
      slowRequestRate: readRate("SLOW_REQUEST_RATE", env.SLOW_REQUEST_RATE, 0.05),
      maxLatencyMs: readNonNegativeInteger("MAX_LATENCY_MS", env.MAX_LATENCY_MS, 3000),
    },
  };
  const { clientErrorRate, serverErrorRate } = config.simulation;
  if (clientErrorRate + serverErrorRate > 1) {
    throw new ApiConfigError("CLIENT_ERROR_RATE + SERVER_ERROR_RATE no puede ser mayor que 1.");
  }
  return config;
}
