import pool from "../../utils/mysqlDb";
import { categoryMap } from "../../data/branding";
import { ApiError } from "../../utils/apiAuth";
import { exportReportMap } from "./catalog";
import { ExportDataset, ExportFilters, ExportOptionsResponse, ExportReportId, ExportRow } from "./types";

type BaseData = {
  teams: any[];
  students: any[];
  programs: any[];
  entries: any[];
  results: any[];
  topics: any[];
};

const MAX_EXPORT_ROWS = 50_000;

const text = (value: unknown) => value == null ? "" : String(value);
const number = (value: unknown) => Number(value || 0);
const category = (value: unknown) => categoryMap[text(value)] || text(value);
const categories = (value: unknown) => text(value)
  .replace(/[\[\]"]/g, "")
  .split(/[&,]/)
  .map((item) => item.trim())
  .filter(Boolean)
  .map((item) => categoryMap[item] || item)
  .join(", ");
const ids = (value: unknown) => text(value).split(/[&,]/).map((item) => item.trim()).filter(Boolean);

async function loadBaseData(): Promise<BaseData> {
  const queries = await Promise.all([
    pool.execute("SELECT id, jamiaNo, name, strength, categories, shortName FROM campus ORDER BY name"),
    pool.execute("SELECT id, campus, name, jamiaNo, category FROM students ORDER BY category, name"),
    pool.execute("SELECT id, category, name, isStage, isGroup, `limit`, members, status, `count`, `order` FROM programs ORDER BY COALESCE(`order`, 999999), name"),
    pool.execute("SELECT id, program, student, campus, code, status, mark, mark2, mark3, topic FROM programlist ORDER BY program, id"),
    pool.execute("SELECT id, program, student, code, rank, grade, point, status FROM results ORDER BY program, rank, id"),
    pool.execute("SELECT id, program, title FROM topics ORDER BY program, id"),
  ]);
  return {
    teams: queries[0][0] as any[], students: queries[1][0] as any[],
    programs: queries[2][0] as any[], entries: queries[3][0] as any[],
    results: queries[4][0] as any[], topics: queries[5][0] as any[],
  };
}

function context(data: BaseData) {
  const teams = new Map(data.teams.map((item) => [text(item.jamiaNo), item]));
  const students = new Map(data.students.map((item) => [text(item.jamiaNo), item]));
  const programs = new Map(data.programs.map((item) => [text(item.id), item]));
  const topics = new Map(data.topics.map((item) => [text(item.id), item]));
  const resultByProgramStudent = new Map(data.results.map((item) => [`${item.program}:${item.student}`, item]));
  return { teams, students, programs, topics, resultByProgramStudent };
}

function entryRow(entry: any, maps: ReturnType<typeof context>): ExportRow {
  const program = maps.programs.get(text(entry.program)) || {};
  const team = maps.teams.get(text(entry.campus)) || {};
  const memberIds = ids(entry.student);
  return {
    entryId: number(entry.id), programId: text(entry.program), order: number(program.order),
    programName: text(program.name), category: category(program.category), categoryKey: text(program.category),
    code: text(entry.code), jamiaIds: memberIds.join(", "),
    participantNames: memberIds.map((id) => text(maps.students.get(id)?.name) || `Unknown (${id})`).join(", "),
    teamId: text(entry.campus), teamName: text(team.name) || text(entry.campus), status: text(entry.status),
    topic: text(maps.topics.get(text(entry.topic))?.title), mark1: number(entry.mark), mark2: number(entry.mark2), mark3: number(entry.mark3),
  };
}

function resultRows(data: BaseData): ExportRow[] {
  const maps = context(data);
  return data.results.map((result) => {
    const program = maps.programs.get(text(result.program)) || {};
    const student = maps.students.get(text(result.student)) || {};
    const team = maps.teams.get(text(student.campus)) || {};
    return {
      resultId: number(result.id), programId: text(result.program), order: number(program.order),
      programName: text(program.name), category: category(program.category), categoryKey: text(program.category),
      code: text(result.code), programStatus: text(program.status), rank: number(result.rank), jamiaId: text(result.student),
      studentName: text(student.name) || `Unknown (${text(result.student)})`, teamId: text(student.campus),
      teamName: text(team.name) || text(student.campus), grade: text(result.grade), points: number(result.point),
      awardStatus: text(result.status) || "pending", status: text(result.status) || "pending",
    };
  });
}

function normalizedMark(row: ExportRow) {
  const marks = [number(row.mark1), number(row.mark2), number(row.mark3)];
  const used = marks[2] > 0 ? 3 : marks[1] > 0 ? 2 : 1;
  return Number(((marks.slice(0, used).reduce((sum, mark) => sum + mark, 0) / (used * 100)) * 100).toFixed(2));
}

function rankRows(rows: ExportRow[]) {
  return rows.sort((a, b) => number(b.points) - number(a.points) || text(a.studentName || a.teamName).localeCompare(text(b.studentName || b.teamName)))
    .map((row, index) => ({ ...row, position: index + 1 }));
}

function buildRows(reportId: ExportReportId, data: BaseData, filters: ExportFilters): ExportRow[] {
  const maps = context(data);
  const entries = data.entries.map((entry) => entryRow(entry, maps));
  const results = resultRows(data);
  const resultKey = new Map(results.map((row) => [`${row.programId}:${row.jamiaId}`, row]));

  if (reportId === "teams") return data.teams.map((team) => {
    const teamId = text(team.jamiaNo);
    const teamStudents = data.students.filter((student) => text(student.campus) === teamId && (!filters.category || text(student.category) === filters.category));
    const teamEntries = entries.filter((entry) => text(entry.teamId) === teamId && (!filters.category || text(entry.categoryKey) === filters.category));
    const teamResults = results.filter((result) => text(result.teamId) === teamId && (!filters.category || text(result.categoryKey) === filters.category));
    return { teamId, teamName: text(team.name), shortName: text(team.shortName), categories: categories(team.categories), categoryKey: filters.category || "", strength: number(team.strength), studentCount: teamStudents.length, entryCount: teamEntries.length, points: teamResults.reduce((sum, result) => sum + number(result.points), 0) };
  }).filter((row) => !filters.category || number(row.studentCount) > 0 || number(row.entryCount) > 0);

  if (reportId === "students") return data.students.map((student) => {
    const jamiaId = text(student.jamiaNo); const team = maps.teams.get(text(student.campus));
    return { jamiaId, studentName: text(student.name), teamId: text(student.campus), teamName: text(team?.name) || text(student.campus), category: category(student.category), categoryKey: text(student.category), groupId: text(student.groupId), entryCount: data.entries.filter((entry) => ids(entry.student).includes(jamiaId)).length, points: results.filter((r) => text(r.jamiaId) === jamiaId).reduce((sum, r) => sum + number(r.points), 0) };
  });

  if (reportId === "programs") return data.programs.map((program) => {
    const programEntries = data.entries.filter((entry) => text(entry.program) === text(program.id));
    return { programId: number(program.id), order: number(program.order), programName: text(program.name), category: category(program.category), categoryKey: text(program.category), stageType: number(program.isStage) ? "On stage" : "Off stage", programType: number(program.isGroup) ? "Group" : "Individual", members: number(program.members), limit: number(program.limit), status: text(program.status), entryCount: programEntries.length, finishedCount: programEntries.filter((entry) => text(entry.status) === "finished").length, resultCount: data.results.filter((r) => text(r.program) === text(program.id)).length };
  });

  if (reportId === "participants") return entries;
  if (reportId === "team_entries") return entries.sort((left, right) => text(left.teamName).localeCompare(text(right.teamName)) || text(left.category).localeCompare(text(right.category)) || number(left.order) - number(right.order));
  if (reportId === "call_list") return entries.map((row, index) => ({ ...row, serial: index + 1, signature: "" }));
  if (reportId === "judgement_sheet") return entries.filter((row) => ["reported", "finished"].includes(text(row.status))).map((row, index) => ({ ...row, serial: index + 1, judge1: "", judge2: "", judge3: "", total: "", rank: "", remarks: "" }));
  if (reportId === "program_results") return results;
  if (reportId === "awards") return results.filter((row) => number(row.rank) >= 1 && number(row.rank) <= 2).map((row) => ({ ...row, signature: "" }));
  if (reportId === "attendance_exceptions") return entries.filter((row) => ["not reported", "cancelled"].includes(text(row.status))).map((row) => ({ ...row, remarks: "" }));

  if (reportId === "student_standings") return rankRows(data.students.map((student) => {
    const studentResults = results.filter((row) => text(row.jamiaId) === text(student.jamiaNo));
    const team = maps.teams.get(text(student.campus));
    return { jamiaId: text(student.jamiaNo), studentName: text(student.name), teamId: text(student.campus), teamName: text(team?.name) || text(student.campus), category: category(student.category), categoryKey: text(student.category), resultCount: studentResults.length, points: studentResults.reduce((sum, row) => sum + number(row.points), 0) };
  }).filter((row) => number(row.points) > 0));

  if (reportId === "team_standings") return rankRows(data.teams.map((team) => {
    const teamResults = results.filter((row) => text(row.teamId) === text(team.jamiaNo) && (!filters.category || text(row.categoryKey) === filters.category));
    return { teamId: text(team.jamiaNo), teamName: text(team.name), categoryKey: filters.category || "", resultCount: teamResults.length, points: teamResults.reduce((sum, row) => sum + number(row.points), 0) };
  }).filter((row) => number(row.points) > 0));

  if (reportId === "award_progress") return data.programs.map((program) => {
    const programResults = results.filter((row) => text(row.programId) === text(program.id));
    const awardedCount = programResults.filter((row) => text(row.awardStatus) === "awarded").length;
    const completion = programResults.length ? Math.round((awardedCount / programResults.length) * 100) : 0;
    return { programId: text(program.id), order: number(program.order), programName: text(program.name), category: category(program.category), categoryKey: text(program.category), resultCount: programResults.length, awardedCount, pendingCount: programResults.length - awardedCount, completion: `${completion}%`, status: completion === 100 ? "complete" : awardedCount ? "partial" : "pending" };
  });

  if (reportId === "judging_audit") return entries.map((row) => {
    const primaryId = text(row.jamiaIds).split(",")[0].trim(); const result = resultKey.get(`${row.programId}:${primaryId}`);
    return { ...row, normalizedMark: normalizedMark(row), rank: result?.rank ?? 0, grade: result?.grade ?? "", points: result?.points ?? 0, awardStatus: result?.awardStatus ?? "not saved" };
  });

  if (reportId === "registration_summary") {
    const groups = new Map<string, any>();
    for (const row of entries) {
      const key = `${row.teamId}:${row.categoryKey}:${row.programId}`;
      const current = groups.get(key) || { teamId: row.teamId, teamName: row.teamName, category: row.category, categoryKey: row.categoryKey, programId: row.programId, programName: row.programName, entryCount: 0, studentCount: 0, reportedCount: 0, finishedCount: 0, cancelledCount: 0, memberSet: new Set<string>() };
      current.entryCount = number(current.entryCount) + 1;
      ids(row.jamiaIds).forEach((id) => current.memberSet.add(id));
      if (row.status === "reported") current.reportedCount = number(current.reportedCount) + 1;
      if (row.status === "finished") current.finishedCount = number(current.finishedCount) + 1;
      if (row.status === "cancelled") current.cancelledCount = number(current.cancelledCount) + 1;
      groups.set(key, current);
    }
    return [...groups.values()].map(({ memberSet, ...row }) => ({ ...row, studentCount: memberSet.size }));
  }

  if (reportId === "data_quality") {
    const issues: ExportRow[] = [];
    const duplicateKeys = new Map<string, number>();
    for (const row of entries) {
      for (const jamiaId of ids(row.jamiaIds)) {
        if (!maps.students.has(jamiaId)) issues.push({ severity: "high", issueType: "Unknown participant ID", programId: row.programId, programName: row.programName, category: row.category, categoryKey: row.categoryKey, jamiaIds: jamiaId, teamId: row.teamId, teamName: row.teamName, status: row.status, details: "The program entry does not match a registered student." });
        const key = `${row.programId}:${jamiaId}`; duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1);
      }
      if (!maps.teams.has(text(row.teamId))) issues.push({ severity: "high", issueType: "Unknown team", programId: row.programId, programName: row.programName, category: row.category, categoryKey: row.categoryKey, jamiaIds: row.jamiaIds, teamId: row.teamId, teamName: row.teamName, status: row.status, details: "The entry references a team that does not exist." });
      const expectedMembers = number(maps.programs.get(text(row.programId))?.members) || 1;
      const actualMembers = ids(row.jamiaIds).length;
      if (actualMembers !== expectedMembers) issues.push({ severity: "medium", issueType: "Irregular member count", programId: row.programId, programName: row.programName, category: row.category, categoryKey: row.categoryKey, jamiaIds: row.jamiaIds, teamId: row.teamId, teamName: row.teamName, status: row.status, details: `Entry contains ${actualMembers} member(s); the program requires ${expectedMembers}.` });
      const primaryId = ids(row.jamiaIds)[0];
      if (row.status === "finished" && primaryId && !resultKey.has(`${row.programId}:${primaryId}`)) issues.push({ severity: "medium", issueType: "Finished without result", programId: row.programId, programName: row.programName, category: row.category, categoryKey: row.categoryKey, jamiaIds: row.jamiaIds, teamId: row.teamId, teamName: row.teamName, status: row.status, details: "The finished entry has no stored result record." });
    }
    for (const [key, count] of duplicateKeys) if (count > 1) {
      const [programId, jamiaId] = key.split(":"); const program = maps.programs.get(programId) || {}; const student = maps.students.get(jamiaId) || {}; const team = maps.teams.get(text(student.campus)) || {};
      issues.push({ severity: "medium", issueType: "Duplicate program entry", programId, programName: text(program.name), category: category(program.category), categoryKey: text(program.category), jamiaIds: jamiaId, teamId: text(student.campus), teamName: text(team.name), status: "duplicate", details: `${count} entries exist for this participant and program.` });
    }
    for (const result of results) {
      if (!maps.programs.has(text(result.programId)) || !maps.students.has(text(result.jamiaId))) issues.push({ severity: "high", issueType: "Incomplete result record", programId: result.programId, programName: result.programName, category: result.category, categoryKey: result.categoryKey, jamiaIds: result.jamiaId, teamId: result.teamId, teamName: result.teamName, status: result.awardStatus, details: "The result references a missing program or student." });
    }
    return issues;
  }
  return [];
}

function applyFilters(rows: ExportRow[], filters: ExportFilters) {
  const search = text(filters.search).trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.team && text(row.teamId) !== filters.team) return false;
    if (filters.category && text(row.categoryKey) !== filters.category) return false;
    if (filters.program && text(row.programId) !== filters.program) return false;
    if (filters.status && ![text(row.status), text(row.awardStatus), text(row.programStatus), text(row.severity)].includes(filters.status)) return false;
    if (filters.resultStatus && filters.resultStatus !== "all" && text(row.programStatus) !== filters.resultStatus) return false;
    return !search || Object.values(row).some((value) => text(value).toLowerCase().includes(search));
  });
}

