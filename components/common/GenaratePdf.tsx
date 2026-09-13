import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { categoryMap, DocHeader, DocHeaderSec, rgb } from "../../app/data/branding";
import { loadPdfImage } from "../../app/utils/pdf";

function value(input: unknown) {
  return input === null || input === undefined ? "" : String(input);
}

function imageFormat(image: string) {
  return image.startsWith("data:image/png") ? "PNG" : "JPEG";
}

export const generatePDF = async (
  participants: any[] = [],
  group: any,
  programName: string,
  category: string,
): Promise<Blob> => {
  const doc = new jsPDF();
  const headerGap = 60;
  const footerGap = 20;
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const [firstBackground, continuationBackground] = await Promise.all([
    loadPdfImage(DocHeader || "/20250926_100022.png"),
    loadPdfImage(DocHeaderSec || "/20250926_100022-2.png"),
  ]);

  const addBackground = (pageNumber: number) => {
    const image = pageNumber === 1 ? firstBackground : continuationBackground || firstBackground;
    if (image) {
      doc.addImage(image, imageFormat(image), 0, 0, pageWidth, pageHeight, undefined, "FAST");
    }
  };

  addBackground(1);
  const title = value(programName).toUpperCase();
  const categoryLabel = value(categoryMap[category] || category).toUpperCase();
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth / 2, headerGap + 14, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(categoryLabel, pageWidth / 2, headerGap + 20, { align: "center" });

  const rows = Number(group) > 0
    ? participants.map((participant: any, index: number) => [
        index + 1,
        (participant?.students || []).map((student: any) => value(student?.name)).filter(Boolean).join(", "),
        (participant?.students || []).map((student: any) => value(student?.jamiaNo)).filter(Boolean).join(", "),
        value(participant?.campusName),
        value(participant?.code),
        "",
      ])
    : participants.map((participant: any, index: number) => [
        index + 1,
        value(participant?.studentName).toUpperCase(),
        value(participant?.jamiaNo),
        value(participant?.campusName),
        value(participant?.code),
        "",
      ]);

  autoTable(doc, {
    head: [["No", "Name", "Chest No", "Team", "Code", "Sign"]],
    body: rows,
    startY: headerGap + 25,
    margin: { top: 20, bottom: footerGap },
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: rgb },
    columnStyles: { 1: { fontStyle: "bold" }, 4: { fontStyle: "bold" } },
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
