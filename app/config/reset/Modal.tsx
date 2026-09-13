"use client";

import { useMemo, useState } from "react";
import { HiExclamationTriangle } from "react-icons/hi2";
import Modal from "../../../components/common/Modal";
import { showMessage } from "../../../components/common/CusToast";
import {
  ProgramStatus,
  ResetOperations,
  ResetProgram,
  resetProgram,
} from "./func";

const stages: ProgramStatus[] = [
  "pending",
  "reporting",
  "ongoing",
  "finished",
  "resulted",
  "judged",
  "announced",
];
const stageLabels: Record<ProgramStatus, string> = {
  pending: "Pending",
  reporting: "Reporting",
  ongoing: "Ongoing",
  finished: "Judging",
  resulted: "Finalizing",
  judged: "Announce",
  announced: "Award",
};
const label = (value: ProgramStatus) => stageLabels[value];

type OperationKey = keyof ResetOperations;
type OperationMode = "required" | "recommended" | "optional";
type ResetAction = {
  key: OperationKey;
  label: string;
  mode: OperationMode;
  help?: string;
};
type ResetRule = { actions: ResetAction[] };

const resetRules: Record<ProgramStatus, ResetRule> = {
  pending: {
    actions: [
      { key: "clearCodes", label: "Remove participant codes", mode: "required" },
      { key: "participantStatus", label: "Move all participants back to Not reported", mode: "required" },
      { key: "clearMarks", label: "Remove entered marks", mode: "required" },
      { key: "clearResults", label: "Remove calculated results", mode: "required" },
    ],
  },
  reporting: {
    actions: [
      {
        key: "clearCodes",
        label: "Remove participant codes",
        mode: "recommended",
        help: "Uncheck this if participants should keep their existing codes.",
      },
      {
        key: "participantStatus",
        label: "Reopen completed or cancelled participants",
        mode: "required",
        help: "Existing reporting statuses stay unchanged. Completed or cancelled participants return to Reported when they have a code, otherwise Not reported.",
      },
      { key: "clearMarks", label: "Remove entered marks", mode: "required" },
      { key: "clearResults", label: "Remove calculated results", mode: "required" },
    ],
  },
  ongoing: {
    actions: [
      {
        key: "clearCodes",
        label: "Remove participant codes",
        mode: "optional",
        help: "Select only when you want to assign fresh codes.",
      },
      {
        key: "participantStatus",
        label: "Reopen completed or cancelled participants",
        mode: "required",
        help: "They return to Reported when they have a code, otherwise Not reported.",
      },
      { key: "clearMarks", label: "Remove entered marks", mode: "required" },
      { key: "clearResults", label: "Remove calculated results", mode: "required" },
    ],
  },
  finished: {
    actions: [
      {
        key: "clearMarks",
        label: "Remove entered marks",
        mode: "optional",
        help: "Select only if judging must restart with empty marks.",
      },
      { key: "clearResults", label: "Remove calculated results", mode: "required" },
    ],
  },
  resulted: {
    actions: [
      { key: "clearResultStatuses", label: "Undo awarded selections", mode: "required" },
    ],
  },
  judged: {
    actions: [
      {
        key: "clearResultStatuses",
        label: "Undo awarded selections",
        mode: "required",
        help: "Calculated results are kept.",
      },
    ],
  },
  announced: { actions: [] },
};

function initialOperations(target: ProgramStatus): ResetOperations {
  const selected: ResetOperations = {
    clearOrder: false,
    clearCodes: false,
    participantStatus: false,
    clearMarks: false,
    clearTopics: false,
    clearResults: false,
    clearResultStatuses: false,
  };
  for (const action of resetRules[target].actions)
    selected[action.key] = action.mode !== "optional";
  return selected;
}