export async function getExportDataset(reportId: ExportReportId, filters: ExportFilters, generatedBy: string): Promise<ExportDataset> {
  const definition = exportReportMap.get(reportId);
  if (!definition) throw new ApiError("Unknown export report", 404);
  const data = await loadBaseData();
  const rows = applyFilters(buildRows(reportId, data, filters), filters);
  if (rows.length > MAX_EXPORT_ROWS) throw new ApiError("This report exceeds 50,000 rows. Narrow the filters and try again.", 413);
  const selectedProgram = filters.program ? data.programs.find((program) => text(program.id) === filters.program) : undefined;
  const displayFilters = { ...filters, category: filters.category ? categoryMap[filters.category] || filters.category : undefined, program: selectedProgram ? text(selectedProgram.name) : filters.program };
  const title = definition.name;
  return { success: true, metadata: { reportId, reportName: definition.name, title, generatedAt: new Date().toISOString(), generatedBy, filters: displayFilters }, columns: definition.columns, rows, total: rows.length };
}

export async function getExportOptions(): Promise<ExportOptionsResponse> {
  const [teamResult, programResult, categoryResult, participantStatusResult, programStatusResult] = await Promise.all([
    pool.execute("SELECT jamiaNo AS value, name AS label FROM campus ORDER BY name"),
    pool.execute("SELECT CAST(id AS CHAR) AS value, name AS label, category FROM programs ORDER BY name"),
    pool.execute("SELECT DISTINCT category AS value FROM programs WHERE category IS NOT NULL AND category <> '' ORDER BY category"),
    pool.execute("SELECT DISTINCT status AS value FROM programlist WHERE status IS NOT NULL AND status <> '' ORDER BY status"),
    pool.execute("SELECT DISTINCT status AS value FROM programs WHERE status IS NOT NULL AND status <> '' ORDER BY status"),
  ]);
  const options = (rows: any[]) => rows.map((row) => ({ value: text(row.value), label: text(row.label || row.value) }));
  const programs = (programResult[0] as any[]).map((row) => ({ value: text(row.value), label: text(row.label), category: text(row.category) }));
  return { success: true, teams: options(teamResult[0] as any[]), programs, categories: (categoryResult[0] as any[]).map((row) => ({ value: text(row.value), label: category(row.value) })), participantStatuses: options(participantStatusResult[0] as any[]), programStatuses: options(programStatusResult[0] as any[]) };
}
