import { NextRequest } from "next/server";
import { apiErrorResponse, ApiError, requireApiSession } from "../../../utils/apiAuth";
import { getExportDataset } from "../../../config/export/server";
import { exportReportMap, isExportReportId } from "../../../config/export/catalog";
import { ExportFilters } from "../../../config/export/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireApiSession(["admin"]);
    const reportValue = request.nextUrl.searchParams.get("report") || "";
    if (!isExportReportId(reportValue)) throw new ApiError("Invalid export report", 400);

    const allowed = new Set(exportReportMap.get(reportValue)?.filters || []);
    const value = (key: string) => request.nextUrl.searchParams.get(key)?.trim() || undefined;
    const resultStatus = value("resultStatus");
    if (resultStatus && !["judged", "announced", "all"].includes(resultStatus)) {
      throw new ApiError("Invalid result status", 400);
    }

    const filters: ExportFilters = {
      search: allowed.has("search") ? value("search") : undefined,
      team: allowed.has("team") ? value("team") : undefined,
      category: allowed.has("category") ? value("category") : undefined,
      program: allowed.has("program") ? value("program") : undefined,
      status: allowed.has("status") ? value("status") : undefined,
      resultStatus: allowed.has("resultStatus")
        ? ((resultStatus as ExportFilters["resultStatus"]) || "all")
        : undefined,
    };

    return Response.json(await getExportDataset(reportValue, filters, session.username), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
