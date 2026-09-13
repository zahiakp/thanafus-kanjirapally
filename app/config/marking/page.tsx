import AdminLayout from "../../../components/layout/AdminLayout";
import {
  GRADE_BOUNDARIES,
  GRADE_ORDER,
  GRADE_POINTS,
  RANK_POINTS,
} from "../../utils/markingCriteria";
import {
  MdCalculate,
  MdGroups,
  MdInfoOutline,
  MdLightbulbOutline,
  MdOutlineEmojiEvents,
  MdRule,
  MdVerified,
} from "react-icons/md";

const reviewItems = [
  {
    title: "All program sizes use the same points",
    detail:
      "A earns 5 grade points and B earns 3 grade points in individual and group programs.",
  },
  {
    title: "Ties share a rank and skip the next position",
    detail:
      "Equal normalized marks receive the same rank. Ranking then follows competition order, such as 1, 1, followed by no awarded rank.",
  },
  {
    title: "Placement points can exist without a grade",
    detail:
      "A top-two participant below 70 receives rank points even though no grade points are awarded.",
  },
  {
    title: "Group results use the primary participant record",
    detail:
      "For a structural group program, the saved result belongs to the first listed participant representative while retaining the judging code.",
  },
];

export default function MarkingCriteriaPage() {
  return (
    <AdminLayout active="config">
      <div className="mx-auto w-full max-w-7xl space-y-6 py-5">
        <section className="overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-white">
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <MdVerified className="text-base" />
                Current system criteria
              </div>
              <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
                Marking criteria
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 md:text-base">
                A plain-language view of the exact rules used when final results are generated.
                This page is read-only and stays synchronized with the calculation code.
              </p>
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary-600 text-4xl text-white shadow-lg shadow-primary-200">
              <MdRule />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <MdCalculate className="text-3xl text-primary-600" />
            <h2 className="mt-3 font-semibold text-gray-900">Normalize marks</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Judge marks are added and converted to a percentage out of 100.
            </p>
          </article>
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <MdOutlineEmojiEvents className="text-3xl text-amber-500" />
            <h2 className="mt-3 font-semibold text-gray-900">Assign rank and grade</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Participants are sorted by normalized mark. Equal marks receive the same rank.
            </p>
          </article>
          <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <MdGroups className="text-3xl text-emerald-600" />
            <h2 className="mt-3 font-semibold text-gray-900">Calculate total points</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Total points = grade points + placement points.
            </p>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-6">
            <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Grade boundaries</h2>
              <p className="mt-1 text-sm text-gray-500">Based on the normalized percentage.</p>
              <div className="mt-4 space-y-3">
                {GRADE_BOUNDARIES.map((boundary, index) => {
                  const nextMinimum = GRADE_BOUNDARIES[index - 1]?.minimum;
                  return (
                    <div key={boundary.grade} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 font-bold text-primary-700">
                        {boundary.grade}
                      </span>
                      <span className="font-medium text-gray-700">
                        {nextMinimum ? `${boundary.minimum}% to below ${nextMinimum}%` : `${boundary.minimum}–100%`}
                      </span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm">
                  <span className="font-semibold text-red-700">No grade</span>
                  <span className="font-medium text-red-700">Below 70%</span>
                </div>
              </div>
            </article>

            <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">Placement points</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {Object.entries(RANK_POINTS).map(([rank, points]) => (
                  <div key={rank} className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                    <div className="text-sm font-medium text-amber-800">
                      {rank === "1" ? "1st" : rank === "2" ? "2nd" : "3rd"}
                    </div>
                    <div className="mt-1 text-2xl font-bold text-amber-700">{points}</div>
                    <div className="text-xs text-amber-700">points</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-gray-500">
                All positions after second receive zero placement points.
              </p>
            </article>
          </div>

          <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-5">
              <h2 className="text-lg font-semibold text-gray-900">Grade points</h2>
              <p className="mt-1 text-sm text-gray-500">
                The same grade points apply to all individual and group programs.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-4">Programs</th>
                    {GRADE_ORDER.map((grade) => <th key={grade} className="px-5 py-4 text-center">{grade}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-5 py-4 font-semibold text-gray-900">All program sizes</td>
                    {GRADE_ORDER.map((grade) => (
                      <td key={grade} className="px-5 py-4 text-center font-semibold text-primary-700">{GRADE_POINTS[grade]}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
              A: 5 points. B: 3 points. Below 70%: 0 grade points.
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 md:p-6">
          <div className="flex gap-3">
            <MdInfoOutline className="mt-0.5 shrink-0 text-2xl text-blue-700" />
            <div>
              <h2 className="font-semibold text-blue-950">How multiple judges are combined</h2>
              <div className="mt-3 grid gap-3 text-sm text-blue-900 sm:grid-cols-3">
                <div className="rounded-xl bg-white/70 p-4"><b>1 judge:</b> mark - 100 - 100</div>
                <div className="rounded-xl bg-white/70 p-4"><b>2 judges:</b> total - 200 - 100</div>
                <div className="rounded-xl bg-white/70 p-4"><b>3 judges:</b> total - 300 - 100</div>
              </div>
              <p className="mt-3 text-sm leading-6 text-blue-900">
                Only participants with status <b>finished</b> are included when final results are generated.
                Records with zero total points are not saved.
              </p>
            </div>
          </div>
        </section>

        {/* <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 md:p-6">
          <div className="flex items-start gap-3">
            <MdLightbulbOutline className="mt-0.5 shrink-0 text-2xl text-amber-700" />
            <div className="w-full">
              <h2 className="text-lg font-semibold text-amber-950">Items to review manually</h2>
              <p className="mt-1 text-sm text-amber-800">
                These are existing system behaviours worth confirming with the event committee.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {reviewItems.map((item) => (
                  <article key={item.title} className="rounded-xl border border-amber-200 bg-white p-4">
                    <h3 className="font-semibold text-gray-900">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">{item.detail}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section> */}
      </div>
    </AdminLayout>
  );
}
