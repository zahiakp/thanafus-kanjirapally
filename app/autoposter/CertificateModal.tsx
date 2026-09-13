"use client";

import { useMemo, useState } from "react";
import { FaAward, FaDownload, FaFilePdf, FaPrint } from "react-icons/fa";
import { jsPDF } from "jspdf";
import Modal from "../../components/common/Modal";
import { categoryMap } from "../data/branding";
import { showMessage } from "../../components/common/CusToast";

type CertificateResult = {
  id?: string | number;
  student?: string;
  campus?: string;
  rank?: string | number;
  grade?: string;
  code?: string;
};

type CertificateProgram = {
  name?: string;
  category?: string;
  order?: string | number;
};

type CertificateAction = "png" | "pdf" | "print";

const certificateForRank = {
  1: {
    background: "/certificate/A5.jpg.jpeg",
    place: "First",
    pdfFormat: "a5" as const,
    paperName: "A5",
    widthMm: 148,
    heightMm: 210,
  },
  2: {
    background: "/certificate/A6.jpg.jpeg",
    place: "Second",
    pdfFormat: "a6" as const,
    paperName: "A6",
    widthMm: 105,
    heightMm: 148,
  },
} as const;

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the certificate template"));
    image.src = source;
  });
}

function wrapText(context: CanvasRenderingContext2D, text: string, maximumWidth: number) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (line && context.measureText(candidate).width > maximumWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function safeFilePart(value: string) {
  return value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "participant";
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Could not create the certificate file")),
      type,
      quality,
    );
  });
}

async function renderCertificate(program: CertificateProgram, winner: CertificateResult) {
  const rank = Number(winner.rank) as 1 | 2;
  const template = certificateForRank[rank];
  if (!template) throw new Error("Only first- and second-place certificates are supported");

  const background = await loadImage(template.background);
  const canvas = document.createElement("canvas");
  canvas.width = background.naturalWidth;
  canvas.height = background.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Certificate canvas is unavailable");

  await document.fonts.ready;
  const fontFamily = window.getComputedStyle(document.body).fontFamily || "Arial, Helvetica, sans-serif";

  context.drawImage(background, 0, 0, canvas.width, canvas.height);
  context.textAlign = "left";
  context.textBaseline = "top";

  const name = String(winner.student || "Participant").trim().toUpperCase();
  const team = String(winner.campus || "Team").trim().toUpperCase();
  const grade = String(winner.grade || "N/A").trim().toUpperCase();
  const rawCategory = categoryMap[String(program.category || "")] || String(program.category || "");
  const category = rawCategory.replace(/\s+(BOYS|GIRLS)$/i, "").trim().toUpperCase();
  const programName = String(program.name || "Competition").trim().toUpperCase();

  const introduction = "This is to proudly acknowledge and honor";
  const details =
    "of " + team + ", for securing " + template.place +
    " Place with " + grade + " Grade in the " + category + " " +
    programName + " competition held in connection with Meelad Maharjan " +
    "from the 25th to 26th of August, 2026.";

  const left = canvas.width * 0.145;
  const maximumWidth = canvas.width * 0.57;
  const startY = canvas.height * 0.418;
  const maximumBottom = canvas.height * 0.705;
  let fontSize = canvas.width * 0.034;
  const minimumFontSize = canvas.width * 0.024;

  type TextLine = { text: string; bold: boolean; color: string };
  let lines: TextLine[] = [];
  let lineHeight = fontSize * 1.17;

  while (fontSize >= minimumFontSize) {
    context.font = "400 " + fontSize + "px " + fontFamily;
    const introductionLines = wrapText(context, introduction, maximumWidth);

    context.font = "700 " + fontSize + "px " + fontFamily;
    const nameLines = wrapText(context, name, maximumWidth);

    context.font = "400 " + fontSize + "px " + fontFamily;
    const detailLines = wrapText(context, details, maximumWidth);

    lines = [
      ...introductionLines.map((text) => ({ text, bold: false, color: "#101010" })),
      ...nameLines.map((text) => ({ text, bold: true, color: "#8a00e6" })),
      ...detailLines.map((text) => ({ text, bold: false, color: "#101010" })),
    ];

    lineHeight = fontSize * 1.17;
    if (startY + lines.length * lineHeight <= maximumBottom) break;
    fontSize -= canvas.width * 0.001;
  }

  lines.forEach((line, index) => {
    context.font = (line.bold ? "700 " : "400 ") + fontSize + "px " + fontFamily;
    context.fillStyle = line.color;
    context.fillText(line.text, left, startY + index * lineHeight);
  });

  return { canvas, template, name };
}

