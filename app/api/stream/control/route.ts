import { apiErrorResponse, ApiError, requireApiSession } from "../../../utils/apiAuth";
import { objectBody, positiveInteger, requiredString } from "../../../utils/validation";
import { controlStream } from "../../../stream/server";
import { StreamControlCommand, StreamSceneType } from "../../../stream/types";

const actions = new Set(["toggle_enabled", "toggle_automatic", "set_event_title", "set_live", "set_next", "queue_announcement", "show_scene", "show_result", "skip", "unpin", "clear_queue", "regenerate_token"]);
const sceneTypes = new Set<StreamSceneType>(["idle", "live", "scoreboard", "next"]);
const boolean = (body: Record<string, unknown>, key: string) => {
  if (typeof body[key] !== "boolean") throw new ApiError(`${key} must be true or false`, 400);
  return body[key] as boolean;
};
const nullableId = (value: unknown, key: string) => value == null || value === "" ? null : positiveInteger(value, key);
const duration = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 10 || parsed > 60) throw new ApiError("duration must be between 10 and 60 seconds", 400);
  return parsed;
};

function commandFrom(body: Record<string, unknown>): StreamControlCommand {
  const action = requiredString(body, "action", 40);
  if (!actions.has(action)) throw new ApiError("Unknown stream command", 400);
  if (action === "toggle_enabled") return { action, enabled: boolean(body, "enabled") };
  if (action === "toggle_automatic") return { action, automatic: boolean(body, "automatic") };
  if (action === "set_event_title") return { action, eventTitle: requiredString(body, "eventTitle", 160) };
  if (action === "set_live") return { action, programId: nullableId(body.programId, "programId"), entryId: nullableId(body.entryId, "entryId") };
  if (action === "set_next") return { action, programId: nullableId(body.programId, "programId") };
  if (action === "queue_announcement") return {
    action, title: requiredString(body, "title", 120), message: requiredString(body, "message", 600),
    urgent: boolean(body, "urgent"), duration: duration(body.duration), showNow: boolean(body, "showNow"), pin: boolean(body, "pin"),
  };
  if (action === "show_scene") {
    const sceneType = requiredString(body, "sceneType", 32) as StreamSceneType;
    if (!sceneTypes.has(sceneType)) throw new ApiError("Invalid scene type", 400);
    return { action, sceneType: sceneType as "idle" | "live" | "scoreboard" | "next", duration: duration(body.duration), pin: boolean(body, "pin") };
  }
  if (action === "show_result") return { action, programId: positiveInteger(body.programId, "programId"), duration: duration(body.duration), showNow: boolean(body, "showNow") };
  return { action: action as "skip" | "unpin" | "clear_queue" | "regenerate_token" };
}

export async function POST(request: Request) {
  try {
    const session = await requireApiSession(["admin"]);
    const command = commandFrom(objectBody(await request.json()));
    return Response.json(await controlStream(command, session.username), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}

