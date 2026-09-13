export type ExportFormat = "pdf" | "xlsx" | "csv" | "docx" | "txt" | "xml" | "json";

export type ExportReportId =
  | "teams"
  | "students"
  | "programs"
  | "participants"
  | "call_list"
  | "judgement_sheet"
  | "program_results"
  | "awards"
  | "team_entries"
  | "attendance_exceptions"
  | "student_standings"
  | "team_standings"
  | "award_progress"
  | "judging_audit"
  | "registration_summary"
  | "data_quality";

export type ExportValue = string | number | boolean | null;
export type ExportRow = Record<string, ExportValue>;

export type ExportColumn = {
  key: string;
  label: string;
  valueType: "text" | "number" | "status" | "blank";
  defaultVisible: boolean;
  defaultOrder: number;
};

export type ExportFilters = {
  search?: string;
  team?: string;
  category?: string;
  program?: string;
  status?: string;
  resultStatus?: "judged" | "announced" | "all";
};

export type ExportMetadata = {
  reportId: ExportReportId;
  reportName: string;
  title: string;
  generatedAt: string;
  generatedBy: string;
  filters: ExportFilters;
};

export type ExportDataset = {
  success: true;
  metadata: ExportMetadata;
  columns: ExportColumn[];
  rows: ExportRow[];
  total: number;
};

export type ExportOption = { value: string; label: string; category?: string };

export type ExportTextAlign = "left" | "center" | "right";

export type ExportTitleLine = {
  id: string;
  sourceColumnKey?: string;
  text: string;
  color: string;
  fontSize: number;
  align: ExportTextAlign;
};

export type ExportTableStyle = {
  fontSize: number;
  rowHeight: number;
  headerBackground: string;
  headerText: string;
  bodyBackground: string;
  bodyText: string;
};

export type ExportColumnStyle = Partial<Pick<ExportTableStyle,
  "headerBackground" | "headerText" | "bodyBackground" | "bodyText"
>>;

export type ExportRenderOptions = {
  pdfOrientation: "auto" | "portrait" | "landscape";
  includeBrandHeader: boolean;
  titleLines: ExportTitleLine[];
  tableStyle: ExportTableStyle;
  columnStyles: Record<string, ExportColumnStyle>;
};

export type ExportOptionsResponse = {
  success: true;
  teams: ExportOption[];
  programs: ExportOption[];
  categories: ExportOption[];
  participantStatuses: ExportOption[];
  programStatuses: ExportOption[];
};
