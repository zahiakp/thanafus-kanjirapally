import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("leaderboard sync is admin-only and public reads use the snapshot table", async () => {
  const [route, proxy, group] = await Promise.all([read("app/api/leaderboard/route.ts"), read("proxy.ts"), read("app/results/Group.tsx")]);
  assert.match(route, /requireApiSession\(\["admin"\]\)/);
  assert.match(route, /DELETE FROM leaderboard/);
  assert.match(route, /p\.status = 'announced'/);
  assert.ok(route.includes("p.\\`order\\` <= ?"));
  assert.match(proxy, /"\/api\/leaderboard"/);
  assert.match(group, /Sync leaderboard/);
});

test("public participant results show the synced leaderboard before programs", async () => {
  const [page, component, stream] = await Promise.all([read("app/participant/results/page.tsx"), read("app/participant/results/Leaderboard.tsx"), read("app/stream/server.ts")]);
  assert.ok(page.indexOf("<Leaderboard") < page.indexOf("Filter and Search Controls"));
  assert.match(component, /fetch\("\/api\/leaderboard"/);
  assert.match(stream, /FROM leaderboard l/);
});

test("branding assets bypass auth and participant navigation is responsive", async () => {
  const [proxy, layout, footer] = await Promise.all([read("proxy.ts"), read("app/participant/layout.tsx"), read("app/participant/FooterNav.tsx")]);
  assert.match(proxy, /meelad-logo\.png/);
  assert.match(proxy, /letter-head\.png/);
  assert.match(proxy, /letter-head-2\.png/);
  assert.doesNotMatch(layout, /<html|<body/);
  assert.match(footer, /fixed inset-x-0 bottom-0/);
});
