"use client";

import { toPng } from "html-to-image";
import React from "react";
import { createRoot } from "react-dom/client";
import { categoryMap } from "../../data/branding";
import { resultPosterTemplates } from "../../data/resultPosterTemplates";
import { showMessage } from "../../../components/common/CusToast";

function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function safeFilePart(value: string) {
  return value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "result";
}

export const generatePoster = async ({
  result,
  category = "Senior",
  program = "Essay Writing",
  order,
}: {
  result: any[];
  category: string;
  program: string;
  order?: string | number;
}) => {
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "fixed",
    top: "0",
    left: "-10000px",
    width: "450px",
    height: "560.86px",
    pointerEvents: "none",
    zIndex: "-1",
  });
  document.body.appendChild(container);

  const root = createRoot(container);
  const temp = resultPosterTemplates;
  const template = temp[0];
  const image = template.data[0];
  const orderLabel = String(order || "").padStart(2, "0");
  const winners = Array.isArray(result)
    ? result.filter((item: any) => Number(item.rank) > 0 && Number(item.rank) < 4)
    : [];

  try {
    root.render(
      <div id="participant-result-poster" className="relative h-[560.86px] w-[450px] overflow-hidden">
        <img
          id="participant-result-poster-bg"
          src={image.image}
          alt=""
          crossOrigin="anonymous"
          className="absolute inset-0 h-full w-full object-fill"
        />

        <div className="absolute left-[50px] top-[105px]">
          <div className="mt-7 grid h-[72px] w-[160px] content-end text-[10px] font-light leading-6 text-white montserrat">
            <span>{categoryMap[String(category)] || category}</span>
            <span className="text-2xl font-bold">{program}</span>
          </div>
        </div>

        {orderLabel && (
          <p className="absolute left-[275px] top-[128px] w-16 text-center text-6xl text-sky-300 montserrat">
            {orderLabel}
          </p>
        )}

        <div className="absolute left-[45px] top-[255px] flex flex-col">
          {winners.map((winner: any, index: number) => (
            <div
              key={(winner.code || winner.student || "winner") + "-" + index}
              className="flex h-[48px] w-[360px] items-center gap-2"
            >
              <p className="text-2xl tracking-tighter text-white/50 nexa-regular">
                {String(winner.rank).padStart(2, "0")}
              </p>
              <div className="w-[300px] translate-y-[1px] text-white nexa-regular">
                <p className="break-words text-[15px] font-semibold uppercase leading-[16px]">
                  {String(winner.student || "Participant")}
                </p>
                <p className="text-[9px] leading-[13px] text-white/50 nexa-light">
                  {String(winner.campus || "Team")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>,
    );

    await waitForPaint();

    const poster = container.querySelector("#participant-result-poster") as HTMLElement | null;
    const background = container.querySelector("#participant-result-poster-bg") as HTMLImageElement | null;
    if (!poster || !background) throw new Error("Poster content could not be prepared");

    if (!background.complete || background.naturalWidth === 0) {
      await new Promise<void>((resolve, reject) => {
        background.onload = () => resolve();
        background.onerror = () => reject(new Error("Poster template failed to load"));
      });
    }

    await background.decode().catch(() => undefined);
    await document.fonts.ready;
    await waitForPaint();

    const dataUrl = await toPng(poster, {
      pixelRatio: 4,
      cacheBust: false,
      width: 450,
      height: 560.86,
    });

    const link = document.createElement("a");
    link.download = safeFilePart(category + "-" + program) + ".png";
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showMessage("Result poster downloaded", "success");
  } catch (error: any) {
    console.error("Poster generation failed:", error);
    showMessage(error?.message || "Could not download the result poster", "error");
  } finally {
    root.unmount();
    container.remove();
  }
};
