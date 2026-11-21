import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { ApiError, apiErrorResponse, requireApiSession } from "../../../utils/apiAuth";
import { objectBody, positiveInteger } from "../../../utils/validation";
import { judgeSlotFromScope, venueJudgeUsername } from "../../../utils/judges";
import { hashPassword } from "../../../utils/password";
import { withVenueTransaction } from "../../../utils/venueAccess";

export async function POST(request: Request) {
  try {
    await requireApiSession(["admin"]);
    const body = objectBody(await request.json());
    const slot = judgeSlotFromScope(body.judgeSlot);
    if (!slot) throw new ApiError("Select a judge mark column.", 400);
    const venueId = positiveInteger(body.venueId, "venueId");
    const password = body.password;
    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
      throw new ApiError("Password must contain 8 to 128 characters.", 400);
    }
    const hashedPassword = await hashPassword(password);
    const data = await withVenueTransaction(async db => {
      const [venues] = await db.execute<RowDataPacket[]>("SELECT id, name FROM venues WHERE id = ? FOR UPDATE", [venueId]);
      if (!venues.length) throw new ApiError("Selected venue no longer exists.", 400);
      const username = venueJudgeUsername(slot, String(venues[0].name));
      if (!username || username.length > 100) throw new ApiError("The venue name cannot be used for a judge login.", 400);
      const [existing] = await db.execute<RowDataPacket[]>("SELECT id FROM access WHERE username = ? LIMIT 1 FOR UPDATE", [username]);
      if (existing.length) throw new ApiError("Username is already in use.", 409);
      const [account] = await db.execute<ResultSetHeader>(
        "INSERT INTO access (username, password, role, campusId) VALUES (?, ?, 'judge', ?)",
        [username, hashedPassword, String(slot)],
      );
      await db.execute("INSERT INTO venue_staff_scope (access_id) VALUES (?)", [account.insertId]);
      await db.execute("INSERT INTO venue_staff_grants (access_id, venue_id) VALUES (?, ?)", [account.insertId, venueId]);
      return { id: account.insertId, username };
    });
    return Response.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string })?.code === "ER_DUP_ENTRY") {
      return apiErrorResponse(new ApiError("Username is already in use.", 409));
    }
    return apiErrorResponse(error);
  }
}
