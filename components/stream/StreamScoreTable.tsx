"use client";
import { Fragment } from "react";
import type { ScoreTablePage } from "../../app/stream/scoreTable";
const colors = { first: "bg-red-600", second: "bg-blue-800", grade: "bg-black" };
export default function StreamScoreTable({ payload }: { payload: ScoreTablePage & { eventTitle: string } }) {
  return <section className="flex h-full flex-col bg-white p-[2%] text-gray-900">
    <header className="mb-[1%] flex items-center justify-between">
      <div><p className="text-[clamp(10px,1vw,18px)] font-semibold text-primary-700">{payload.eventTitle}</p>
        <h1 className="text-[clamp(18px,2vw,34px)] font-bold">Team Score Board</h1></div>
      <p className="text-[clamp(10px,1vw,18px)] text-gray-500">All categories · Published programs · {payload.page}/{payload.pages}</p>
    </header>
    <div className="min-h-0 flex-1">
      <table className="h-full w-full table-fixed border-collapse text-[clamp(10px,1.15vw,22px)]">
        <colgroup><col style={{ width: "23%" }} />{payload.programs.map(program => <col key={program.id} />)}<col style={{ width: "11%" }} /></colgroup>
        <thead><tr className="h-[16%]">
          <th className="border border-gray-200 bg-primary-50 p-[1%] text-left text-primary-800">Team</th>
          {payload.programs.map(program => <th key={program.id} className="break-words border border-gray-200 bg-gray-50 p-[1%] text-center text-gray-700">
            {program.name}<span className="mt-1 block text-[.75em] font-normal text-gray-500">{program.category}</span>
          </th>)}
          <th className="border border-gray-200 bg-primary-50 p-[1%] text-primary-800">Overall Total</th>
        </tr></thead>
        <tbody>{payload.teams.map(team => <tr key={team.id}>
          <th className="break-words border border-gray-200 p-[1%] text-left font-medium">{team.name}<span className="mt-1 block text-[.75em] font-normal text-gray-500">{team.id}</span></th>
          {payload.programs.map(program => <td key={program.id} className="border border-gray-200 p-[.5%] text-center">
            <div className="flex flex-wrap items-center justify-center gap-1">
              {(team.scores[program.id] || []).map((award, index) => <Fragment key={award.id}>
                {index > 0 && <span className="text-gray-500">+</span>}
                <span aria-label={award.kind + ": " + award.point} className={"inline-flex min-w-[1.8em] justify-center rounded-md px-[.4em] py-[.2em] font-bold tabular-nums text-white " + colors[award.kind]}>{award.point}</span>
              </Fragment>)}
            </div>
          </td>)}
          <td className="border border-gray-200 bg-primary-50 p-[1%] text-center font-bold tabular-nums text-primary-800">{team.total}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <footer className="mt-[1%] flex justify-center gap-[3%] text-[clamp(9px,1vw,18px)] text-gray-600">
      {(["first", "second", "grade"] as const).map(kind => <span key={kind} className="flex items-center gap-2 capitalize"><span className={"h-[.7em] w-[1.7em] rounded " + colors[kind]} />{kind}</span>)}
      <span>Total includes all published programs</span>
    </footer>
  </section>;
}
