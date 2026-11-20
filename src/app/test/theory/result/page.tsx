"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { renderMathInHtml } from "@/lib/sanitizer";

function TheoryResultContent() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem("latest_theory_exam");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setData(parsed);
      } catch (e) {
        console.error("Error parsing theory exam results:", e);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (data) {
      setTimeout(() => renderMathInHtml("theory-result-container"), 100);
    }
  }, [data]);

  if (loading) {
    return (
      <main className="container flex flex-col items-center justify-center" style={{ minHeight: "80vh" }}>
        <h2>Loading Theory Exam Result...</h2>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container flex flex-col items-center justify-center" style={{ minHeight: "80vh" }}>
        <div className="card glass text-center" style={{ padding: "3rem" }}>
          <h2>No Recent Theory Exam Found</h2>
          <p style={{ color: "var(--text-secondary)", margin: "1rem 0" }}>Start a theory exam session to view your solutions and marking schemes.</p>
          <button className="btn btn-primary" onClick={() => router.push("/")}>Return to Home</button>
        </div>
      </main>
    );
  }

  const { examType, subjects, userAnswers, submittedAt } = data;

  return (
    <main className="container" id="theory-result-container" style={{ paddingBottom: "5rem" }}>
      {/* Header */}
      <div className="card glass" style={{ margin: "2rem 0", padding: "2rem", borderRadius: "20px", borderLeft: "6px solid var(--accent-color)" }}>
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-color)", textTransform: "uppercase" }}>
              {examType} THEORY EXAMINATION REVIEW
            </div>
            <h1 style={{ margin: "0.25rem 0" }}>Exam Solutions &amp; Marking Scheme</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Submitted on {new Date(submittedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-3">
            <button className="btn btn-secondary" onClick={() => router.push("/dashboard")}>
              Dashboard
            </button>
            <button className="btn btn-primary" onClick={() => router.push("/")}>
              Start New Exam
            </button>
          </div>
        </div>
      </div>

      {/* Review per Subject & Section */}
      {subjects.map((subObj: any) => (
        <div key={subObj.subject} style={{ marginBottom: "3rem" }}>
          <h2 style={{ marginBottom: "1.25rem", color: "var(--accent-color)" }}>
            📚 {subObj.subject}
          </h2>

          {subObj.sections.map((sec: any) => (
            <div key={sec.id} style={{ marginBottom: "2rem" }}>
              <h3 style={{ fontSize: "1.15rem", marginBottom: "0.75rem", color: "var(--text-primary)" }}>
                {sec.name}
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
                {sec.questions.map((q: any) => {
                  const studentAns = userAnswers[q.id] || "";
                  return (
                    <div
                      key={q.id}
                      className="card glass"
                      style={{ padding: "1.75rem", borderRadius: "16px", background: "var(--surface)" }}
                    >
                      {/* Question Header */}
                      <div className="flex justify-between items-center" style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem" }}>
                        <span style={{ fontWeight: 700, color: "var(--accent-color)" }}>
                          Question {q.questionNumber} [{q.marks || 10} Marks]
                        </span>
                        {q.year > 0 && <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Year: {q.year}</span>}
                      </div>

                      {/* Question Text */}
                      <div
                        style={{ fontSize: "1.05rem", lineHeight: "1.6", marginBottom: "1.5rem" }}
                        dangerouslySetInnerHTML={{ __html: q.text }}
                      />

                      {/* Side-by-side comparison: Student Answer vs Marking Scheme */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                        {/* Student Response */}
                        <div style={{ padding: "1.25rem", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)" }}>
                          <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem", color: "#3b82f6" }}>
                            ✍️ Your Response
                          </h4>
                          <div style={{ fontSize: "0.95rem", lineHeight: "1.6", whiteSpace: "pre-wrap", color: studentAns ? "var(--text-primary)" : "#888" }}>
                            {studentAns || "No answer written for this question."}
                          </div>
                        </div>

                        {/* Marking Scheme / Solution */}
                        <div style={{ padding: "1.25rem", borderRadius: "12px", background: "rgba(16,185,129,0.05)", border: "1px solid rgba(16,185,129,0.2)" }}>
                          <h4 style={{ margin: "0 0 0.75rem 0", fontSize: "0.95rem", color: "#10b981" }}>
                            📋 Official Marking Scheme / Solution
                          </h4>
                          <div
                            style={{ fontSize: "0.95rem", lineHeight: "1.6", color: "var(--text-primary)" }}
                            dangerouslySetInnerHTML={{ __html: q.sampleAnswer || q.explanation || "No solution guidelines provided for this question." }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </main>
  );
}

export default function TheoryResultPage() {
  return (
    <Suspense fallback={<div className="container" style={{ padding: "4rem", textAlign: "center" }}>Loading result...</div>}>
      <TheoryResultContent />
    </Suspense>
  );
}