function CertificateModal({ data, close }: { data: { program: CertificateProgram; result: CertificateResult[] }; close: () => void }) {
  const [generating, setGenerating] = useState<string | null>(null);
  const program = data.program || {};
  const winners = useMemo(
    () => data.result.filter((item) => [1, 2].includes(Number(item.rank))).sort((a, b) => Number(a.rank) - Number(b.rank)),
    [data.result],
  );

  const handleCertificateAction = async (action: CertificateAction, winner: CertificateResult, index: number) => {
    const rank = Number(winner.rank) as 1 | 2;
    const template = certificateForRank[rank];
    if (!template) return;

    const winnerKey = String(winner.id ?? winner.code ?? (rank + "-" + index));
    const actionKey = action + "-" + winnerKey;
    const printWindow = action === "print" ? window.open("", "_blank", "width=900,height=1100") : null;

    if (action === "print" && !printWindow) {
      showMessage("Allow pop-ups to print the certificate", "error");
      return;
    }

    setGenerating(actionKey);

    try {
      const rendered = await renderCertificate(program, winner);
      const baseName = (rank === 1 ? "First" : "Second") + "-Place-Certificate-" + safeFilePart(rendered.name);

      if (action === "png") {
        downloadBlob(await canvasBlob(rendered.canvas, "image/png"), baseName + ".png");
        showMessage("Certificate image generated for " + rendered.name, "success");
      }

      if (action === "pdf") {
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: rendered.template.pdfFormat,
          compress: true,
        });
        pdf.addImage(
          rendered.canvas.toDataURL("image/jpeg", 0.96),
          "JPEG",
          0,
          0,
          pdf.internal.pageSize.getWidth(),
          pdf.internal.pageSize.getHeight(),
          undefined,
          "FAST",
        );
        pdf.save(baseName + ".pdf");
        showMessage(rendered.template.paperName + " PDF generated for " + rendered.name, "success");
      }

      if (action === "print" && printWindow) {
        const imageUrl = rendered.canvas.toDataURL("image/png");
        printWindow.document.open();
        printWindow.document.write(
          "<!doctype html><html><head><title>" + baseName + "</title>" +
          "<style>@page{size:" + rendered.template.paperName + " portrait;margin:0}" +
          "html,body{margin:0;padding:0;width:" + rendered.template.widthMm + "mm;height:" + rendered.template.heightMm + "mm;background:#fff}" +
          "body{-webkit-print-color-adjust:exact;print-color-adjust:exact;overflow:hidden}" +
          "img{display:block;width:" + rendered.template.widthMm + "mm;height:" + rendered.template.heightMm + "mm;object-fit:fill}</style>" +
          "</head><body><img id=\"certificate\" src=\"" + imageUrl + "\" alt=\"Certificate\"></body></html>",
        );
        printWindow.document.close();

        const printImage = printWindow.document.getElementById("certificate") as HTMLImageElement | null;
        const startPrint = () => {
          printWindow.focus();
          printWindow.print();
        };
        printWindow.onafterprint = () => printWindow.close();
        if (printImage?.complete) window.setTimeout(startPrint, 100);
        else if (printImage) printImage.onload = startPrint;
        else startPrint();
      }
    } catch (error: any) {
      printWindow?.close();
      console.error("Certificate generation failed:", error);
      showMessage(error?.message || "Could not generate the certificate", "error");
    } finally {
      setGenerating(null);
    }
  };

  return (
    <Modal close={close}>
      <div className="w-full md:w-[760px]">
        <div className="-m-10 mb-7 bg-gradient-to-r from-amber-50 to-orange-100 p-10 pr-20">
          <div className="flex items-center gap-3 text-amber-700">
            <FaAward className="text-3xl" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em]">Certificates</p>
              <h2 className="mt-1 text-2xl font-bold text-gray-900">{program.name || "Program"}</h2>
              <p className="mt-1 text-sm text-gray-600">{categoryMap[String(program.category || "")] || program.category}</p>
            </div>
          </div>
        </div>

        <p className="mb-4 text-sm text-gray-500">
          First place is generated at A5 size and second place at A6 size. Choose an image, PDF, or direct print.
        </p>

        <div className="space-y-3">
          {winners.map((winner, index) => {
            const rank = Number(winner.rank) as 1 | 2;
            const winnerKey = String(winner.id ?? winner.code ?? (rank + "-" + index));
            const activeAction = generating?.endsWith("-" + winnerKey) ? generating.split("-")[0] : null;

            return (
              <div key={winnerKey} className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white " + (rank === 1 ? "bg-amber-500" : "bg-slate-500")}>{rank}</div>
                  <div className="min-w-0">
                    <p className="truncate font-bold uppercase text-gray-900">{winner.student || "Participant"}</p>
                    <p className="truncate text-sm text-gray-500">
                      {winner.campus || "Team"} · {winner.grade || "N/A"} Grade · {rank === 1 ? "A5" : "A6"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    disabled={generating !== null}
                    onClick={() => handleCertificateAction("png", winner, index)}
                    className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                  >
                    <FaDownload /> {activeAction === "png" ? "Generating..." : "Image"}
                  </button>
                  <button
                    type="button"
                    disabled={generating !== null}
                    onClick={() => handleCertificateAction("pdf", winner, index)}
                    className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                  >
                    <FaFilePdf /> {activeAction === "pdf" ? "Generating..." : "PDF"}
                  </button>
                  <button
                    type="button"
                    disabled={generating !== null}
                    onClick={() => handleCertificateAction("print", winner, index)}
                    className="flex items-center justify-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
                  >
                    <FaPrint /> {activeAction === "print" ? "Preparing..." : "Print"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

export default CertificateModal;
