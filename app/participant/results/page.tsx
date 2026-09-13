'use client'; 

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { ProResult } from '../../judgement/func';
import { MdListAlt, MdSearch } from 'react-icons/md';
import { getProgramswithPagination } from '../../programs/func';
import ResultCard from '../[id]/ResultCard';
import { Paginator, PaginatorPageChangeEvent } from 'primereact/paginator';
import { categoryMap } from '../../data/branding';
import dynamic from 'next/dynamic';
import { Select } from 'antd';
import Leaderboard from './Leaderboard';
import { BiExpand } from 'react-icons/bi';

const PosterCanvas = dynamic(() => import('../../../components/common/PosterCanvas'), { ssr: false });

export default function ResultPage() {
  // --- State Management ---
  const [programs, setPrograms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  
  const [downloading, setDownloading] = useState<number | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<number[]>([]);
const [totalRecords, setTotalRecords] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [rows, setRows] = useState<number>(12);
  // --- API Data Fetching ---
  const fetchPrograms = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: rows.toString(),
        search: searchTerm, // Use the final search term directly
      });

      if (selectedCategory !== 'All') {
        params.append('category', selectedCategory);
      }

      const response = await getProgramswithPagination(params.toString());
      if (response.success) {
        setPrograms(response.data || []);
        setTotalRecords(response.total || 0);
      } else {
        setPrograms([]);
        setTotalRecords(0);
      }
    } catch (err) {
      console.error("Failed to fetch programs:", err);
      setPrograms([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedCategory,page,rows]); // Dependencies for the callback

  // --- Effects ---
  // Fetch programs on initial load and when the category changes.
  useEffect(() => {
    // We don't fetch based on searchTerm here anymore.
    // That's handled by the user submitting the form.
    fetchPrograms();
  }, [selectedCategory,page,rows]); // Now only depends on the category

  const fetchResultbyProgam = async (program: any) => {
    setDownloading(program.id);
    try {
      const response = await ProResult(program.id, 'results');
      if (response.success) {
        setResult({
          program: { ...program, name: program.name, category: program.category || '' },
          result: response.data.sort((a: any, b: any) => a.rank - b.rank),
        });
      } else {
        setError(prev => [...new Set([...prev, program.id])]);
      }
    } catch (err) {
      setError(prev => [...new Set([...prev, program.id])]);
      console.error("Error fetching program result:", err);
    } finally {
      setDownloading(null);
    }
  };

  const onPageChange = (e: PaginatorPageChangeEvent) => {
          setPage(e.page + 1);
          setRows(e.rows);
      };

  // --- Handler for search submission ---
  const handleSearch = (e: FormEvent) => {
    e.preventDefault(); // Prevent the page from reloading
    fetchPrograms(); // Manually trigger the API call
  };

  const categories = Object.keys(categoryMap);
const options = [{ value: "All", label: "All" }, ...categories.map((cls: any) => ({
  value: cls,
  label: categoryMap[cls] || cls
}))];



  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-3 pb-24 pt-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-6 text-center sm:mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-5xl">
            Program Results
          </h1>
        </div>

        <Leaderboard />

        {/* --- Filter and Search Controls --- */}
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-5 md:flex-row">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex min-w-0 flex-grow gap-2">
            <input
              type="text"
              id="search"
              placeholder="e.g., Madh Song"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700"
            >
              <MdSearch className="h-5 w-5" />
            </button>
          </form>

          {/* Category Filter Dropdown */}
          <div className="flex-shrink-0 md:w-1/4">
            <Select id="category" value={selectedCategory} onChange={(value) => { setSelectedCategory(value); setPage(1); }} options={options} className="w-full" size="large" />
          </div>
        </div>

        {/* --- Results Grid --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {isLoading ? (
            <p className="col-span-full text-center text-gray-500">Loading programs...</p>
          ) : programs.length > 0 ? (
          <>
            {programs.map(program => (
              <div key={program.id} className="flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className='flex flex-col'><div className="inline-block bg-indigo-100 text-indigo-800 text-xs w-fit font-semibold px-2.5 py-0.5 rounded-full">
                  {categoryMap[program.category]}
                </div>
                <h3 className="min-w-0 flex-1 mt-1 break-words font-bold text-gray-900">
                  {program.name}
                </h3></div>
                
                {program.status !=="announced" ? (
                   <p className="inline-flex items-center px-4 py-2 gap-2 bg-red-50 text-red-500 font-medium rounded-lg cursor-not-allowed">
                     <span className='text-sm'>Not Declared</span>
                   </p>
                ) : (
                  <div 
                    onClick={() => fetchResultbyProgam(program)}
                    className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-primary-600 px-4 py-2 font-medium text-white hover:bg-primary-700 sm:w-auto"
                  >
                  {downloading === program.id ? "Fetching..." : <p className='flex items-center gap-2'><BiExpand /> Result</p>}
                  </div>
                )}
              </div>
              
))}
            <div className='overflow-x-auto md:col-span-2 lg:col-span-3'><Paginator
                                        first={(page - 1) * rows}
                                        rows={rows}
                                        totalRecords={totalRecords}
                                        rowsPerPageOptions={[12, 18, 24]}
                                        onPageChange={onPageChange}
                                    /></div>
                      </>              
          ) : (
            <p className="col-span-full text-center text-gray-500 text-lg mt-8">
              No programs found.
            </p>
          )}
        </div>
      </main>
      {result && <ResultCard close={() => setResult(null)} data={result} />}
    </div>
  );
}