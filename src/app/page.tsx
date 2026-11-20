"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [examType, setExamType] = useState("WAEC");
  const [examMode, setExamMode] = useState<"objective" | "theory">("objective");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [isStrict, setIsStrict] = useState(false);

  // Subjects that actually exist in the database per exam type
  const subjectsByExam: Record<string, string[]> = {
    JAMB: ["Mathematics", "English Language", "Physics", "Chemistry", "Biology", "Economics", "Government", "Commerce", "Literature in English", "Geography", "Christian Religious Knowledge (CRK)", "Principles of Accounts"],
    WAEC: ["Mathematics", "English Language", "Physics", "Chemistry", "Biology", "Economics", "Government", "Commerce", "Literature in English", "Geography", "Further Mathematics", "Agricultural Science", "Christian Religious Knowledge (CRK)", "Civic Education", "Principles of Accounts"],
    NECO: ["Mathematics", "English Language", "Physics", "Chemistry", "Biology", "Economics", "Government", "Commerce", "Literature in English", "Geography", "Agricultural Science", "Christian Religious Knowledge (CRK)"],
  };
  const allSubjects = subjectsByExam[examType] || [];

  const toggleSubject = (sub: string) => {
    if (subjects.includes(sub)) {
      setSubjects(subjects.filter(s => s !== sub));
    } else {
      if (examType === "JAMB" && subjects.length >= 4) return;
      setSubjects([...subjects, sub]);
    }
  };

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";

  const startTest = () => {
    if (!session) {
      router.push("/login");
      return;
    }
    if (isAdmin) {
      alert("Admins and Super Admins cannot take practice tests. Please use a student account.");
      return;
    }
    if (subjects.length === 0) return alert("Please select at least one subject");
    
    const query = new URLSearchParams();
    query.set("exam", examType);
    query.set("subjects", subjects.join(","));
    if (isStrict) query.set("strict", "true");
    
    if (examMode === "theory") {
      router.push(`/test/theory?${query.toString()}`);
    } else {
      router.push(`/test?${query.toString()}`);
    }
  };

  return (
    <main className="container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Premium Navigation Header */}
      <nav className="glass" style={{ margin: '1rem 0 2rem 0', padding: '1rem 2rem', borderRadius: '100px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: 'var(--accent-color)', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => router.push('/')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          PrepElite
        </h2>
        <div className="flex gap-4 items-center">
          {status === "loading" ? (
            <div style={{ width: '120px', height: '38px', borderRadius: '100px', backgroundColor: 'var(--border-color)', opacity: 0.5, animation: 'pulse 1.5s infinite' }}></div>
          ) : (
            <>
              {/* Always show public auth links */}
              <button className="btn btn-secondary" style={{ padding: '0.6rem 1.5rem' }} onClick={() => router.push('/login')}>Sign In</button>
              <button className="btn btn-primary" style={{ padding: '0.6rem 1.5rem', marginLeft: '0.8rem' }} onClick={() => router.push('/login?register=true')}>Create Account</button>
              {/* If a session exists, also show Dashboard and Sign Out */}
              {session && (
                <>
                  <button className="btn btn-secondary" style={{ padding: '0.6rem 1.25rem', marginLeft: '1rem' }} onClick={() => router.push('/dashboard')}>Dashboard</button>
                  <button className="btn btn-secondary" style={{ padding: '0.6rem 1.25rem', marginLeft: '0.5rem', borderColor: 'transparent' }} onClick={async () => { await signOut({ redirect: false }); router.replace('/'); }}>Sign Out</button>
                </>
              )}
            </>
          )}
        </div>
      </nav>

      {/* Hero Content */}
      <div className="flex flex-col justify-center items-center" style={{ flex: 1, paddingBottom: '4rem' }}>
        
        <div style={{ textAlign: 'center', maxWidth: '700px', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1.1, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Master Your Exams. <br/>
            <span style={{ color: 'var(--accent-color)' }}>With Confidence.</span>
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)' }}>
            Practice past questions for JAMB, WAEC, NECO, and IGCSE with intelligent tracking and comprehensive answer explanations.
          </p>
        </div>

        <div className="card glass w-full text-center" style={{ maxWidth: '650px', padding: '2.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Configure Your Session</h3>

          {/* Step 1: Exam Mode Selector */}
          <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em' }}>1. Select Paper Format</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setExamMode("objective");
                }}
                style={{
                  flex: 1,
                  padding: "0.9rem 1rem",
                  borderRadius: "14px",
                  fontSize: "0.95rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.25rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  border: examMode === "objective" ? "2px solid var(--accent-color)" : "1px solid var(--border-color)",
                  background: examMode === "objective" ? "var(--accent-color)" : "var(--surface)",
                  color: examMode === "objective" ? "#ffffff" : "var(--text-primary)",
                  boxShadow: examMode === "objective" ? "0 4px 14px var(--accent-glow)" : "none",
                }}
              >
                <span style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  {examMode === "objective" && "✓ "}Objective Paper (MCQ)
                </span>
                <span style={{ fontSize: "0.75rem", opacity: examMode === "objective" ? 0.9 : 0.65 }}>Multiple Choice Questions</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setExamMode("theory");
                  if (examType === "JAMB") {
                    setExamType("WAEC");
                  }
                }}
                style={{
                  flex: 1,
                  padding: "0.9rem 1rem",
                  borderRadius: "14px",
                  fontSize: "0.95rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.25rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  border: examMode === "theory" ? "2px solid var(--accent-color)" : "1px solid var(--border-color)",
                  background: examMode === "theory" ? "var(--accent-color)" : "var(--surface)",
                  color: examMode === "theory" ? "#ffffff" : "var(--text-primary)",
                  boxShadow: examMode === "theory" ? "0 4px 14px var(--accent-glow)" : "none",
                }}
              >
                <span style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  {examMode === "theory" && "✓ "}Theory Paper (Essay) 📝
                </span>
                <span style={{ fontSize: "0.75rem", opacity: examMode === "theory" ? 0.9 : 0.65 }}>Structured &amp; Theory Questions</span>
              </button>
            </div>
          </div>
          
          {/* Step 2: Exam Type Selector */}
          <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em' }}>2. Select Exam Type</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
              {["WAEC", "NECO", "JAMB"].map(ext => {
                const isActive = examType === ext;
                const isJambTheory = examMode === "theory" && ext === "JAMB";
                return (
                  <button 
                    key={ext}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      if (ext === "JAMB" && examMode === "theory") {
                        setExamMode("objective");
                      }
                      setExamType(ext);
                      setSubjects([]);
                    }}
                    style={{
                      padding: "0.85rem 0.5rem",
                      borderRadius: "12px",
                      fontSize: "1rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      border: isActive ? "2px solid var(--accent-color)" : "1px solid var(--border-color)",
                      background: isActive ? "var(--accent-color)" : "var(--surface)",
                      color: isActive ? "#ffffff" : "var(--text-primary)",
                      boxShadow: isActive ? "0 4px 12px var(--accent-glow)" : "none",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.2rem",
                    }}
                  >
                    <span>{isActive ? `✓ ${ext}` : ext}</span>
                    {isJambTheory && (
                      <span style={{ fontSize: "0.68rem", opacity: 0.8, color: "#f59e0b" }}>OBJ Only</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
            <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
              3. Choose Subjects
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)', marginLeft: '8px', fontWeight: 'normal', textTransform: 'none' }}>
                {examType === "JAMB" ? "(Select exactly 4)" : "(Select as many as you like)"}
              </span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.85rem' }}>
              {allSubjects.map(sub => {
                const isSelected = subjects.includes(sub);
                return (
                  <label key={sub} style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', 
                    padding: '0.75rem 1rem', borderRadius: '12px', 
                    backgroundColor: isSelected ? 'var(--accent-glow)' : 'var(--surface)', 
                    border: `1px solid ${isSelected ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    transition: 'all 0.2s',
                    opacity: examType === "JAMB" && subjects.length >= 4 && !isSelected ? 0.5 : 1
                  }}>
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleSubject(sub)}
                      disabled={examType === "JAMB" && subjects.length >= 4 && !isSelected}
                      style={{ width: '1.15rem', height: '1.15rem', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.95rem', fontWeight: isSelected ? '600' : '500', color: isSelected ? 'var(--accent-color)' : 'var(--text-primary)' }}>{sub}</span>
                  </label>
                )
              })}
            </div>
          </div>

          <div style={{ marginBottom: '2.5rem', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <input 
              type="checkbox" 
              id="strictMode"
              checked={isStrict}
              onChange={(e) => setIsStrict(e.target.checked)}
              style={{ marginTop: '0.25rem', width: '1.25rem', height: '1.25rem', accentColor: '#ef4444', cursor: 'pointer' }}
            />
            <div>
              <label htmlFor="strictMode" style={{ display: 'block', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                Enable Strict Mode 🚨
              </label>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Simulates real-world exam conditions by forcing fullscreen and auto-submitting if you try to switch tabs or exit fullscreen.
              </p>
            </div>
          </div>

          {isAdmin && (
            <div style={{
              marginBottom: "1.5rem",
              padding: "1rem",
              borderRadius: "12px",
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              color: "#f59e0b",
              fontSize: "0.95rem",
              textAlign: "left"
            }}>
              ⚠️ <strong>Admin Notice:</strong> Administrators and Super Admins are not permitted to take exams. Practice sessions are strictly reserved for student accounts.
            </div>
          )}

          {isAdmin ? (
            <button
              onClick={() => router.push('/admin')}
              className="btn btn-primary w-full"
              style={{
                padding: '1.25rem',
                fontSize: '1.15rem',
                borderRadius: '16px',
                display: 'flex',
                gap: '0.5rem',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'var(--accent-color)'
              }}
            >
              Go to Admin Panel 🛡️
            </button>
          ) : (
            <button onClick={startTest} className="btn btn-primary w-full" style={{ padding: '1.25rem', fontSize: '1.2rem', borderRadius: '16px', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              Begin Practice Session
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
