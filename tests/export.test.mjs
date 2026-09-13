import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("bulk export endpoints and page are admin-only", async () => {
  const proxy = await read("proxy.ts");
  const options = await read("app/api/export/options/route.ts");
  const data = await read("app/api/export/data/route.ts");

  assert.match(proxy, /["']\/api\/export["']:\s*\[["']admin["']\]/);
  assert.match(options, /requireApiSession\(\[["']admin["']\]\)/);
  assert.match(data, /requireApiSession\(\[["']admin["']\]\)/);
});

test("bulk export exposes the complete fixed report and format catalogs", async () => {
  const catalog = await read("app/config/export/catalog.ts");
  const types = await read("app/config/export/types.ts");
  const reportIds = [
    "teams", "students", "programs", "participants", "call_list",
    "judgement_sheet", "program_results", "awards", "team_entries",
    "attendance_exceptions", "student_standings", "team_standings",
    "award_progress", "judging_audit", "registration_summary", "data_quality",
  ];
  const formats = ["pdf", "xlsx", "csv", "docx", "txt", "xml", "json"];

  for (const id of reportIds) assert.match(catalog, new RegExp(`id: ["']${id}["']`));
  for (const format of formats) assert.match(types, new RegExp(`["']${format}["']`));
  assert.doesNotMatch(catalog, /schedule/i);
});

test("bulk export data is bounded, fixed-query, and excludes credential tables", async () => {
  const server = await read("app/config/export/server.ts");
  const route = await read("app/api/export/data/route.ts");

  assert.match(server, /MAX_EXPORT_ROWS\s*=\s*50_000/);
  assert.match(route, /isExportReportId/);
  assert.match(route, /new Set\(exportReportMap\.get\(reportValue\)\?\.filters/);
  assert.doesNotMatch(server, /FROM\s+(access|users?|sessions?|api[_ ]?audit)/i);
  assert.doesNotMatch(server, /SELECT\s+\*/i);
});

test("document limits and CSV spreadsheet-injection protection are enforced", async () => {
  const pdf = await read("app/config/export/generators/pdf.ts");
  const docx = await read("app/config/export/generators/docx.ts");
  const common = await read("app/config/export/generators/common.ts");

  assert.match(pdf, /rows\.length\s*>\s*5_000/);
  assert.match(docx, /rows\.length\s*>\s*5_000/);
  assert.match(common, /spreadsheetSafe/);
  assert.match(common, /\\t\\r/);
});

test("styled exports use explicit title promotion and shared design options", async () => {
  const content = await read("app/config/export/Content.tsx");
  const headers = await read("app/config/export/HeaderConfigurator.tsx");
  const types = await read("app/config/export/types.ts");
  const pdf = await read("app/config/export/generators/pdf.ts");
  const docx = await read("app/config/export/generators/docx.ts");
  const xlsx = await read("app/config/export/generators/xlsx.ts");

  assert.match(headers, /Use as title/);
  assert.match(content, /isStyledFormat\(format\)/);
  assert.match(types, /ExportRenderOptions/);
  assert.match(types, /ExportColumnStyle/);
  for (const source of [pdf, docx, xlsx]) {
    assert.match(source, /renderOptions\.titleLines/);
    assert.match(source, /resolvedColumnStyle/);
    assert.match(source, /rowHeight/);
  }
});

test("data-only formats remain independent of visual render options", async () => {
  const dispatcher = await read("app/config/export/generators/index.ts");
  const textGenerator = await read("app/config/export/generators/text.ts");

  assert.match(dispatcher, /pdfBlob\(prepared, renderOptions\)/);
  assert.match(dispatcher, /xlsxBlob\(prepared, renderOptions\)/);
  assert.match(dispatcher, /docxBlob\(prepared, renderOptions\)/);
  assert.doesNotMatch(textGenerator, /ExportRenderOptions|columnStyles|titleLines/);
});
