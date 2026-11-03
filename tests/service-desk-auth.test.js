const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createAuthHarness(overrides = {}) {
  const calls = [];
  let authListener;
  const client = { auth: {
    async getSession() { calls.push(["getSession"]); return { data: { session: null }, error: null }; },
    onAuthStateChange(listener) { authListener = listener; return { data: { subscription: { unsubscribe() {} } } }; },
    async signInWithPassword(credentials) { calls.push(["signInWithPassword", credentials]); return { data: { session: { access_token: "token", user: { email: credentials.email } } }, error: null }; },
    async resetPasswordForEmail(email, options) { calls.push(["resetPasswordForEmail", email, options]); return { data: {}, error: null }; },
    async updateUser(attributes) { calls.push(["updateUser", attributes]); return { data: { user: {} }, error: null }; },
    async signOut() { calls.push(["signOut"]); return { error: null }; },
  } };
  Object.assign(client.auth, overrides);
  const window = { bevstackSupabase: client, location: { origin: "http://localhost:5173" } };
  const source = fs.readFileSync(path.join(__dirname, "..", "public", "service-desk-auth.js"), "utf8");
  vm.runInNewContext(source, { window, document: { body: { append() {} }, querySelector: () => null }, console, Error, String, Object });
  return { auth: window.ServiceDeskAuth, client, calls, emit: (event, session) => authListener(event, session) };
}

test("signed-out session is reported to the guard without loading ticket data", async () => {
  const harness = createAuthHarness();
  const sessions = [];
  await harness.auth.start({ onSession: (session) => sessions.push(session) });
  assert.deepEqual(sessions, [null]);
  assert.deepEqual(harness.calls, [["getSession"]]);
});

test("sign-in and sign-out change the guarded session", async () => {
  const harness = createAuthHarness();
  const sessions = [];
  await harness.auth.start({ onSession: (session) => sessions.push(session) });
  const session = await harness.auth.signIn("ops@bevstack.com", "correct horse");
  harness.emit("SIGNED_IN", session);
  await harness.auth.signOut();
  harness.emit("SIGNED_OUT", null);
  assert.equal(sessions[1].user.email, "ops@bevstack.com");
  assert.equal(sessions[2], null);
  assert.equal(harness.calls[1][0], "signInWithPassword");
  assert.equal(harness.calls[1][1].email, "ops@bevstack.com");
  assert.equal(harness.calls[1][1].password, "correct horse");
});

test("password recovery sends reset and updates an existing account", async () => {
  const harness = createAuthHarness();
  await harness.auth.sendPasswordReset("ops@bevstack.com");
  await harness.auth.updatePassword("new-password");
  assert.equal(harness.calls[0][0], "resetPasswordForEmail");
  assert.equal(harness.calls[0][1], "ops@bevstack.com");
  assert.equal(harness.calls[0][2].redirectTo, "http://localhost:5173");
  assert.equal(harness.calls[1][0], "updateUser");
  assert.equal(harness.calls[1][1].password, "new-password");
});
