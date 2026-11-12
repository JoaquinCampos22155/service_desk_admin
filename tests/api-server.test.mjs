import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";

const serverPath = new URL("../api/server.mjs", import.meta.url).pathname;

function runServer(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [serverPath], { env: { ...process.env, LOG_TO_STDOUT: "false", ...env }, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

test("API exits with a clear message when the port is already in use", async () => {
  const blocker = createServer();
  await new Promise((resolve) => blocker.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = blocker.address();
    const { code, stderr } = await runServer({ PORT: String(port), LOG_FILE: "" });
    assert.equal(code, 1);
    assert.match(stderr, new RegExp(`El puerto ${port} ya está en uso`));
    assert.doesNotMatch(stderr, /Unhandled 'error' event/);
  } finally {
    await new Promise((resolve) => blocker.close(resolve));
  }
});

test("API exits with a clear message when the log file cannot be written", async () => {
  const { code, stderr } = await runServer({ PORT: "0", LOG_FILE: "/dev/null/blocked/api.log" });
  assert.equal(code, 1);
  assert.match(stderr, /No se pudo escribir el log en \/dev\/null\/blocked\/api\.log/);
});

test("API exits with a clear message on invalid configuration", async () => {
  const { code, stderr } = await runServer({ PORT: "0", LOG_FILE: "", SERVER_ERROR_RATE: "2" });
  assert.equal(code, 1);
  assert.match(stderr, /Configuración inválida: SERVER_ERROR_RATE/);
});
