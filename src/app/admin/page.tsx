"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [examTypes, setExamTypes] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
    if (session && session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }

    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats");
        const data = await res.json();
        setStats(data);
      } catch (e) {
        console.error("Failed to fetch stats:", e);
      } finally {
        setLoading(false);
      }
    }
    if (session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN") fetchStats();
  }, [status, session, router]);

  const [stats, setStats] = useState({ questions: 0, users: 0, exams: 0 });

  return (
    <main className="container" style={{ padding: '2rem 1rem' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '3rem' }}>
        <div>
          <h1 style={{ color: 'var(--accent-color)' }}>Admin Panel</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Configure exams and manage the question bank.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => router.push('/dashboard/change-password')}>Change Password</button>
          <button className="btn btn-secondary" onClick={() => router.push('/')}>View Site</button>
          <button className="btn btn-secondary" onClick={() => signOut({ callbackUrl: '/' })}>Sign Out</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="card glass" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Total Questions</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.questions}</div>
        </div>
        <div className="card glass" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Total Users</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.users}</div>
        </div>
        <div className="card glass" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Exams Taken</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.exams}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        <div className="card glass">
          <h3>Question Management</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Upload new questions or manage existing ones.</p>
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <button className="btn btn-primary" onClick={() => router.push('/admin/add-question')}>Add New Question</button>
             <button className="btn btn-primary" style={{ background: 'var(--accent-color)' }} onClick={() => router.push('/admin/scraper')}>🚀 Scrape from Myschool</button>
             <button className="btn btn-secondary" onClick={() => router.push('/admin/questions')}>Browse Question Bank</button>
          </div>
        </div>

        <div className="card glass">
          <h3>Exam Configuration</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Define active exam sessions and participation rules.</p>
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <button className="btn btn-secondary" onClick={() => router.push('/admin/exam-config')}>Manage Exam Types</button>
             <button className="btn btn-secondary" onClick={() => router.push('/admin/subjects')}>Manage Subjects</button>
          </div>
        </div>

        <div className="card glass">
          <h3>User Management</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Monitor student registrations and progress.</p>
          <button className="btn btn-secondary w-full" style={{ marginTop: '1.5rem' }} onClick={() => router.push('/admin/users')}>View All Students</button>
        </div>
      </div>
      
      <div className="card glass" style={{ marginTop: '3rem' }}>
        <h3>System Status</h3>
        <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid #10b981', color: '#10b981', marginTop: '1rem' }}>
           Database connected and healthy.
        </div>
      </div>
    </main>
  );
}
