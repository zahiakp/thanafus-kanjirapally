import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as crypto from "node:crypto";
function load(path, imports = {}) {
  const code = ts.transpileModule(readFileSync(new URL("../" + path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", code)(name => {
    if (!(name in imports)) throw Error(name);
    return imports[name];
  }, exports);
  return exports;
}
const reveal = load("app/stream/resultReveal.ts");
const playlist = load("app/stream/playlist.ts", { "./resultReveal": reveal });
test("playlist alternates every result with branding and loops, including empty and disabled states", () => {
  const list = { success: true, version: "v", eventTitle: "Test", enabled: true, results: [1, 2].map(id => ({ id, payload: { type: "result", program: String(id), winners: [] } })) };
  const scenes = [0,1,2,3,4].map(tick => playlist.playlistState(list, tick, "2026-11-21T00:00:00Z").scene);
  assert.deepEqual(scenes.map(scene => scene.type), ["result","idle","result","idle","result"]);
  assert.deepEqual(scenes.filter(s => s.type === "result").map(s => s.payload.program), ["1","2","1"]);
  assert.deepEqual(scenes.map(s => s.durationSeconds), [12,10,12,10,12]);
  assert.equal(playlist.playlistState({...list, results: []}, 0, "").scene.type, "idle");
  assert.equal(playlist.playlistState({...list, enabled: false}, 0, "").scene.type, "idle");
});
test("server batches results, shares concurrent cache fills, refreshes corrections/removals, and authenticates cache hits", async () => {
  delete globalThis.resultPlaylistCache; delete globalThis.resultPlaylistPending;
  let queries = 0;
  let rows = [{ id: 1, name: "Speech", category: "junior", isGroup: 0, rank: 1, studentName: "Winner", teamName: "Team", mekhala: "Kanjirappally" }];
  const server = load("app/stream/resultPlaylistServer.ts", {
    crypto,
    "../utils/mysqlDb": { default: { execute: async sql => {
      if (sql.includes("stream_channels")) return [[{ enabled: 1, event_title: "Test", public_token_hash: crypto.createHash("sha256").update("valid").digest("hex") }]];
      assert.match(sql, /p.status = 'announced'/);
      queries++; await new Promise(resolve => setTimeout(resolve, 5)); return [rows];
    }}},
    "../utils/apiAuth": { ApiError: class extends Error {} },
    "../data/branding": { brandName: "Test", categoryMap: {}, certificateEventName: "Test" },
    "./playlist": playlist,
  });
  const [first, second] = await Promise.all([server.getResultPlaylist("valid", false), server.getResultPlaylist("valid", false)]);
  assert.equal(queries, 1); assert.deepEqual(first, second);
  assert.equal(first.results[0].payload.winners[0].mekhala, "Kanjirappally");
  await assert.rejects(server.getResultPlaylist("wrong", false));
  assert.equal(queries, 1);
  rows = [{ ...rows[0], studentName: "Corrected" }, {...rows[0], id: 2}];
  globalThis.resultPlaylistCache.expires = 0;
  const updated = await server.getResultPlaylist("valid", false);
  assert.equal(updated.results.length, 2);
  assert.equal(updated.results[0].payload.winners[0].name, "Corrected");
  assert.notEqual(updated.version, first.version);
  rows = [];
  globalThis.resultPlaylistCache.expires = 0;
  assert.deepEqual((await server.getResultPlaylist("valid", false)).results, []);
  delete globalThis.resultPlaylistCache; delete globalThis.resultPlaylistPending;
});

test("winner reveals show each tied first before each tied second and skip other ranks", () => {
 const winners = [{name:"second-a",rank:2},{name:"first-a",rank:1},{name:"third",rank:3},{name:"first-b",rank:1},{name:"second-b",rank:2}];
 const ordered = reveal.orderedWinners(winners);
 assert.deepEqual(ordered.map(w=>w.name), ["first-a","first-b","second-a","second-b"]);
 assert.equal(reveal.resultDuration(winners),36);
 assert.deepEqual([0,3.9,4,11.9,12,20,28,35.9].map(t=>reveal.winnerIndexAt(t,4)),[-1,-1,0,0,1,2,3,3]);
 assert.equal(reveal.winnerIndexAt(100,0),-1);
});
