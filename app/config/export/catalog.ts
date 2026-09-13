import { ExportColumn, ExportReportId } from "./types";

export type FilterKey = "search" | "team" | "category" | "program" | "status" | "resultStatus";
export type ExportReportDefinition = {
  id: ExportReportId;
  name: string;
  description: string;
  group: "Core lists" | "Event operations" | "Results and awards" | "Review and audit";
  filters: FilterKey[];
  columns: ExportColumn[];
};

function cols(spec: string): ExportColumn[] {
  return spec.split(";").map((entry, defaultOrder) => {
    const [key, label, valueType = "text", visibility = "show"] = entry.split("|");
    return {
      key,
      label,
      valueType: valueType as ExportColumn["valueType"],
      defaultVisible: visibility !== "hide",
      defaultOrder,
    };
  });
}

export const exportReports: ExportReportDefinition[] = [
  {
    id: "teams", name: "Team list", group: "Core lists",
    description: "Teams with registration strength, entries, and points.",
    filters: ["search", "category", "team"],
    columns: cols("teamId|Team ID;teamName|Team;shortName|Short name;categories|Categories;strength|Strength|number;studentCount|Students|number;entryCount|Entries|number;points|Points|number"),
  },
  {
    id: "students", name: "Student list", group: "Core lists",
    description: "Registered students and their event participation.",
    filters: ["search", "team", "category"],
    columns: cols("jamiaId|Participant ID;studentName|Student;teamId|Team ID|text|hide;teamName|Team;category|Category;groupId|Group ID|text|hide;entryCount|Programs|number;points|Points|number"),
  },
  {
    id: "programs", name: "Program list", group: "Core lists",
    description: "Programs, configuration, progress, and entry totals.",
    filters: ["search", "category", "status"],
    columns: cols("programId|Program ID|number|hide;order|Order|number;programName|Program;category|Category;stageType|Stage type;programType|Program type;members|Members|number;limit|Entry limit|number;status|Status|status;entryCount|Entries|number;finishedCount|Finished|number;resultCount|Results|number"),
  },
  {
    id: "participants", name: "Participant entries", group: "Core lists",
    description: "Every program entry with resolved participant and team details.",
    filters: ["search", "team", "category", "program", "status"],
    columns: cols("entryId|Entry ID|number|hide;programName|Program;category|Category;code|Code;jamiaIds|Participant IDs;participantNames|Participants;teamName|Team;status|Status|status;topic|Topic|text|hide"),
  },
  {
    id: "call_list", name: "Program call list", group: "Event operations",
    description: "Ordered call-room list with an optional signature column.",
    filters: ["search", "team", "category", "program", "status"],
    columns: cols("serial|No.|number;order|Program order|number|hide;programName|Program;category|Category;code|Code;jamiaIds|Participant IDs;participantNames|Participants;teamName|Team;status|Status|status;signature|Signature|blank"),
  },
  {
    id: "judgement_sheet", name: "Judgement sheet", group: "Event operations",
    description: "Printable marking sheet for reported and finished participants.",
    filters: ["search", "team", "category", "program"],
    columns: cols("serial|No.|number;programName|Program;category|Category;code|Code;jamiaIds|Participant IDs;participantNames|Participants|text|hide;teamName|Team|text|hide;judge1|Judge 1|blank;judge2|Judge 2|blank;judge3|Judge 3|blank;total|Total|blank;rank|Rank|blank;remarks|Remarks|blank"),
  },
  {
    id: "program_results", name: "Program results", group: "Results and awards",
    description: "Stored official results without recalculation.",
    filters: ["search", "team", "category", "program", "resultStatus"],
    columns: cols("order|Order|number;programName|Program;category|Category;code|Code|text|hide;rank|Rank|number;jamiaId|Participant ID;studentName|Participant;teamName|Team;grade|Grade;points|Points|number;awardStatus|Award status|status"),
  },
  {
    id: "awards", name: "Award list", group: "Results and awards",
    description: "Rank holders and their award completion status.",
    filters: ["search", "team", "category", "program", "status"],
    columns: cols("order|Order|number;programName|Program;category|Category;code|Code|text|hide;rank|Rank|number;jamiaId|Participant ID;studentName|Participant;teamName|Team;grade|Grade;points|Points|number;awardStatus|Award status|status;signature|Signature|blank"),
  },
  {
    id: "team_entries", name: "Team-wise entries", group: "Event operations",
    description: "Entries grouped and sorted for each team.",
    filters: ["search", "team", "category", "program", "status"],
    columns: cols("teamName|Team;category|Category;programName|Program;code|Code;jamiaIds|Participant IDs;participantNames|Participants;status|Status|status"),
  },
  {
    id: "attendance_exceptions", name: "Attendance exceptions", group: "Event operations",
    description: "Not-reported and cancelled program entries.",
    filters: ["search", "team", "category", "program", "status"],
    columns: cols("programName|Program;category|Category;code|Code;jamiaIds|Participant IDs;participantNames|Participants;teamName|Team;status|Status|status;remarks|Remarks|blank"),
  },
  {
    id: "student_standings", name: "Student point standings", group: "Results and awards",
    description: "Total stored result points for each student.",
    filters: ["search", "team", "category"],
    columns: cols("position|Position|number;jamiaId|Participant ID;studentName|Student;teamName|Team;category|Category;resultCount|Results|number;points|Points|number"),
  },
  {
    id: "team_standings", name: "Team point standings", group: "Results and awards",
    description: "Team totals calculated from stored result points.",
    filters: ["search", "team", "category"],
    columns: cols("position|Position|number;teamId|Team ID;teamName|Team;resultCount|Results|number;points|Points|number"),
  },
  {
    id: "award_progress", name: "Award progress", group: "Results and awards",
    description: "Award completion totals per program.",
    filters: ["search", "category", "program", "status"],
    columns: cols("order|Order|number;programName|Program;category|Category;resultCount|Results|number;awardedCount|Awarded|number;pendingCount|Pending|number;completion|Completion;status|Status|status"),
  },
  {
    id: "judging_audit", name: "Judging audit", group: "Review and audit",
    description: "Raw judge marks alongside stored result decisions.",
    filters: ["search", "team", "category", "program", "status"],
    columns: cols("programName|Program;category|Category;code|Code;jamiaIds|Participant IDs;participantNames|Participants;teamName|Team;mark1|Mark 1|number;mark2|Mark 2|number;mark3|Mark 3|number;normalizedMark|Normalized %|number;rank|Stored rank|number;grade|Stored grade;points|Stored points|number;awardStatus|Result status|status"),
  },
  {
    id: "registration_summary", name: "Registration summary", group: "Review and audit",
    description: "Entry and student totals grouped by team, category, and program.",
    filters: ["search", "team", "category", "program"],
    columns: cols("teamName|Team;category|Category;programName|Program;entryCount|Entries|number;studentCount|Students|number;reportedCount|Reported|number;finishedCount|Finished|number;cancelledCount|Cancelled|number"),
  },
  {
    id: "data_quality", name: "Data-quality exceptions", group: "Review and audit",
    description: "Potential registration and result inconsistencies requiring review.",
    filters: ["search", "team", "category", "program", "status"],
    columns: cols("severity|Severity|status;issueType|Issue;programName|Program;category|Category;code|Code;jamiaIds|Participant IDs;teamName|Team;details|Details"),
  },
];

export const exportReportMap = new Map(exportReports.map((report) => [report.id, report]));

export function isExportReportId(value: string): value is ExportReportId {
  return exportReportMap.has(value as ExportReportId);
}
