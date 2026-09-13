import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

test('bulk imports use the signed PHP proxy and validate before commit', async () => {
  const api = await read('app/utils/bulkImport.ts');
  const modal = await read('components/common/BulkImportModal.tsx');

  assert.match(api, /\/api\/backend\/\$\{resource\}\/action\.php\?action=bulkUpload/);
  assert.match(modal, /"validate"/);
  assert.match(modal, /"commit"/);
  assert.ok(modal.indexOf('"validate"') < modal.indexOf('"commit"'));
});

test('file imports enforce size and row limits before upload', async () => {
  const source = await read('app/utils/bulkImport.ts');
  assert.match(source, /MAX_IMPORT_ROWS = 1_000/);
  assert.match(source, /MAX_FILE_BYTES = 5 \* 1024 \* 1024/);
  assert.match(source, /Choose an \.xlsx or \.csv file/);
});

test('student and program imports use branded category keys', async () => {
  const student = await read('components/common/StudentImportModal.tsx');
  const program = await read('components/common/ProgramImportModal.tsx');
  assert.match(student, /categoryMap\[category\]/);
  assert.match(program, /categoryMap\[category\]/);
});
test('bulk import failures expose backend reasons and request IDs', async () => {
  const api = await read('app/utils/bulkImport.ts');
  const modal = await read('components/common/BulkImportModal.tsx');
  const proxy = await read('app/api/backend/[...path]/route.ts');

  assert.match(api, /response\.headers\.get\("x-request-id"\)/);
  assert.match(api, /firstRowError/);
  assert.match(modal, /firstBackendError/);
  assert.match(proxy, /responseHeaders\.set\("x-request-id"/);
});
