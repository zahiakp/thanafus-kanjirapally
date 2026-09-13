import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("stream control and admin APIs are admin-only while display state is token validated", async () => {
  const proxy = await read("proxy.ts");
  const admin = await read("app/api/stream/admin/route.ts");
  const control = await read("app/api/stream/control/route.ts");
  const state = await read("app/api/stream/state/route.ts");
  const server = await read("app/stream/server.ts");
  assert.match(proxy, /["']\/api\/stream["']:\s*\[["']admin["']\]/);
  assert.match(proxy, /["']\/stream\/main["']/);
  assert.match(admin, /requireApiSession\(\[["']admin["']\]\)/);
  assert.match(control, /requireApiSession\(\[["']admin["']\]\)/);
  assert.match(state, /authorization/i);
  assert.match(server, /timingSafeEqual/);
  assert.match(server, /public_token_hash/);
});

test("stream polling is version based and preserves the last valid display state", async () => {
  const display = await read("app/stream/main/StreamDisplay.tsx");
  const server = await read("app/stream/server.ts");
  assert.match(display, /AbortController/);
  assert.match(display, /localStorage/);
  assert.match(display, /visibilitychange/);
  assert.match(display, /BACKOFF\s*=\s*\[3_000, 5_000, 10_000, 30_000\]/);
  assert.match(server, /changed:\s*false/);
  assert.match(server, /knownVersion.*state\.version/);
});

test("stream data stays isolated and automatic results are idempotent", async () => {
  const schema = await read("database/stream-schema.sql");
  const server = await read("app/stream/server.ts");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS stream_channels/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS stream_cues/);
  assert.match(schema, /UNIQUE KEY uq_stream_cue_source/);
  assert.match(server, /INSERT IGNORE INTO stream_cues/);
  assert.match(server, /p\.status = 'announced'/);
  assert.doesNotMatch(server, /UPDATE\s+(programs|programlist|results|students|campus)\s+SET/i);
});

test("the public renderer includes all six scenes and reduced-motion support", async () => {
  const renderer = await read("components/stream/StreamRenderer.tsx");
  for (const scene of ["idle", "announcement", "live", "result", "scoreboard", "next"]) assert.match(renderer, new RegExp(`payload\\.type === ["']${scene}["']`));
  assert.match(renderer, /useReducedMotion/);
  assert.match(renderer, /AnimatedNumber/);
  assert.match(renderer, /confetti/i);
});

