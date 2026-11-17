import { NextResponse } from "next/server";
import { apiErrorResponse, requireApiSession } from "../../utils/apiAuth";
import { programVenueFilter, venueScope, withVenueTransaction } from "../../utils/venueAccess";

export async function POST() {
  try {
    const actor = await requireApiSession(["admin", "campus", "judge", "report", "announce", "award", "result"]);
    const programs = await withVenueTransaction(async db => {
      const filter = programVenueFilter(await venueScope(actor, db), "id");
      const [rows] = await db.execute(`SELECT * FROM programs WHERE ${filter.sql}`, filter.values);
      return rows;
    });
    const responseData = programs.map(program=>({...program,stage:!program.stage==0 ? true : false}));

    return NextResponse.json({
      status: "200",
      data: responseData.sort((a, b) => a.name.localeCompare(b.name)),
      message: "Data fetched",
      success: true,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
