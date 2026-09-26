'use client';

import { Fragment, useEffect, useState } from 'react';
import { MdRefresh } from 'react-icons/md';
import { categoryMap } from '../data/branding';
import type { ScoreBoard, ScoreAward } from '../utils/scoreboard';
import LDRloader from '../../components/common/LDRloader';

const awardColors: Record<ScoreAward['kind'], string> = {
  first: 'bg-red-600', second: 'bg-blue-800', grade: 'bg-black',
};

export default function TeamScoreBoard() {
  const [category, setCategory] = useState(Object.keys(categoryMap)[0]);
  const [data, setData] = useState<ScoreBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    async function load() {
      try {
        const response = await fetch(`/api/team-scoreboard?category=${encodeURIComponent(category)}`, { signal: controller.signal, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Unable to load the score board');
        if (!controller.signal.aborted) setData(result.data);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load the score board');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [category, revision]);

  return (
    <section className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm" aria-label="Team Score Board">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 sm:px-6">
        <nav className="flex max-w-full gap-5 overflow-x-auto" aria-label="Score board categories">
          {Object.entries(categoryMap).map(([key, label]) => (
            <button key={key} type="button" aria-pressed={category === key} onClick={() => setCategory(key)} className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors ${category === key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {label}
            </button>
          ))}
        </nav>
        <button type="button" onClick={() => setRevision(value => value + 1)} disabled={loading} className="my-2 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"><MdRefresh className={loading ? 'animate-spin' : ''} />Refresh</button>
      </div>
      {loading ? <div className="flex h-60 items-center justify-center" role="status" aria-label="Loading score board"><LDRloader /></div>
        : error ? <div className="p-10 text-center" role="alert"><p className="text-red-700">{error}</p><button type="button" onClick={() => setRevision(value => value + 1)} className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-white">Try again</button></div>
        : data && <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4">
            <span className="text-sm text-gray-500">{data.teams.length} teams · {data.programs.length} programs</span>
          </div>
          {!data.programs.length ? <p className="p-10 text-center text-gray-500">No programs in this category.</p>
            : !data.teams.length ? <p className="p-10 text-center text-gray-500">No teams found.</p>
            : <div className="w-full max-w-full max-h-[70vh] overflow-auto border-y border-gray-200" tabIndex={0} role="region" aria-label={`${categoryMap[category]} team scores`}>
              <table className="w-full border-separate border-spacing-0 text-sm">
                <caption className="sr-only">{categoryMap[category]} points by team and program. First: red. Second: blue. Grade: black.</caption>
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 top-0 z-30 min-w-[180px] border-b border-r border-gray-200 bg-primary-50 px-4 py-4 text-left font-semibold text-primary-800 sm:min-w-[250px]">Team</th>
                    {data.programs.map(program => <th key={program.id} scope="col" className="sticky top-0 z-20 min-w-[140px] max-w-[200px] border-b border-r border-gray-200 bg-gray-50 px-4 py-4 text-center font-semibold text-gray-700"><span className="block min-w-[110px] whitespace-normal">{program.name}</span></th>)}
                    <th scope="col" className="sticky top-0 z-20 min-w-[100px] border-b border-gray-200 bg-primary-50 px-4 py-4 text-center font-semibold text-primary-800">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teams.map(team => <tr key={team.id} className="group">
                    <th scope="row" className="sticky left-0 z-10 border-b border-r border-gray-200 bg-white px-4 py-3 text-left group-hover:bg-primary-50"><span className="block max-w-[230px] font-medium text-gray-900">{team.name}</span><span className="mt-1 block text-xs font-normal text-gray-500">{team.id}</span></th>
                    {data.programs.map(program => <td key={program.id} className="border-b border-r border-gray-200 px-3 py-3 text-center group-hover:bg-gray-50">
                      <div className="inline-flex items-center justify-center whitespace-nowrap font-semibold tabular-nums">
                        {(team.scores[program.id] || []).map((award, index) => <Fragment key={award.id}>{index > 0 && <span className="px-1 text-gray-500">+</span>}<span aria-label={`${award.kind}: ${award.point}`} className={`inline-flex min-w-7 justify-center rounded-md px-2 py-1 text-white ${awardColors[award.kind]}`}>{award.point}</span></Fragment>)}
                      </div>
                    </td>)}
                    <td className="border-b border-gray-200 bg-primary-50 px-4 py-3 text-center font-bold tabular-nums text-primary-800">
                      {data.programs.reduce((total, program) => total + (team.scores[program.id] || []).reduce((sum, award) => sum + award.point, 0), 0)}
                    </td>
                  </tr>)}
                </tbody>
              </table>
            </div>}
          <div className="flex flex-wrap items-center justify-center gap-6 px-6 py-4 text-sm font-medium text-gray-600" aria-label="Score colors">
            {(['first', 'second', 'grade'] as const).map(kind => <span key={kind} className="inline-flex items-center gap-2"><span className={`h-3 w-7 rounded ${awardColors[kind]}`} aria-hidden="true" /><span className="capitalize">{kind}</span></span>)}
          </div>
        </>}
    </section>
  );
}
