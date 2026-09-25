import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = (relative) => fs.readFileSync(path.join(process.cwd(), relative), "utf8");

test("result modal handlers validate data before opening", () => {
  for (const relative of [
    "app/results/AnnounceList.tsx",
    "app/judgement/Finalize.tsx",
    "app/published/AnnounceList.tsx",
    "app/autoposter/PosterMaker.tsx",
  ]) {
    const content = source(relative);
    assert.match(content, /Array\.isArray\(response\.data\)/);
    assert.match(content, /response\.data\.length === 0/);
    assert.match(content, /showMessage\(/);
    assert.doesNotMatch(content, /console\.log\(drop\)/);
  }
});

test("ResultCard tolerates missing data and normalizes numeric ranks", () => {
  const card = source("components/common/ResultCard.tsx");
  assert.match(card, /Array\.isArray\(data\?\.result\)/);
  assert.match(card, /result\.length > 0/);
  assert.match(card, /String\(item\.rank\)/);
  assert.match(card, /No result is available for this program/);
  assert.doesNotMatch(card, /console\.log\(result\)/);
});

test('result order puts placements before grade-only entries without mutating input', async () => {
  const ts = (await import('typescript')).default;
  const code = ts.transpileModule(source('app/utils/resultOrder.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('exports', code)(exports);
  const entries = [{rank:'0',point:3},{rank:'2',point:8},{rank:'1',point:10},{rank:0,point:5},{rank:null,point:3}];
  const sorted = exports.sortResultEntries(entries);
  assert.deepEqual(sorted.map(row=>row.point), [10,8,5,3,3]);
  assert.equal(entries[0].rank, '0');
  assert.deepEqual(exports.sortResultEntries([]), []);
});
