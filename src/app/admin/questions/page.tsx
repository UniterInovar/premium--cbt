"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cleanOptionPrefix, renderMath } from "@/lib/sanitizer";

export default function BrowseQuestionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [questions, setQuestions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ examType: "", subject: "", year: "", topic: "", questionType: "" });
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
    if (session && session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }

    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session, router, page]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        examType: filters.examType,
        subject: filters.subject,
        year: filters.year,
        topic: filters.topic,
        sortBy: sortBy,
        ...(filters.questionType && { questionType: filters.questionType }),
      }).toString();
      
      const res = await fetch(`/api/admin/questions?${query}`);
      const data = await res.json();
      setQuestions(data.questions);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e) {
      console.error("Failed to fetch questions:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (questions.length === 0) return;
    
    let attempts = 0;
    const trigger = () => renderMath("admin-questions-container");
    trigger();
    const interval = setInterval(() => {
      attempts++;
      trigger();
      if (attempts >= 15) clearInterval(interval);
    }, 120);
    return () => clearInterval(interval);
  }, [questions, page]); // Re-run when questions or page changes

  const handleDelete = async (id: string) => {
    // Skipping confirm temporarily to verify if browser blocked native dialogs
    try {
      const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
      if (res.ok) {
        setQuestions(questions.filter(q => q.id !== id));
        setTotal(prev => prev - 1);
        alert("Question deleted successfully!");
      } else {
        const err = await res.json();
        alert(`Failed to delete: ${err.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      console.error("Failed to delete question:", e);
      alert(`Network error: ${e.message}`);
    }
  };


  return (
    <main className="container" style={{ padding: '2rem 1rem' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--accent-color)' }}>Browse Question Bank</h1>
        <button className="btn btn-secondary" onClick={() => router.push('/admin')}>Back to Admin</button>
      </div>

      {/* Filters */}
      <div className="card glass flex flex-wrap gap-2" style={{ marginBottom: '2rem', padding: '1rem' }}>
        <select 
          className="input flex-1"
          style={{ minWidth: '150px', background: 'var(--surface)' }}
          value={filters.examType}
          onChange={e => setFilters({...filters, examType: e.target.value})}
        >
          <option value="">All Exams</option>
          <option value="WAEC">WAEC</option>
          <option value="NECO">NECO</option>
          <option value="JAMB">JAMB</option>
          <option value="NABTEB">NABTEB</option>
          <option value="POST_UTME">Post-UTME</option>
        </select>
        <input 
          placeholder="Subject" 
          className="input flex-1"
          style={{ minWidth: '150px' }}
          value={filters.subject}
          onChange={e => setFilters({...filters, subject: e.target.value})}
        />
        <input 
          placeholder="Year" 
          className="input flex-1"
          type="number"
          style={{ minWidth: '100px' }}
          value={filters.year}
          onChange={e => setFilters({...filters, year: e.target.value})}
        />
        <input 
          placeholder="Topic" 
          className="input flex-1"
          style={{ minWidth: '150px' }}
          value={filters.topic}
          onChange={e => setFilters({...filters, topic: e.target.value})}
        />
        <select 
          className="input flex-1"
          style={{ minWidth: '150px', background: 'var(--surface)' }}
          value={filters.questionType}
          onChange={e => setFilters({...filters, questionType: e.target.value})}
        >
          <option value="">All Types</option>
          <option value="objective">Objective</option>
          <option value="theory">Theory</option>
          <option value="practical">Practical</option>
        </select>
        <select 
          className="input flex-1"
          style={{ minWidth: '150px', background: 'var(--surface)' }}
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option value="newest">Newest Added</option>
          <option value="oldest">Oldest Added</option>
          <option value="yearDesc">Year (Newest)</option>
          <option value="yearAsc">Year (Oldest)</option>
        </select>
        <button className="btn btn-primary" onClick={() => { setPage(1); fetchQuestions(); }}>Apply</button>
      </div>

      <div className="card glass" id="admin-questions-container" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
              <th style={{ padding: '1rem' }}>Question Text</th>
              <th style={{ padding: '1rem' }}>Options</th>
              <th style={{ padding: '1rem' }}>Details</th>
              <th style={{ padding: '1rem' }}>Year</th>
              <th style={{ padding: '1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>Loading questions...</td></tr>
            ) : questions.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }}>No questions found.</td></tr>
            ) : (
              questions.map(q => {
                const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                return (
                  <tr key={q.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem', maxWidth: '300px' }}>
                      <div 
                        style={{ maxHeight: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        dangerouslySetInnerHTML={{ __html: q.text }}
                      />
                    </td>
                    <td style={{ padding: '1rem', maxWidth: '300px', fontSize: '0.85rem' }}>
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                        {opts.map((o: string, idx: number) => {
                           const cleanOpt = cleanOptionPrefix(o);
                           return (
                             <li key={idx} style={{ color: idx.toString() === q.correctAnswer ? '#10b981' : 'inherit' }}>
                               <strong>{String.fromCharCode(65 + idx)}.</strong> <span dangerouslySetInnerHTML={{ __html: cleanOpt }} />
                             </li>
                           );
                        })}
                      </ul>
                    </td>
                    <td style={{ padding: '1rem' }}>
                        <div><strong>{q.subject.name}</strong></div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{q.examType.name}</div>
                        <div style={{ fontSize: '0.78rem', marginTop: '0.3rem' }}>
                          <span style={{
                            padding: '0.1rem 0.5rem', borderRadius: '4px',
                            background: q.type === 'Objective' ? 'rgba(16,185,129,0.15)' : q.type === 'Theory' ? 'rgba(59,130,246,0.15)' : 'rgba(245,158,11,0.15)',
                            color: q.type === 'Objective' ? '#10b981' : q.type === 'Theory' ? '#3b82f6' : '#f59e0b',
                          }}>{q.type}</span>
                        </div>
                        {q.topic && <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }} className="badge bg-secondary text-light">{q.topic.name}</div>}
                    </td>
                    <td style={{ padding: '1rem' }}>{q.year}</td>
                    <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem 0.5rem', borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }}
                        onClick={() => router.push(`/admin/questions/${q.id}/edit`)}
                      >
                        Edit
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.25rem 0.5rem', color: '#ef4444', borderColor: '#ef4444' }}
                        onClick={() => handleDelete(q.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center items-center gap-1" style={{ marginTop: '2rem' }}>
        <button 
          className="btn btn-secondary" 
          disabled={page === 1} 
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span style={{ color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
        <button 
          className="btn btn-secondary" 
          disabled={page === totalPages} 
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </main>
  );
}
