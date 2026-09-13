"use client";

import BulkImportModal from "./BulkImportModal";
import { categoryMap } from "../../app/data/branding";
import { parseBooleanValue, valueFromRow } from "../../app/utils/bulkImport";

interface ProgramImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void | Promise<void>;
}

export default function ProgramImportModal({ open, onClose, onImported }: ProgramImportModalProps) {
  return <BulkImportModal
    open={open}
    onClose={onClose}
    onImported={onImported}
    resource="programs"
    title="Import Programs"
    columns={[
      { header: "name", required: true, description: "Program name (maximum 150 characters)." },
      { header: "category", required: true, description: `Category key: ${Object.keys(categoryMap).join(", ")}.` },
      { header: "stage", required: true, description: "1/yes/stage or 0/no/offstage." },
      { header: "isGroup", required: true, description: "1/yes/group or 0/no/individual." },
      { header: "limitCount", required: true, description: "Maximum entries allowed; positive integer." },
      { header: "members", required: false, description: "Members per entry; defaults to 1." },
      { header: "campus", required: false, description: "Optional team ID for team-specific program records." },
    ]}
    previewColumns={[
      { key: "name", label: "Program" },
      { key: "category", label: "Category", render: (value) => categoryMap[String(value)] || String(value || "—") },
      { key: "stage", label: "Venue", render: (value) => Number(value) === 1 ? "Stage" : "Off-stage" },
      { key: "isGroup", label: "Type", render: (value) => Number(value) === 1 ? "Group" : "Individual" },
      { key: "limitCount", label: "Limit" },
      { key: "members", label: "Members" },
    ]}
    sampleRows={[{ name: "English Speech", category: "juniorB", stage: 1, isGroup: 0, limitCount: 2, members: 1, campus: "" }]}
    duplicateKey={(row) => `${row.name || ""}|${row.category || ""}|${row.stage ?? ""}`}
    normalizeRow={(raw) => {
      const name = String(valueFromRow(raw, ["name", "programName"])).trim();
      const category = String(valueFromRow(raw, ["category", "categoryKey"])).trim();
      const stage = parseBooleanValue(valueFromRow(raw, ["stage", "isStage"]));
      const isGroup = parseBooleanValue(valueFromRow(raw, ["isGroup", "group", "groupItem"]));
      const limitCount = Number(valueFromRow(raw, ["limitCount", "limit", "participantLimit"]));
      const membersValue = valueFromRow(raw, ["members", "memberCount"]);
      const members = String(membersValue).trim() ? Number(membersValue) : 1;
      const campus = String(valueFromRow(raw, ["campus", "campusId", "team", "teamId"])).trim().toUpperCase();
      const errors: string[] = [];

      if (!name) errors.push("name is required");
      else if (name.length > 150) errors.push("name must be 150 characters or fewer");
      if (!categoryMap[category]) errors.push("category key is not supported");
      if (stage === null) errors.push("stage must be 1/0, yes/no, or stage/offstage");
      if (isGroup === null) errors.push("isGroup must be 1/0, yes/no, or group/individual");
      if (!Number.isSafeInteger(limitCount) || limitCount < 1) errors.push("limitCount must be a positive integer");
      if (!Number.isSafeInteger(members) || members < 1 || members > 100) errors.push("members must be between 1 and 100");

      return { data: { name, category, stage, isGroup, limitCount, members, ...(campus ? { campus } : {}) }, errors };
    }}
  />;
}
