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
const scores = load("app/utils/scoreboard.ts");
const tables = load("app/stream/scoreTable.ts");
const playlist = load("app/stream/playlist.ts", { "./resultReveal": reveal, "./scoreTable": tables });
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
    "../utils/scoreboard": scores,
    "../utils/mysqlDb": { default: { execute: async sql => {
      if (sql.includes("stream_channels")) return [[{ enabled: 1, event_title: "Test", public_token_hash: crypto.createHash("sha256").update("valid").digest("hex") }]];
      if (sql.includes("FROM campus ORDER")) return [[{id:"team",name:"Team"}]];
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

test("table slides cap columns and rows and repeat overall totals across category pages", () => {
 const programs = Array.from({length:6}, (_,i)=>({id:String(i),name:"Program "+i,category:i%2?"Junior":"Senior"}));
 const teams = Array.from({length:8},(_,i)=>({id:String(i),name:"Team "+i,scores:{"0":[{id:"a"+i,point:10,kind:"first"}],"5":[{id:"b"+i,point:5,kind:"grade"}]}}));
 const board = {programs, teams};
 const pages = tables.scoreTablePages(board);
 assert.equal(pages.length,4);
 assert.deepEqual(pages.map(p=>p.programs.length),[5,5,1,1]);
 assert.deepEqual(pages.map(p=>p.teams.length),[7,1,7,1]);
 for(const page of pages) for(const team of page.teams) assert.equal(team.total,15);
 const list = {success:true,enabled:true,eventTitle:"Test",version:"v",results:[{id:1,payload:{type:"result",winners:[]}}],scoreboard:board};
 assert.deepEqual([0,1,2,3,4,5,6,7].map(t=>playlist.playlistState(list,t,"").scene.type),["result","idle","scoretable","scoretable","scoretable","scoretable","idle","result"]);
 assert.equal(playlist.playlistState({...list,enabled:false},2,"").scene.type,"idle");
});
test("team points follow every five program results and the final partial batch", () => {
  const list = {
    success: true, enabled: true, eventTitle: "Test", version: "v",
    results: Array.from({length:12}, (_,i)=>({id:i+1,payload:{type:"result",program:String(i+1),winners:[]}})),
    scoreboard: {programs:[{id:"1",name:"Program",category:"Junior"}],teams:[{id:"a",name:"Team",scores:{}}]},
  };
  let count = 0;
  const batches = [];
  const seen = [];
  for (let tick = 0; tick < 30; tick++) {
    const scene = playlist.playlistState(list,tick,"").scene;
    if (scene.type === "result") { count++; seen.push(scene.payload.program); }
    if (scene.type === "scoretable") { batches.push(count); count=0; }
  }
  assert.deepEqual(batches,[5,5,2]);
  assert.deepEqual(seen,Array.from({length:12},(_,i)=>String(i+1)));
  assert.equal(playlist.playlistState(list,30,"").scene.payload.program,"1");
});
