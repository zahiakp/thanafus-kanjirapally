import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../app/utils/judges.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const api = {};
new Function("exports", code)(api);

test("four venues support twelve distinct judge logins with the correct mark slots", () => {
  const usernames = new Set();
  for (const venue of ["Stage A", "Stage B", "Stage C", "Stage D"]) {
    for (const slot of [1, 2, 3]) {
      const username = api.venueJudgeUsername(slot, venue);
      usernames.add(username);
      assert.equal(api.judgeSlotFromUsername(username), slot);
      assert.equal(api.markKeyForJudge(api.judgeSlotFromUsername(username)), slot === 1 ? "mark" : "mark" + slot);
    }
  }
  assert.equal(usernames.size, 12);
});
test("venue names normalize consistently and legacy accounts still resolve", () => {
  assert.equal(api.venueJudgeUsername(2, "  Main / Stage  "), "judge-2-main-stage");
  assert.equal(api.venueJudgeUsername(1, " --- "), "");
  for (const slot of [1, 2, 3]) assert.equal(api.judgeSlotFromUsername("judge-" + slot), slot);
  for (const value of ["judge-4-stage-a", "judge-1-", "judge-1--stage", "admin"]) {
    assert.equal(api.judgeSlotFromUsername(value), null);
  }
});
