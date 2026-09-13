"use client";

import React from "react";
import { MdAccessTimeFilled } from "react-icons/md";
import { RiDownloadLine } from "react-icons/ri";
import Modal from "../../../components/common/Modal";
import { categoryMap } from "../../data/branding";
import { generatePoster } from "./PosterGen";

export default function ResultCard({ close, data }: { close: any; data: any }) {
  const { program, result } = data;
  const [downloading, setDownloading] = React.useState(false);

  return (
    <Modal
      close={close}
      contentClassName="!w-[calc(100%-1rem)] !min-w-0 !max-w-[760px] !max-h-[calc(100dvh-1rem)] !overflow-hidden !p-0 md:!w-[760px]"
    >
      <div className="flex max-h-[calc(100dvh-1rem)] w-full min-w-0 flex-col overflow-hidden rounded-xl bg-white sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2 bg-gradient-to-r from-primary-100 to-primary-50 p-3 pr-14 sm:items-end sm:gap-4 sm:p-6 sm:pr-16">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-primary-700 sm:text-xs sm:tracking-wider">
              {categoryMap[program.category] || program.category}
            </p>
            <h2 className="mt-0.5 break-words text-base font-black uppercase leading-tight text-gray-900 sm:mt-1 sm:text-3xl">
              {program.name}
            </h2>
          </div>
          {program.order && (
            <div className="shrink-0 text-right">
              <p className="text-[9px] uppercase text-gray-500 sm:text-xs">Result</p>
              <p className="text-2xl font-black leading-none text-primary-700 sm:text-6xl">#{program.order}</p>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-6">
          <div className="divide-y divide-gray-100 md:hidden">
            {result.map((item: any, index: number) => {
              const ranked = ["1", "2"].includes(String(item.rank));
              return (
                <div
                  key={(item.code || "result") + "-mobile-" + index}
                  className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 px-1 py-3"
                >
                  <div
                    className={
                      "flex h-9 w-9 items-center justify-center rounded-full text-sm font-black " +
                      (String(item.rank) === "1"
                        ? "bg-amber-100 text-amber-700"
                        : String(item.rank) === "2"
                          ? "bg-slate-200 text-slate-700"
                          : String(item.rank) === "3"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-gray-500")
                    }
                  >
                    {ranked ? item.rank : "—"}
                  </div>

                  <div className="min-w-0">
                    <p className="break-words text-xs font-bold uppercase leading-snug text-gray-900">
                      {item.student || "—"}
                    </p>
                    <p className="mt-0.5 break-words text-[10px] leading-snug text-gray-500">
                      {item.campus || "—"}
                    </p>
                  </div>

                  <span
                    className={
                      "rounded-full px-2 py-1 text-[10px] font-bold " +
                      (item.grade === "N/A"
                        ? "bg-gray-100 text-gray-500"
                        : "bg-primary-50 text-primary-700")
                    }
                  >
                    {item.grade === "N/A" ? "No grade" : item.grade || "—"}
                  </span>
                </div>
              );
            })}
          </div>

          <table className="hidden w-full table-fixed text-left text-sm md:table">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[13%]" />
              <col className="w-[31%]" />
              <col className="w-[30%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-3">Place</th>
                <th className="px-3 py-3">Code</th>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Team</th>
                <th className="px-3 py-3">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {result.map((item: any, index: number) => (
                <tr key={(item.code || "result") + "-desktop-" + index}>
                  <td className="px-3 py-3 align-top font-bold">
                    {["1", "2"].includes(String(item.rank)) ? item.rank : "—"}
                  </td>
                  <td className="px-3 py-3 align-top">{item.code || "—"}</td>
                  <td className="break-words px-3 py-3 align-top font-bold uppercase">{item.student || "—"}</td>
                  <td className="break-words px-3 py-3 align-top">{item.campus || "—"}</td>
                  <td className="break-words px-3 py-3 align-top font-bold">
                    {item.grade === "N/A" ? "No grade" : item.grade || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="shrink-0 border-t p-2 sm:p-4">
          <button
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try {
                await generatePoster({ result, category: program.category, program: program.name, order: program.order });
              } finally {
                setDownloading(false);
              }
            }}
            className="flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 sm:mx-auto sm:min-h-11 sm:w-auto sm:rounded-xl sm:px-5 sm:py-3 sm:text-base"
          >
            {downloading ? (
              <>
                <MdAccessTimeFilled /> Downloading…
              </>
            ) : (
              <>
                <RiDownloadLine /> Poster
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
