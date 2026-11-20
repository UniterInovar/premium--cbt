"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ExamConfigPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
    if (session && session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }

    fetchConfigs();
  }, [status, session, router]);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/exam-config");
      const data = await res.json();
      setConfigs(data);
    } catch (e) {
      console.error("Failed to fetch configs:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container" style={{ padding: '2rem 1rem' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--accent-color)' }}>Exam & Subject Configuration</h1>
        <button className="btn btn-secondary" onClick={() => router.push('/admin')}>Back to Admin</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>Loading configuration...</div>
        ) : configs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>No exam types found.</div>
        ) : (
          configs.map(et => (
            <div key={et.id} className="card glass">
              <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>{et.name}</h3>
                <span className="badge" style={{ background: '#3b82f6', color: 'white' }}>{et._count.questions} Total Questions</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Subjects</h4>
                {et.subjects.map((sub: any) => (
                  <div key={sub.id} className="flex justify-between items-center" style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                    <span>{sub.name}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{sub._count.questions} questions</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
