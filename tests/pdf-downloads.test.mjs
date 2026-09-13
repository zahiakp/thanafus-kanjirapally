import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const source = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("participant PDFs use the authenticated local participant endpoint", () => {
  const functions = source("app/programs/func.ts");
  const route = source("app/api/programList/route.js");
  assert.match(functions, /fetch\(`\/api\/programList\?\$\{params\.toString\(\)\}`/);
  assert.doesNotMatch(functions, /participants\/action\.php\?api=.*program/);
  assert.match(route, /export async function GET\(request\)/);
  assert.match(route, /requireApiSession\(ALLOWED_ROLES\)/);
  assert.match(route, /pl\.program = \?/);
  assert.match(route, /session\.role === "campus" \? session\.campusId/);
  assert.match(route, /SELECT jamiaNo, name FROM students WHERE jamiaNo IN/);
});

test("participant and result PDF renderers load branding before drawing tables", () => {
  for (const relative of ["components/common/GenaratePdf.tsx", "app/published/GenaratePdf.tsx"]) {
    const renderer = source(relative);
    assert.match(renderer, /import autoTable from "jspdf-autotable"/);
    assert.match(renderer, /loadPdfImage/);
    assert.match(renderer, /Promise<Blob>/);
    assert.match(renderer, /autoTable\(doc, \{/);
    assert.match(renderer, /willDrawPage/);
    assert.doesNotMatch(renderer, /\(doc as any\)\.autoTable/);
  }
});

test("all participant and published-result downloads await PDF creation", () => {
  for (const relative of [
    "app/programs/ProgramList.tsx",
    "app/programs/CatBased.tsx",
    "app/published/AnnounceList.tsx",
    "app/autoposter/PosterMaker.tsx",
  ]) {
    const caller = source(relative);
    assert.match(caller, /await generatePDF\(/);
    assert.match(caller, /downloadPdfBlob\(/);
  }
  const resultFunctions = source("app/judgement/func.ts");
  assert.match(resultFunctions, /results\/action\.php/);
  assert.match(resultFunctions, /action: "proResult"/);
  assert.match(resultFunctions, /Array\.isArray\(result\.data\)/);
  assert.doesNotMatch(resultFunctions, /\/api\/result\/announced\/program/);
});
