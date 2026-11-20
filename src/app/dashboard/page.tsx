"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface ExamHistory {
  id: string;
  examType: string;
  subjects: string;
  score: number;
  total: number;
  timeTaken: number;
  createdAt: string;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [history, setHistory] = useState<ExamHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && (session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN")) {
      router.replace("/admin");
    }
  }, [status, router, session]);

  useEffect(() => {
    if (session) {
      async function fetchHistory() {
        try {
          const res = await fetch("/api/history");
          const data = await res.json();
          if (Array.isArray(data)) {
            setHistory(data);
          }
        } catch (e) {
          console.error("Failed to fetch history:", e);
        } finally {
          setLoading(false);
        }
      }
      fetchHistory();
    }
  }, [session]);

  if (!mounted || status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>
        <p>Loading your profile...</p>
      </div>
    );
  }

  const averageScore = history.length > 0 
    ? Math.round((history.reduce((acc, h) => acc + (h.score / h.total), 0) / history.length) * 100)
    : 0;

  return (
    <main className="container" style={{ minHeight: '100vh', padding: '2rem 1rem' }}>
      {/* Header */}
      <div className="flex justify-between items-center" style={{ marginBottom: '3rem' }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--accent-color)' }}>Dashboard</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Welcome back, {session?.user?.name}</p>
        </div>
        <div className="flex gap-4">
          {(session?.user as any)?.role === "ADMIN" || (session?.user as any)?.role === "SUPER_ADMIN" || session?.user?.email === "admin@example.com" ? (
             <button className="btn btn-secondary" onClick={() => router.push('/admin')}>Admin Panel</button>
          ) : null}
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard/change-password')}>Change Password</button>
          {(session?.user as any)?.role !== "ADMIN" && (session?.user as any)?.role !== "SUPER_ADMIN" && (
            <button className="btn btn-primary" onClick={() => router.push('/')}>New Exam</button>
          )}
          <button className="btn btn-secondary" onClick={() => signOut({ callbackUrl: '/' })}>Sign Out</button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="card glass animate-fade-in" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Total Exams</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{history.length}</div>
        </div>
        <div className="card glass animate-fade-in" style={{ padding: '1.5rem', textAlign: 'center', animationDelay: '0.1s' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Average Score</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981' }}>{averageScore}%</div>
        </div>
        <div className="card glass animate-fade-in" style={{ padding: '1.5rem', textAlign: 'center', animationDelay: '0.2s' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Questions Solved</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{history.reduce((acc, h) => acc + h.total, 0)}</div>
        </div>
      </div>

      {/* History Table */}
      <div className="card glass animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Recent Activity</h3>
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            <p>You haven't taken any exams yet.</p>
            <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => router.push('/')}>Start your first exam</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <th style={{ padding: '1rem 0.5rem' }}>Date</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Exam</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Subjects</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Score</th>
                  <th style={{ padding: '1rem 0.5rem' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }}>
                    <td style={{ padding: '1.25rem 0.5rem' }}>{new Date(h.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding: '1.25rem 0.5rem', fontWeight: 600 }}>{h.examType}</td>
                    <td style={{ padding: '1.25rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{h.subjects}</td>
                    <td style={{ padding: '1.25rem 0.5rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.75rem', borderRadius: '20px', 
                        backgroundColor: (h.score/h.total) >= 0.5 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: (h.score/h.total) >= 0.5 ? '#10b981' : '#ef4444',
                        fontWeight: 600
                      }}>
                        {h.score} / {h.total}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 0.5rem', color: 'var(--text-secondary)' }}>
                      {Math.floor(h.timeTaken / 60)}m {h.timeTaken % 60}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
