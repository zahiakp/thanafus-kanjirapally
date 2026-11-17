import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiSession } from "../../utils/apiAuth";
import { programVenueFilter, venueScope, withVenueTransaction } from "../../utils/venueAccess";

export async function POST() {
  try {
    const actor = await requireApiSession(["admin", "judge"]);
    const topics = await withVenueTransaction(async db => {
      const filter = programVenueFilter(await venueScope(actor, db), "program");
      const [rows] = await db.execute(`SELECT * FROM topics WHERE ${filter.sql}`, filter.values);
      return rows;
    });
    const responseData = topics.sort((a,b)=>a.id-b.id);
    return NextResponse.json({
      staus: "200",
      data: responseData,
      message: "Data fetched",
      success: true,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
