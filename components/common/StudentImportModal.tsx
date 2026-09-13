"use client";

import BulkImportModal from "./BulkImportModal";
import { categoryMap } from "../../app/data/branding";
import { valueFromRow } from "../../app/utils/bulkImport";

interface StudentImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void | Promise<void>;
  campusId?: string;
  allowedCategories?: string[];
}

export default function StudentImportModal({ open, onClose, onImported, campusId, allowedCategories = [] }: StudentImportModalProps) {
  const allowed = new Set(allowedCategories.filter(Boolean));

  return <BulkImportModal
    open={open}
    onClose={onClose}
    onImported={onImported}
    resource="students"
    title="Import Students"
    columns={[
      { header: "name", required: true, description: "Student's full name (maximum 150 characters)." },
      { header: "jamiaNo", required: true, description: "Unique participant/Jamia ID." },
      { header: "category", required: true, description: `Category key: ${Object.keys(categoryMap).join(", ")}.` },
      { header: "campus", required: false, description: "Team ID. Campus users are always scoped to their signed-in team." },
    ]}
    previewColumns={[
      { key: "jamiaNo", label: "Participant ID" },
      { key: "name", label: "Name" },
      { key: "category", label: "Category", render: (value) => categoryMap[String(value)] || String(value || "—") },
      { key: "campus", label: "Team" },
    ]}
    sampleRows={[{ name: "Muhammed Ali", jamiaNo: "QAS001", category: "juniorB", campus: campusId || "QAS01" }]}
    duplicateKey={(row) => String(row.jamiaNo || "")}
    normalizeRow={(raw) => {
      const name = String(valueFromRow(raw, ["name", "studentName"])).trim();
      const jamiaNo = String(valueFromRow(raw, ["jamiaNo", "number", "participantId", "studentId"])).trim().toUpperCase();
      const category = String(valueFromRow(raw, ["category", "categoryKey"])).trim();
      const campus = String(campusId || valueFromRow(raw, ["campus", "campusId", "team", "teamId"])).trim().toUpperCase();
      const errors: string[] = [];

      if (!name) errors.push("name is required");
      else if (name.length > 150) errors.push("name must be 150 characters or fewer");
      if (!jamiaNo) errors.push("jamiaNo is required");
      else if (jamiaNo.length > 100) errors.push("jamiaNo must be 100 characters or fewer");
      if (!category) errors.push("category is required");
      else if (!categoryMap[category]) errors.push("category key is not supported");
      else if (allowed.size && !allowed.has(category)) errors.push("category is not enabled for this team");
      if (!campus) errors.push("campus/team ID is required");

      return { data: { name, jamiaNo, category, campus }, errors };
    }}
  />;
}
