import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { UpdateMarks } from "../../app/programs/func";
import { showMessage } from "./CusToast";
import { useCookies } from "react-cookie";
import { accessCookieName, categoryMap } from "../../app/data/branding";
import { judgeSlotFromScope, judgeSlotFromUsername, markKeyForJudge } from "../../app/utils/judges";

const markColumns = [
  { slot: 1, key: "mark", statusKey: "mark1Marked" },
  { slot: 2, key: "mark2", statusKey: "mark2Marked" },
  { slot: 3, key: "mark3", statusKey: "mark3Marked" },
] as const;
const markKeys = markColumns.map(({ key }) => key);
type MarkKey = (typeof markColumns)[number]["key"];

function AddResult({
  close,
  data,
  fetch,
}: {
  close: any;
  data: any;
  fetch: any;
}) {
  const [loading, setLoading] = useState(false);
  const { program } = data;
  const [cookies] = useCookies([accessCookieName]);
  const profile = cookies[accessCookieName];
  const judgeSlot = profile?.role === "judge" ? judgeSlotFromUsername(profile.username) ?? judgeSlotFromScope(profile.judgeSlot ?? profile.campusId) : null;
  const editableMarkKeys: readonly MarkKey[] = !profile
    ? []
    : judgeSlot ? [markKeyForJudge(judgeSlot)]
    : profile.role === "admin" || profile.role === "judge" ? markKeys : [];
  const [participants, setParticipants] = useState<any>();
  
  useEffect(() => {
  if (data && data.participants) {
    const sortedAndFiltered = data.participants
  .filter((p: any) => p.code != null)
  .sort((a: any, b: any) => codeToNumber(a.code!) - codeToNumber(b.code!));
    setParticipants(sortedAndFiltered);
  }
}, [data]);

  const updateParticipantMark = (participantId: number, key: MarkKey, rawValue: string) => {
    const value = rawValue === "" ? 0 : Number(rawValue);
    if (!Number.isFinite(value) || value < 0 || value > 100) return;
    setParticipants((previous: any[]) => previous.map((participant) =>
      participant.id === participantId ? { ...participant, [key]: value } : participant
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);

  try {
    const toUpdate = participants.flatMap((item:any) => {
      const original = data.participants.find((o:any) => o.id === item.id);
      if (!original) return [];
      const update: { id: number; mark?: number; mark2?: number; mark3?: number } = { id: item.id };
      for (const key of editableMarkKeys) {
        if (item[key] !== original[key]) update[key] = Number(item[key]);
      }
      return Object.keys(update).length > 1 ? [update] : [];
    });

    if (toUpdate.length === 0) {
      showMessage("No changes detected.", "error");
      return;
    }
    await UpdateMarks(toUpdate);
    showMessage("All participants updated successfully.", "success");

    // refresh data/UI
    await fetch();
    close(false);

  } catch (error: any) {
    showMessage(error.message || "Mark update failed.", "error");
  } finally {
    setLoading(false);
  }
};


const rowValid = {
  mark: participants?.some((participant: any) => participant.mark > 0) ?? false,
  mark2: participants?.some((participant: any) => participant.mark2 > 0) ?? false,
  mark3: participants?.some((participant: any) => participant.mark3 > 0) ?? false,
};

if(!participants || participants.length == 0){
  return (
    <p>no participants found</p>
  )
}

  return (
    <Modal close={close} className="w-fix" edit={false}>
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <h6 className="font-bold text-2xl mb-3 w-full text-center">
          {program.name} <p className="text-lg">{`(${categoryMap[program.category]})`}</p>
        </h6>

        <div className="gap-3 mx-auto overflow-auto grid grid-cols-1">
        <p className="text-center text-sm font-medium text-gray-600">
          {!profile ? "Loading judge access..." : judgeSlot ? `You can edit mark column ${judgeSlot} only.` : "You can edit all three mark columns."}
        </p>
          {participants.filter((item:any)=>item.status != "cancelled").map((student: any) => (
            <div
              key={student.id}
              className="flex gap-3 items-center bg-zinc-100 p-2 rounded-xl"
            >
              <label className="min-w-8 font-medium text-zinc-800" htmlFor={`mark-${student.id}-1`}>{student.code}</label>
              {markColumns.map((column) => {
                const editable = editableMarkKeys.includes(column.key);
                if (judgeSlot && !editable) {
                  const marked = Boolean(student[column.statusKey]);
                  return (
                    <span
                      key={column.key}
                      className={`min-w-28 rounded-full px-3 py-2 text-center text-xs font-semibold ${marked ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"}`}
                      aria-label={`Judge ${column.slot}: ${marked ? "Marked" : "Not marked"}`}
                    >
                      {marked ? "Marked" : "Not marked"}
                    </span>
                  );
                }
                return (
                  <label key={column.key} className="relative">
                    <span className="sr-only">Judge {column.slot} mark for {student.code}</span>
                    <input
                      value={student[column.key] === 0 ? "" : student[column.key] ?? ""}
                      onChange={(event) => updateParticipantMark(student.id, column.key, event.target.value)}
                      type="number"
                      id={`mark-${student.id}-${column.slot}`}
                      style={{ width: "100px" }}
                      className={`p-2 px-5 ${rowValid[column.key] ? "border-green-500 bg-green-50 text-green-700" : ""}`}
                      disabled={loading || !editable}
                      min="0"
                      max="100"
                      aria-label={`Judge ${column.slot} mark for participant ${student.code}`}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-zinc-400">/100</span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
        <button
          className="bg-gradient-to-tr mt-5 from-primary-400 to-primary-600 text-white p-3 px-5 rounded-xl font-semibold flex justify-center items-center"
          disabled={loading || editableMarkKeys.length === 0}
        >
          {loading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>{" "}
              Updating...
            </>
          ) : (
            "Update"
          )}
        </button>
      </form>
    </Modal>
  );
}

export default AddResult;

export function codeToNumber(code: string): number {
  let num = 0;
  for (let index = 0; index < code.length; index += 1) {
    num = num * 26 + (code.charCodeAt(index) - 64);
  }
  return num;
}
