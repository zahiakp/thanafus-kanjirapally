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