export default function ResetModal({
  program,
  close,
  onComplete,
}: {
  program: ResetProgram;
  close: () => void;
  onComplete: () => Promise<void>;
}) {
  const validTargets = useMemo(
    () => stages.slice(0, stages.indexOf(program.status)),
    [program.status],
  );
  const initialTarget = validTargets[0] ?? "pending";
  const [targetStatus, setTargetStatus] =
    useState<ProgramStatus>(initialTarget);
  const [operations, setOperations] = useState<ResetOperations>(() =>
    initialOperations(initialTarget),
  );
  const [loading, setLoading] = useState(false);
  const rule = resetRules[targetStatus];

  function changeTarget(status: ProgramStatus) {
    setTargetStatus(status);
    setOperations(initialOperations(status));
  }

  async function submit() {
    setLoading(true);
    try {
      const response = await resetProgram(program.id, targetStatus, operations);
      showMessage(
        "Program reset. " +
          (response.summary.resultRecordsRemoved || 0) +
          " result records removed.",
        "success",
      );
      await onComplete();
    } catch (cause) {
      showMessage(
        cause instanceof Error ? cause.message : "Reset failed",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal close={close}>
      <div className="flex w-full max-w-lg flex-col gap-5">
        <div>
          <h2 className="text-xl font-semibold">Reset {program.name}</h2>
          <p className="text-sm text-gray-500">
            Current stage: {label(program.status)}
          </p>
        </div>
        <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <HiExclamationTriangle className="mt-0.5 shrink-0 text-xl" />
          <p>
            Locked actions are automatic because the target stage would
            otherwise contain conflicting data. Enabled actions can be selected
            manually.
          </p>
        </div>
        <label className="grid gap-2 text-sm font-medium">
          Reset program to
          <select
            value={targetStatus}
            onChange={(event) =>
              changeTarget(event.target.value as ProgramStatus)
            }
            className="rounded-lg border border-gray-300 p-2 font-normal"
          >
            {validTargets.map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium mb-2">Data actions</legend>
          <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-sm">
            <input
              type="checkbox"
              checked
              disabled
              className="mt-0.5 checkbox !rounded-[6px] checkbox-sm border-primary-500 [--chkbg:theme(colors.primary.500)] [--chk:white]"
            />
            <span>
              Set program status to {label(targetStatus)}
              <span className="ml-2 text-xs font-medium text-amber-700">
                Automatic
              </span>
            </span>
          </label>
          {rule.actions.map((action) => {
            const automatic = action.mode === "required";
            return (
              <label
                key={action.key}
                className={
                  "flex items-start gap-3 rounded-lg border p-3 text-sm " +
                  (automatic
                    ? "border-amber-200 bg-amber-50/50"
                    : "border-gray-200")
                }
              >
                <input
                  type="checkbox"
                  checked={operations[action.key]}
                  disabled={automatic || loading}
                  onChange={(event) =>
                    setOperations((current) => ({
                      ...current,
                      [action.key]: event.target.checked,
                    }))
                  }
                  className= {`${!automatic ? "border-primary-500 [--chkbg:theme(colors.primary.500)]" :"border-orange-500 [--chkbg:theme(colors.orange.500)]"} mt-0.5 checkbox !rounded-[6px] checkbox-sm border-primary-500 [--chkbg:theme(colors.primary.500)] [--chk:white]`}
                />
                <span>
                  <span className="block">
                    {action.label}
                    <span
                      className={
                        "ml-2 text-xs font-medium " +
                        (automatic
                          ? "text-amber-700"
                          : action.mode === "recommended"
                            ? "text-blue-700"
                            : "text-gray-500")
                      }
                    >
                      {automatic
                        ? "Automatic"
                        : action.mode === "recommended"
                          ? "Recommended"
                          : "Optional"}
                    </span>
                  </span>
                  {action.help && (
                    <span className="mt-1 block text-xs leading-relaxed text-gray-500">
                      {action.help}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </fieldset>
        <div className="flex justify-end gap-3">
          <button
            onClick={close}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "Resetting..." : "Confirm reset"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
