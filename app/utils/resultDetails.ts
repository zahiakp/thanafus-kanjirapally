import pool from "./mysqlDb";
import type { RowDataPacket } from "mysql2/promise";

// Enrich only result rows already authorized by the upstream result endpoint.
export async function enrichResultDetails(payload: any) {
  if (!payload?.success || !Array.isArray(payload.data) || !payload.data.length) return payload;
  const ids = [...new Set<number>(payload.data.map((row: any) => Number(row.id))
    .filter((id: number) => Number.isSafeInteger(id) && id > 0))];
  if (!ids.length) return payload;
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT r.id, r.code, s.mekhala FROM results r " +
    "LEFT JOIN students s ON s.jamiaNo = SUBSTRING_INDEX(REPLACE(r.student, ',', '&'), '&', 1) " +
    "WHERE r.id IN (" + ids.map(() => "?").join(",") + ")", ids,
  );
  const details = new Map(rows.map(row => [Number(row.id), row]));
  return { ...payload, data: payload.data.map((row: any) => {
    const detail = details.get(Number(row.id));
    return detail ? { ...row, code: detail.code ?? row.code, mekhala: detail.mekhala ?? "" } : row;
  }) };
}
