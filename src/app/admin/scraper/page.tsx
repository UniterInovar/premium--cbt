"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

const SUBJECTS = [
  "Mathematics", "English Language", "Physics", "Chemistry", "Biology",
  "Economics", "Government", "Geography", "Commerce", "Literature in English",
  "Principles of Accounts", "Agricultural Science", "Civic Education",
  "Further Mathematics", "Christian Religious Knowledge (CRK)",
];

const EXAM_TYPES = [
  { value: "WAEC", label: "WAEC — West African Examinations Council" },
  { value: "NECO", label: "NECO — National Examinations Council" },
  { value: "JAMB", label: "JAMB — Joint Admissions and Matriculation Board" },
  { value: "NABTEB", label: "NABTEB — National Business & Technical Exams Board" },
  { value: "POST_UTME", label: "Post-UTME" },
];

const QUESTION_TYPES = [
  { value: "objective", label: "Objective (MCQ)" },
  { value: "theory",    label: "Theory (Essay)" },
  { value: "practical", label: "Practical" },
];

export default function ScraperPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    subject: "Mathematics",
    examType: "JAMB",
    questionType: "objective" as "objective" | "theory" | "practical",
    filterByYear: false,
    examYear: new Date().getFullYear(),
    startPage: 1,
    endPage: 10,
    targetQuestions: 50,
  });

  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [totalSaved, setTotalSaved] = useState(0);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const stopRef = useRef(false);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Recalculate endPage when target/startPage changes
  useEffect(() => {
    const pagesNeeded = Math.ceil(form.targetQuestions / 5);
    setForm(prev => ({ ...prev, endPage: prev.startPage + pagesNeeded - 1 }));
  }, [form.targetQuestions, form.startPage]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (session && session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN") router.replace("/dashboard");
  }, [status, session, router]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-100));
  };

  // ── Probe a single page (fast, no detail fetch) ──────────────────────────
  const probePage = async (page: number): Promise<{
    totalOnPage: number; totalPages: number; years: number[]; yearMismatch?: boolean;
  } | null> => {
    try {
      const res = await fetch("/api/admin/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: form.subject,
          examType: form.examType,
          questionType: form.questionType,
          page,
          probe: true,
          ...(form.filterByYear && form.examYear ? { examYear: form.examYear } : {}),
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  // ── Quick page count probe / Find best range ──────────────────────────────
  const handleFindPages = async () => {
    setScanning(true);
    stopRef.current = false;
    setLogs([]);
    const yearNotice = form.filterByYear ? ` for Year ${form.examYear}` : " (all available years)";
    addLog(`🔍 Probing page 1 for ${form.subject} (${form.examType}) [${form.questionType.toUpperCase()}]${yearNotice}...`);

    const first = await probePage(1);
    if (!first || first.yearMismatch || !first.totalPages || first.totalOnPage === 0) {
      if (first?.yearMismatch || (first && first.totalOnPage === 0)) {
        addLog(`⚠️ No questions found for ${form.subject} (${form.examType}) in year ${form.examYear}. Try another year or uncheck Year Filter.`);
      } else {
        addLog("❌ Could not determine total pages. Try manually or check connection.");
      }
      setScanning(false);
      return;
    }

    const lastPage = first.totalPages;
    setTotalPages(lastPage);
    addLog(`📚 Total pages found: ${lastPage}`);
    addLog(`📄 Page 1 has ${first.totalOnPage} questions.`);

    if (first.years && first.years.length > 0) {
      addLog(`📅 Question years detected on page 1: ${first.years.join(", ")}`);
    }

    if (lastPage > 1) {
      addLog(`🔍 Probing last page (${lastPage})...`);
      const last = await probePage(lastPage);
      if (last) {
        addLog(`📄 Last page (${lastPage}) has ${last.totalOnPage} questions.`);
        if (last.years && last.years.length > 0) {
          addLog(`📅 Question years on last page: ${last.years.join(", ")}`);
        }
      }
    }

    // When filtering by a specific year, pages are all for that year — start from page 1.
    // When scraping all years (default oldest-first), start from the latest pages.
    const pagesNeeded = Math.ceil(form.targetQuestions / 5);
    let suggestedStart = 1;
    let suggestedEnd = lastPage;

    if (form.filterByYear) {
      suggestedStart = 1;
      suggestedEnd = Math.min(lastPage, pagesNeeded);
      addLog(`✅ Year-specific range: pages ${suggestedStart}–${suggestedEnd} (targeting up to ${form.targetQuestions} questions from ${form.examYear})`);
    } else {
      suggestedStart = Math.max(1, lastPage - pagesNeeded + 1);
      suggestedEnd = lastPage;
      addLog(`✅ Best range: pages ${suggestedStart}–${lastPage} (last ${suggestedEnd - suggestedStart + 1} pages = newest content)`);
    }

    setForm(prev => ({ ...prev, startPage: suggestedStart, endPage: suggestedEnd }));
    addLog(`👉 Click "Run Scraper Now" to fetch questions.`);

    setScanning(false);
  };

  // ── Main scrape ──────────────────────────────────────────────────────────
  const handleScrape = async () => {
    setLoading(true);
    stopRef.current = false;
    setLogs([]);
    setTotalSaved(0);
    const yearNotice = form.filterByYear ? ` [Year: ${form.examYear}]` : "";
    addLog(`🚀 Starting scraper for ${form.subject} (${form.examType}) [${form.questionType.toUpperCase()}]${yearNotice}`);
    addLog(`🎯 Pages ${form.startPage}–${form.endPage} (${form.endPage - form.startPage + 1} pages)`);

    let currentTotal = 0;
    try {
      for (let p = form.startPage; p <= form.endPage && !stopRef.current; p++) {
        addLog(`📄 Scraping page ${p}...`);

        const res = await fetch("/api/admin/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: form.subject,
            examType: form.examType,
            questionType: form.questionType,
            page: p,
            ...(form.filterByYear && form.examYear ? { examYear: form.examYear } : {}),
          }),
        });

        const data = await res.json();
        if (res.ok) {
          const emoji = data.count > 0 ? "✅" : data.rawCount === 0 ? "➖" : "⏭";
          addLog(`${emoji} ${data.message}`);
          if (data.totalPages && !totalPages) setTotalPages(data.totalPages);
          currentTotal += (data.count || 0);
          setTotalSaved(currentTotal);
        } else {
          addLog(`❌ Page ${p} Error: ${data.error}`);
          break;
        }

        await new Promise(r => setTimeout(r, 1500));
      }

      if (stopRef.current) {
        addLog(`⛔ Stopped early. Saved ${currentTotal} questions so far.`);
      } else {
        addLog(`🏁 Finished! Total new questions saved: ${currentTotal}`);
      }
    } catch (e: any) {
      addLog(`❌ Fatal Error: ${e.message}`);
    } finally {
      setLoading(false);
      stopRef.current = false;
    }
  };

  const handleStop = () => {
    stopRef.current = true;
    addLog("⛔ Stop requested — will stop after current page completes.");
  };

  const isRunning = loading || scanning;

  return (
    <main className="container" style={{ padding: "2rem 1rem" }}>
      <div className="flex justify-between items-center" style={{ marginBottom: "2rem" }}>
        <div>
          <h1 style={{ color: "var(--accent-color)" }}>Myschool.ng Scraper</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Questions are listed <strong>oldest-first</strong> — use <em>Find Pages</em> to jump to the newest content.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={handleFindPages} disabled={isRunning}>
          {scanning ? "Scanning..." : "Find Pages"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 420px) 1fr", gap: "2rem" }}>
        {/* ── Left: Config ── */}
        <div className="card glass">
          <h3 style={{ marginBottom: "1.5rem" }}>Configure Scraper</h3>

          {/* Exam Type */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label className="label">Exam Type</label>
            <select
              className="input w-full"
              style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "8px" }}
              value={form.examType}
              onChange={e => setForm({ ...form, examType: e.target.value })}
              disabled={isRunning}
            >
              {EXAM_TYPES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>

          {/* Question Type */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label className="label">Question Type</label>
            <select
              className="input w-full"
              style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "8px" }}
              value={form.questionType}
              onChange={e => setForm({ ...form, questionType: e.target.value as "objective" | "theory" | "practical" })}
              disabled={isRunning}
            >
              {QUESTION_TYPES.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
            </select>
            {form.questionType === "theory" && (
              <p style={{ fontSize: "0.78rem", color: "#f59e0b", marginTop: "0.35rem" }}>
                ⚠️ Theory questions are saved to the <strong>TheoryQuestion</strong> table (used on the Theory exam page).
              </p>
            )}
            {form.questionType === "practical" && (
              <p style={{ fontSize: "0.78rem", color: "#f59e0b", marginTop: "0.35rem" }}>
                ⚠️ Practical questions are saved to the <strong>Question</strong> table with type &quot;Practical&quot;.
              </p>
            )}
          </div>

          {/* Subject */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label className="label">Subject</label>
            <select
              className="input w-full"
              style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "8px" }}
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              disabled={isRunning}
            >
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Optional Year Filter */}
          <div style={{ marginBottom: "1.25rem", padding: "0.85rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid var(--border-color, rgba(255,255,255,0.08))" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontWeight: "500", fontSize: "0.92rem" }}>
              <input
                type="checkbox"
                checked={form.filterByYear}
                onChange={e => setForm({ ...form, filterByYear: e.target.checked })}
                disabled={isRunning}
                style={{ width: "16px", height: "16px", accentColor: "var(--accent-color)" }}
              />
              <span>Filter by Specific Exam Year</span>
            </label>
            
            {form.filterByYear ? (
              <div style={{ marginTop: "0.75rem" }}>
                <label className="label" style={{ fontSize: "0.82rem" }}>Exam Year</label>
                <input
                  type="number"
                  className="input w-full"
                  min={1970}
                  max={new Date().getFullYear()}
                  value={form.examYear}
                  disabled={isRunning}
                  onChange={e => setForm({ ...form, examYear: parseInt(e.target.value) || new Date().getFullYear() })}
                  style={{ background: "var(--surface)", padding: "0.6rem", borderRadius: "6px" }}
                />
                <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>
                  Active only because selected: &quot;Find Pages&quot; and scraping will strictly target questions from {form.examYear}.
                </p>
              </div>
            ) : (
              <p style={{ fontSize: "0.76rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>
                Year filter is inactive. Scraper will cover questions across all years (oldest-to-newest).
              </p>
            )}
          </div>

          {/* Target Questions */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label className="label">Target Questions (Approx.)</label>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <input
                type="number" className="input" style={{ flex: 1 }}
                value={form.targetQuestions} disabled={isRunning}
                onChange={e => setForm({ ...form, targetQuestions: Math.max(1, parseInt(e.target.value) || 0) })}
              />
              <span style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                ≈ {Math.ceil(form.targetQuestions / 5)} pages
              </span>
            </div>
          </div>

          {/* Page Range */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <label className="label">Start Page</label>
              <input
                type="number" className="input w-full" value={form.startPage} disabled={isRunning}
                onChange={e => setForm({ ...form, startPage: Math.max(1, parseInt(e.target.value) || 1) })}
              />
            </div>
            <div>
              <label className="label">End Page</label>
              <input
                type="number" className="input w-full" value={form.endPage} disabled={isRunning}
                onChange={e => setForm({ ...form, endPage: Math.max(form.startPage, parseInt(e.target.value) || form.startPage) })}
              />
            </div>
          </div>

          {totalPages && (
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "1rem", textAlign: "center" }}>
              📚 This subject has <strong>{totalPages}</strong> pages total.
            </p>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <button
              className="btn btn-primary w-full"
              style={{ padding: "1rem", fontSize: "1.05rem", background: "var(--accent-color)" }}
              onClick={handleScrape}
              disabled={isRunning}
            >
              {loading ? "Scraping..." : "Run Scraper Now"}
            </button>
            {isRunning && (
              <button
                className="btn btn-secondary w-full"
                style={{ borderColor: "#ef4444", color: "#ef4444" }}
                onClick={handleStop}
              >
                ⛔ Stop
              </button>
            )}
          </div>

          <p style={{ marginTop: "1rem", fontSize: "0.82rem", color: "var(--text-secondary)", textAlign: "center" }}>
            ⚠️ Myschool.ng lists questions <strong>oldest-first</strong>.<br />
            Use <em>Find Pages</em> to auto-detect the last page (newest content).
          </p>
        </div>

        {/* ── Right: Logs ── */}
        <div className="card glass" style={{ display: "flex", flexDirection: "column", minHeight: "550px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3>Activity Logs</h3>
            {logs.length > 0 && (
              <button
                className="btn btn-secondary"
                style={{ fontSize: "0.78rem", padding: "0.3rem 0.75rem" }}
                onClick={() => setLogs([])}
              >
                Clear
              </button>
            )}
          </div>
          <div style={{
            flex: 1, background: "#0f1117", color: "#00e676", padding: "1rem",
            borderRadius: "8px", fontFamily: "monospace", fontSize: "0.82rem",
            overflowY: "auto", maxHeight: "500px",
            border: "1px solid rgba(0,230,118,0.15)"
          }}>
            {logs.length === 0 ? (
              <div style={{ color: "#555" }}>Waiting for start...</div>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: "0.2rem",
                    color: log.includes("❌") ? "#ff5252"
                      : log.includes("⚠️") ? "#ffab40"
                      : log.includes("✅") ? "#00e676"
                      : log.includes("⏭") ? "#78909c"
                      : log.includes("🏁") || log.includes("👉") ? "#64b5f6"
                      : "#00e676"
                  }}
                >
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
          {totalSaved > 0 && !loading && (
            <div style={{
              marginTop: "1rem", fontWeight: "bold",
              color: "var(--accent-color)", textAlign: "center",
              padding: "0.75rem", background: "rgba(16,185,129,0.08)",
              borderRadius: "8px", border: "1px solid rgba(16,185,129,0.2)"
            }}>
              ✅ Batch complete — {totalSaved} new questions saved!
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
