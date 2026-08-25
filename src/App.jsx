import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapPin,
  Briefcase,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Building2,
  Loader2
} from 'lucide-react';
import './index.css';

// Get base backend URL
const ENV_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const BASE_URL = ENV_URL.replace(/\/api\/jobs\/?$/, '').replace(/\/$/, '');
const API_URL = `${BASE_URL}/api/jobs`;

const sanitizeDescription = (rawText) => {
  if (!rawText) return 'No description provided.';
  try {
    const doc = new DOMParser().parseFromString(rawText, 'text/html');
    const cleanText = doc.body.textContent || "";
    return cleanText.replace(/\s+/g, ' ').trim();
  } catch (e) {
    return rawText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  }
};

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalRecords: 0 });

  // Target anchor ref placed at top of main content section
  const feedTopRef = useRef(null);

  // Filter States
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('');
  const [country, setCountry] = useState('');
  const [workModel, setWorkModel] = useState('all');
  const [statusFilter, setStatusFilter] = useState('true');

  const fetchJobs = useCallback(async (page = 1) => {
    setLoading(true);
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: '10',
      q: search,
      company,
      country,
      work_model: workModel,
      is_active: statusFilter
    });

    try {
      const res = await fetch(`${API_URL}?${queryParams}`);
      if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
      const responseData = await res.json();
      setJobs(responseData.data || []);
      setPagination(responseData.pagination || { currentPage: 1, totalPages: 1, totalRecords: 0 });
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [search, company, country, workModel, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchJobs(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchJobs]);

  // Scroll to top of the main feed area whenever page changes or new data finishes loading
  useEffect(() => {
    if (!loading && feedTopRef.current) {
      feedTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [pagination.currentPage, loading]);

  const handlePageChange = (targetPage) => {
    if (targetPage < 1 || targetPage > pagination.totalPages || targetPage === pagination.currentPage) return;

    // Smooth scroll immediately on click to prevent layout jarring
    if (feedTopRef.current) {
      feedTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    fetchJobs(targetPage);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky Header with Backdrop Blur */}
      <header className="app-header">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between header-container">
          <a href="/" className="inline-flex items-center gap-3">
            <img src="/CurrenX.png" alt="CurrenX" className="header-logo-img" />
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section text-center">
        <div className="flex items-center gap-3 active-openings-container">
          <span className="hidden sm:inline-flex">
            {pagination.totalRecords} Active Openings
          </span>
        </div>

        <div className="max-w-4xl mx-auto">
          <h2 className="hero-title">
            Find Your Next <span className="hero-accent">Career Move</span>
          </h2>
          <p className="text-slate-300 text-base sm:text-lg mt-4 max-w-2xl mx-auto leading-relaxed">
            Discover verified{' '}
            <span className="hero-highlight">tech</span>,{' '}
            <span className="hero-highlight">design</span>, and{' '}
            <span className="hero-highlight">product</span> roles from high-growth companies worldwide.
          </p>
        </div>
      </section>

      {/* Floating Hero Search Container */}
      <div className="max-w-5xl mx-auto px-4 w-full">
        <div className="job-search-card">
          <div className="max-w-5xl mx-auto px-4 w-full">
            <div className="job-search-card-1">
              <div className="hero-search-grid">
                {/* Search Keywords Input */}
                <div className="input-icon-wrapper">
                  <svg
                    className="input-svg-icon"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Job title or keywords..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="hero-input-field"
                  />
                </div>

                {/* Country / Location Input */}
                <div className="input-icon-wrapper">
                  <svg
                    className="input-svg-icon"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.5 3a17 17 0 000 18M12.5 3a17 17 0 010 18" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Country or location..."
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="hero-input-field"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Feed Content */}
      <div className="max-w-7xl mx-auto px-4 py-10 w-full grid md:grid-cols-4 gap-8 color-main">
        {/* Sidebar Filters */}
        <aside className="md:col-span-1">
          <div className="filter-card space-y-6 sticky top-24">
            <div className="flex items-center gap-2.5 pb-3.5 border-b border-slate-100 filter-header">
              <svg
                className="filter-header-icon"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9m-9 6h9m-9 6h9M3.75 6a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm0 6a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm0 6a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
              </svg>
              <span className="filter-title">Filter Listings</span>
            </div>

            {/* Company Name Input */}
            <div className="filter-container">
              <label className="filter-label">Company Name</label>
              <div className="filter-input-wrapper">
                <svg
                  className="filter-input-icon"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5s.75 0 .75.75v1.5c0 .75-.75.75-.75.75H9c-.75 0-.75-.75-.75-.75v-1.5c0-.75.75-.75.75-.75zm6 0h1.5s.75 0 .75.75v1.5c0 .75-.75.75-.75.75H15c-.75 0-.75-.75-.75-.75v-1.5c0-.75.75-.75.75-.75zM9 12.75h1.5s.75 0 .75.75v1.5c0 .75-.75.75-.75.75H9c-.75 0-.75-.75-.75-.75v-1.5c0-.75.75-.75.75-.75zm6 0h1.5s.75 0 .75.75v1.5c0 .75-.75.75-.75.75H15c-.75 0-.75-.75-.75-.75v-1.5c0-.75.75-.75.75-.75z" />
                </svg>
                <input
                  type="text"
                  placeholder="e.g. Stripe, Google"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="filter-input"
                />
              </div>
            </div>

            {/* Work Model Select */}
            <div className="filter-container">
              <label className="filter-label">Work Model</label>
              <div className="filter-input-wrapper">
                <svg
                  className="filter-input-icon"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 .414-.336.75-.75.75H4.5a.75.75 0 01-.75-.75v-4.25m16.5 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 14.15m16.5 0V8.25a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 8.25v5.9m10.5-5.9V4.5a1.5 1.5 0 00-1.5-1.5h-3a1.5 1.5 0 00-1.5 1.5v3.9" />
                </svg>
                <select
                  value={workModel}
                  onChange={(e) => setWorkModel(e.target.value)}
                  className="filter-input filter-select"
                >
                  <option value="all">All Models</option>
                  <option value="remote">Remote Only</option>
                  <option value="hybrid">Hybrid Only</option>
                  <option value="onsite">On-site Only</option>
                </select>
                <svg
                  className="filter-select-arrow"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>

            {/* Listing Status Select */}
            <div className="filter-container">
              <label className="filter-label">Listing Status</label>
              <div className="filter-input-wrapper">
                <svg
                  className="filter-input-icon"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="filter-input filter-select"
                >
                  <option value="true">Open Positions</option>
                  <option value="false">Closed / Expired</option>
                  <option value="all">All Listings</option>
                </select>
                <svg
                  className="filter-select-arrow"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>

                {/* Scroll Target Element offset below the sticky header */}
                <div ref={feedTopRef} className="scroll-mt-24" />

              </div>
            </div>
          </div>
        </aside>

        {/* Main Job Feed */}
        <main className="md:col-span-3 space-y-4">

          {loading ? (
            <div className="job-card flex flex-col items-center justify-center p-16 text-center space-y-4 min-h-[350px]">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              <p className="text-slate-300 font-medium text-sm">Fetching job feed...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="job-card p-12 text-center text-slate-300">
              No matching job opportunities found. Try relaxing your search filters.
            </div>
          ) : (
            jobs.map((job) => (
              <article key={job.id} className="job-card">
                <div className="flex justify-between items-start gap-4">
                  <div className="logohead-container flex items-center gap-3">
                    {job.logo_url ? (
                      <div className="company-logo-img-wrapper shrink-0" style={{ '--logo-src': `url(${job.logo_url})` }}>
                        <img
                          src={job.logo_url}
                          alt={`${job.company} logo`}
                          className="company-logo-img"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      </div>
                    ) : null}
                    <div
                      className="company-logo-fallback w-12 h-12 rounded border border-slate-100 bg-slate-50 items-center justify-center text-slate-400 shrink-0"
                      style={{ display: job.logo_url ? 'none' : 'flex' }}
                    >
                      <Building2 className="w-6 h-6" />
                    </div>

                    <div className="job-info">
                      <h3 className="job-title font-semibold text-slate-900">{job.title}</h3>
                      <p className="company-name mt-0.5">{job.company}</p>
                    </div>
                  </div>
                  <span className={`tag-base ${job.is_active ? 'tag-remote' : 'tag-urgent'}`}>
                    {job.is_active ? <CheckCircle className="w-3 h-3 circle" /> : <XCircle className="w-3 h-3" />}
                    {job.is_active ? 'Active' : 'Closed'}
                  </span>
                </div>

                <p className="job-description-text text-slate-600 text-sm mt-3 leading-relaxed">
                  {sanitizeDescription(job.description)}
                </p>

                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-3 description-meta">
                    <span className="flex items-center gap-1 text-slate-500 font-medium map-icon">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                    <span className="country-tag">{job.location}</span>
                    <span className="text-slate-300">•</span>
                    <span className="tag-base tag-featured">{job.type}</span>
                  </div>
                  <div className="cta">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary flex items-center gap-1 text-xs"
                    >
                      Apply Now <span><ExternalLink className="w-3 h-3" /></span>
                    </a>
                  </div>
                </div>
              </article>
            ))
          )}

          {/* Pagination Controls */}
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 mt-6">
            <span className="text-sm text-slate-500 font-medium pagination-text">
              Page {pagination.currentPage} of {pagination.totalPages || 1}
            </span>
            <div className="flex gap-2 paginate-buttons">
              <button
                disabled={pagination.currentPage === 1 || loading}
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                className="pagination-item disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 inline" />
              </button>
              <button
                disabled={pagination.currentPage >= pagination.totalPages || loading}
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                className="pagination-item disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4 inline" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}