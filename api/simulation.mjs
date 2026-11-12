import { setTimeout as wait } from "node:timers/promises";

// Seeded PRNG so tests (and anyone reproducing a run) get the same sequence.
export function seededRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SLOW_REQUEST_MULTIPLIER = 4;

export function createSimulator({
  clientErrorRate,
  serverErrorRate,
  latencyScale = 1,
  slowRequestRate = 0,
  maxLatencyMs = 3000,
  random = Math.random,
  sleep = (ms) => wait(ms),
}) {
  function pickOutcome() {
    const roll = random();
    if (roll < serverErrorRate) return "server_error";
    if (roll < serverErrorRate + clientErrorRate) return "client_error";
    return "success";
  }

  function latencyMs({ min, max }) {
    let value = min + random() * (max - min);
    if (random() < slowRequestRate) value *= SLOW_REQUEST_MULTIPLIER;
    return Math.round(Math.min(value, maxLatencyMs) * latencyScale);
  }

  function pick(items) {
    return items[Math.floor(random() * items.length)];
  }

  return {
    pickOutcome,
    latencyMs,
    pick,
    random,
    async delay(profile) {
      const ms = latencyMs(profile);
      if (ms > 0) await sleep(ms);
      return ms;
    },
  };
}
