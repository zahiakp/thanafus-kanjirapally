import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { categoryMap, DocHeader, DocHeaderSec, rgb } from "../data/branding";
import { loadPdfImage } from "../utils/pdf";

function value(input: unknown) {
  return input === null || input === undefined ? "" : String(input);
}

function imageFormat(image: string) {
  return image.startsWith("data:image/png") ? "PNG" : "JPEG";
}

export const generatePDF = async (result: any[] = [], program: any): Promise<Blob> => {
  const doc = new jsPDF();
  const headerGap = 60;
  const footerGap = 20;
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const [firstBackground, continuationBackground] = await Promise.all([
    loadPdfImage(DocHeader),
    loadPdfImage(DocHeaderSec || DocHeader),
  ]);

  const addBackground = (pageNumber: number) => {
    const image = pageNumber === 1 ? firstBackground : continuationBackground || firstBackground;
    if (image) {
      doc.addImage(image, imageFormat(image), 0, 0, pageWidth, pageHeight, undefined, "FAST");
    }
  };

  addBackground(1);
  const title = value(program?.name).toUpperCase();
  const category = value(categoryMap[program?.category] || program?.category).toUpperCase();
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, headerGap + 15, { align: "center" });
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(category, pageWidth / 2, headerGap + 22, { align: "center" });

  const rows = [...result]
    .sort((a: any, b: any) => (Number(a?.rank) > 0 ? Number(a.rank) : Number.MAX_SAFE_INTEGER) - (Number(b?.rank) > 0 ? Number(b.rank) : Number.MAX_SAFE_INTEGER))
    .map((entry: any) => [
      Number(entry?.rank) > 0 ? value(entry.rank) : "",
      value(entry?.code),
      value(entry?.student).toUpperCase(),
      value(entry?.campus).toUpperCase(),
      value(entry?.grade),
      value(entry?.point),
    ]);

  autoTable(doc, {
    head: [["Rank", "Code", "Name", "Team", "Grade", "Point"]],
    body: rows,
    startY: headerGap + 28,
    margin: { top: 20, bottom: footerGap },
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: rgb },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { fontStyle: "bold" } },
    willDrawPage: (data: any) => {
      if (data.pageNumber > 1) addBackground(data.pageNumber);
    },
    didDrawPage: (data: any) => {
      doc.setFontSize(8);
      doc.setTextColor(90);
      doc.text(`Page ${data.pageNumber}`, pageWidth - 12, pageHeight - 8, { align: "right" });
      doc.setTextColor(0);
    },
  });

  return doc.output("blob");
};
