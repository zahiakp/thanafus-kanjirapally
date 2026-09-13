# PHP backend changes required by the Artivox hardening pass

The browser now calls `/api/backend/*`. Next.js forwards requests to the PHP backend using private environment credentials. Do not expose the PHP origin or API key to browsers again.

## 1. Rotate and relocate credentials

- Rotate the MySQL password, the old query-string API key, and every password found in the deleted JSON snapshots.
- Store secrets outside the web root using environment variables: `DB_*`, `BACKEND_API_KEY`, and `BACKEND_SIGNING_SECRET`.
- Block direct public access to the PHP origin where possible. Allow only the Next.js deployment/IP or a private network.
- During migration, accept the `api` query parameter only from the trusted proxy. Afterwards remove it and accept `X-API-Key` only.

## 2. Verify the proxy signature before routing

Every proxied request contains:

- `X-Artivox-Timestamp`: Unix seconds.
- `X-Artivox-Actor`: base64url JSON containing the verified Next.js user role and campus scope, or `{ "role": "public" }`.
- `X-Artivox-Signature`: base64url HMAC-SHA256.

Rebuild the canonical string exactly as:

```text
HTTP_METHOD\n
URL_PATH\n
SHA256_HEX_OF_RAW_BODY\n
TIMESTAMP\n
X_ARTIVOX_ACTOR
```

Calculate `hash_hmac('sha256', $canonical, getenv('BACKEND_SIGNING_SECRET'), true)`, base64url-encode it, and compare using `hash_equals`. Reject timestamps more than 60 seconds old. Cache each accepted signature for 90 seconds and reject replays.

## 3. Enforce authorization and campus scope in PHP

- Decode the actor only after signature verification.
- Default-deny every endpoint/action.
- Public GET allowlist: published programs/results and explicitly public participant views only.
- `campus` may read/write only rows whose `campus`/`campusId` equals the signed actor campus.
- `judge` may update marks/topics and judgment statuses, not campuses, accounts, students, or announcements.
- `report`, `award`, `result`, and `announce` should receive only their narrow workflow actions.
- Only `admin` may create campuses/accounts, run imports, change global configuration, or delete programs.
- Never trust `campusId`, `role`, `username`, or category scope supplied in form/query data.

## 4. Replace all SQL interpolation

Use PDO with exceptions and native prepared statements:

```php
$pdo = new PDO($dsn, $user, $password, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_EMULATE_PREPARES => false,
]);
$stmt = $pdo->prepare('UPDATE programList SET mark = :mark WHERE id = :id');
$stmt->execute(['mark' => $mark, 'id' => $id]);
```

Table/column names cannot be parameters; select them only from hardcoded allowlists. Validate request JSON/form fields, maximum lengths, enums, numeric ranges, array sizes, and a 1 MB body limit before querying.

## 5. Password migration

- Change both password columns to `VARCHAR(255)`.
- New/changed passwords: `password_hash($password, PASSWORD_BCRYPT, ['cost' => 12])` so PHP and Next.js can verify the same hashes during migration.
- Login: `password_verify`; if a legacy plaintext password matches once, immediately replace it with a hash.
- Never include password columns in JSON. Select explicit safe columns rather than `SELECT *`.
- Add per-IP and per-username login limits, generic 401 errors, and security audit events.

## 6. Transactions and idempotency

- Wrap campus+access creation/update/deletion in one transaction.
- Wrap bulk student/program/mark/code/topic operations in one transaction and roll back the whole batch on failure.
- Accept an `Idempotency-Key` for imports, result finalization, assignment, and announcement. Store the key and response under a unique constraint.
- Replace `MAX(count)+1` with a locked counter row or atomic sequence table.

## 7. Query and index changes

- Build published results with one joined query over `programs`, `programList`, `students`, and `campus`; remove per-program queries and full-table loads.
- Always parenthesize status logic: `program = ? AND status IN ('finished','awarded')`.
- Paginate list endpoints and cap limits (recommended maximum 100).
- Add indexes after confirming names/types:

```sql
ALTER TABLE access MODIFY password VARCHAR(255) NOT NULL, ADD UNIQUE KEY ux_access_username (username);
ALTER TABLE campus MODIFY password VARCHAR(255) NOT NULL, ADD UNIQUE KEY ux_campus_jamiaNo (jamiaNo);
ALTER TABLE students ADD UNIQUE KEY ux_students_jamiaNo (jamiaNo), ADD KEY ix_students_campus_category (campus, category);
ALTER TABLE programs ADD KEY ix_programs_status_count (status, count);
ALTER TABLE programList ADD KEY ix_programlist_program_status_mark (program, status, mark), ADD KEY ix_programlist_campus (campus), ADD KEY ix_programlist_student (student);
ALTER TABLE Topics ADD KEY ix_topics_program_lang (program, lang);
```

## 8. Response, cache, and operational behavior

- Return real HTTP status codes: 400 validation, 401 unauthenticated, 403 forbidden, 404 missing, 409 conflict, 413 too large, 429 limited, 500 unexpected.
- Mutations and private reads: `Cache-Control: private, no-store`.
- Published result reads may use a short public cache and must be invalidated after announcement changes.
- Add structured request IDs, actor/campus/action audit logs, slow-query logging, error monitoring, database timeouts, and health/readiness endpoints.
- Configure CORS to the Next.js origin only. Do not use `*` with credentials.

## Recommended rollout order

1. Rotate secrets and deploy proxy-signature verification in report-only logging mode.
2. Enable signature enforcement and block direct PHP-origin access.
3. Deploy prepared statements, validation, RBAC/campus scoping, and password migration.
4. Add transactions, constraints, indexes, idempotency, and the joined result queries.
5. Load-test login, student pagination, program assignment, concurrent marking, and published results before the next live event.
