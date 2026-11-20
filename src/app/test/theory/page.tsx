"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { renderMathInHtml } from "@/lib/sanitizer";

function TheoryTestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const exam = searchParams.get("exam") || "WAEC";
  const subjectsParam = searchParams.get("subjects") || "";
  const year = searchParams.get("year") || "";
  const isStrict = searchParams.get("strict") === "true";

  const examUpper = exam.toUpperCase();
  const isNeco = examUpper === "NECO";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjectData, setSubjectData] = useState<any[]>([]);
  const [activeSubjectIdx, setActiveSubjectIdx] = useState(0);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);

  // Student answers: keyed by questionId -> string
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  // Selected optional questions: keyed by sectionId -> Array of questionIds
  const [selectedOptional, setSelectedOptional] = useState<Record<string, string[]>>({});

  // Timer
  const [timeLeft, setTimeLeft] = useState(120 * 60); // 2 hours default
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Math preview active tab per question
  const [mathPreview, setMathPreview] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN") {
      alert("Admins and Super Admins cannot take practice tests.");
      router.replace("/admin");
    }
  }, [session, router]);

  useEffect(() => {
    fetchTheoryQuestions();
  }, [exam, subjectsParam, year]);

  const fetchTheoryQuestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/questions/theory?exam=${exam}&subjects=${subjectsParam}${year ? `&year=${year}` : ""}`);
      const data = await res.json();

      if (!res.ok || !data.subjects || data.subjects.length === 0) {
        setError("No theory questions found for the selected exam and subjects. Try scraping theory questions in Admin panel first.");
        setLoading(false);
        return;
      }

      setSubjectData(data.subjects);
      setLoading(false);
    } catch (err: any) {
      console.error("Error loading theory questions:", err);
      setError("Failed to load theory exam data.");
      setLoading(false);
    }
  };

  // Timer countdown
  useEffect(() => {
    if (loading || isSubmitted) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, isSubmitted]);

  // Re-render KaTeX math when view changes
  useEffect(() => {
    if (!loading && subjectData.length > 0) {
      setTimeout(() => renderMathInHtml("theory-exam-container"), 100);
    }
  }, [loading, activeSubjectIdx, activeSectionIdx, mathPreview]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? `${h}:` : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleAnswerChange = (qId: string, value: string) => {
    setUserAnswers((prev) => ({ ...prev, [qId]: value }));
  };

  const toggleOptionalQuestion = (secId: string, qId: string, maxChoice: number) => {
    setSelectedOptional((prev) => {
      const current = prev[secId] || [];
      if (current.includes(qId)) {
        return { ...prev, [secId]: current.filter((id) => id !== qId) };
      } else {
        if (current.length >= maxChoice) {
          alert(`You can only select a maximum of ${maxChoice} questions for this section.`);
          return prev;
        }
        return { ...prev, [secId]: [...current, qId] };
      }
    });
  };

  const handleSubmitExam = () => {
    setIsSubmitted(true);
    // Store theory result data in sessionStorage for result page
    const payload = {
      examType: examUpper,
      subjects: subjectData,
      userAnswers,
      selectedOptional,
      submittedAt: new Date().toISOString(),
    };
    sessionStorage.setItem("latest_theory_exam", JSON.stringify(payload));
    router.push("/test/theory/result");
  };

  if (loading) {
    return (
      <main className="container flex flex-col items-center justify-center" style={{ minHeight: "80vh" }}>
        <div className="card glass text-center" style={{ padding: "3rem" }}>
          <div className="animate-pulse" style={{ fontSize: "2rem", marginBottom: "1rem" }}>📝</div>
          <h2>Loading {examUpper} Theory Examination...</h2>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>Organizing exam sections and question guidelines</p>
        </div>
      </main>
    );
  }

  if (error || subjectData.length === 0) {
    return (
      <main className="container flex flex-col items-center justify-center" style={{ minHeight: "80vh" }}>
        <div className="card glass text-center" style={{ padding: "3rem", maxWidth: "600px" }}>
          <h2 style={{ color: "#ef4444" }}>Theory Exam Unavailable</h2>
          <p style={{ margin: "1rem 0", color: "var(--text-secondary)" }}>{error || "No theory questions found."}</p>
          <button className="btn btn-primary" onClick={() => router.push("/")}>Return to Home</button>
        </div>
      </main>
    );
  }

  const currentSubjectObj = subjectData[activeSubjectIdx] || subjectData[0];
  const currentSection = currentSubjectObj.sections[activeSectionIdx] || currentSubjectObj.sections[0];

  return (
    <main className="container" id="theory-exam-container" style={{ paddingBottom: "5rem" }}>
      {/* Official Header Banner */}
      <header className="card glass" style={{ margin: "1rem 0 1.5rem 0", padding: "1.25rem 1.75rem", borderLeft: "5px solid var(--accent-color)" }}>
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--accent-color)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {isNeco ? "National Examinations Council (NECO)" : "West African Examinations Council (WAEC)"}
            </div>
            <h2 style={{ margin: "0.2rem 0 0 0", fontSize: "1.35rem" }}>
              {isNeco ? "SENIOR SCHOOL CERTIFICATE EXAMINATION (SSCE) THEORY" : "WEST AFRICAN SENIOR SCHOOL CERTIFICATE EXAMINATION (WASSCE) THEORY"}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div style={{ padding: "0.5rem 1rem", borderRadius: "100px", background: timeLeft < 300 ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)", border: `1px solid ${timeLeft < 300 ? "#ef4444" : "#10b981"}`, color: timeLeft < 300 ? "#ef4444" : "#10b981", fontWeight: 700, fontFamily: "monospace", fontSize: "1.1rem" }}>
              ⏱️ {formatTime(timeLeft)}
            </div>
            <button className="btn btn-primary" onClick={() => setShowSubmitModal(true)} style={{ background: "#10b981", borderColor: "#10b981" }}>
              Submit Paper 📤
            </button>
          </div>
        </div>
      </header>

      {/* Subject Navigation Tabs */}
      <div className="flex gap-2" style={{ marginBottom: "1.25rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
        {subjectData.map((sub, sIdx) => (
          <button
            key={sub.subject}
            className={`btn ${activeSubjectIdx === sIdx ? "btn-primary" : "btn-secondary"}`}
            onClick={() => { setActiveSubjectIdx(sIdx); setActiveSectionIdx(0); }}
            style={{ padding: "0.65rem 1.25rem", borderRadius: "12px", whiteSpace: "nowrap" }}
          >
            📚 {sub.subject}
          </button>
        ))}
      </div>

      {/* Section Navigation Tabs & Banner */}
      <div className="card glass" style={{ padding: "1.25rem", marginBottom: "1.75rem", background: "var(--surface)" }}>
        <div className="flex gap-3" style={{ marginBottom: "1rem" }}>
          {currentSubjectObj.sections.map((sec: any, secIdx: number) => {
            const isSecActive = activeSectionIdx === secIdx;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSectionIdx(secIdx)}
                className={`btn ${isSecActive ? "btn-primary" : "btn-secondary"}`}
                style={{ flex: 1, padding: "0.75rem", textAlign: "center", borderRadius: "10px", fontSize: "0.95rem", fontWeight: 600 }}
              >
                {sec.name}
              </button>
            );
          })}
        </div>

        {/* Section Instruction Box */}
        <div style={{ padding: "1rem", borderRadius: "8px", background: currentSection.isCompulsory ? "rgba(59,130,246,0.08)" : "rgba(245,158,11,0.08)", border: `1px solid ${currentSection.isCompulsory ? "rgba(59,130,246,0.25)" : "rgba(245,158,11,0.25)"}` }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: currentSection.isCompulsory ? "#3b82f6" : "#f59e0b", marginBottom: "0.25rem" }}>
            {currentSection.name}
          </div>
          <div style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>{currentSection.instructions}</div>
          {!currentSection.isCompulsory && (
            <div style={{ fontSize: "0.82rem", marginTop: "0.5rem", fontWeight: 600, color: "var(--text-secondary)" }}>
              Choice Progress: Selected {(selectedOptional[currentSection.id] || []).length} of {currentSection.requiredChoiceCount} required questions
            </div>
          )}
        </div>
      </div>

      {/* Questions List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {currentSection.questions.length === 0 ? (
          <div className="card glass text-center" style={{ padding: "2rem" }}>
            No theory questions available in this section.
          </div>
        ) : (
          currentSection.questions.map((q: any) => {
            const answerText = userAnswers[q.id] || "";
            const wordCount = answerText.trim() ? answerText.trim().split(/\s+/).length : 0;
            const isSelectedOptional = !currentSection.isCompulsory && (selectedOptional[currentSection.id] || []).includes(q.id);
            const isMathPreviewActive = mathPreview[q.id] || false;

            return (
              <div
                key={q.id}
                className="card glass"
                style={{
                  padding: "1.75rem",
                  borderRadius: "16px",
                  border: isSelectedOptional ? "2px solid var(--accent-color)" : "1px solid var(--border-color)",
                  background: isSelectedOptional ? "rgba(16,185,129,0.02)" : "var(--surface)",
                }}
              >
                {/* Question Header */}
                <div className="flex justify-between items-center" style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem" }}>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent-color)" }}>
                      Question {q.questionNumber}
                    </span>
                    <span style={{ fontSize: "0.8rem", padding: "0.15rem 0.6rem", borderRadius: "6px", background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}>
                      [{q.marks || 10} Marks]
                    </span>
                    {q.year > 0 && (
                      <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>({q.year})</span>
                    )}
                  </div>

                  {!currentSection.isCompulsory && (
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.88rem", fontWeight: 600, color: isSelectedOptional ? "#10b981" : "var(--text-secondary)" }}>
                      <input
                        type="checkbox"
                        checked={isSelectedOptional}
                        onChange={() => toggleOptionalQuestion(currentSection.id, q.id, currentSection.requiredChoiceCount)}
                        style={{ width: "1.1rem", height: "1.1rem", accentColor: "#10b981" }}
                      />
                      Select this question for Section B
                    </label>
                  )}
                </div>

                {/* Question Text */}
                <div
                  style={{ fontSize: "1.05rem", lineHeight: "1.6", marginBottom: "1.5rem", color: "var(--text-primary)" }}
                  dangerouslySetInnerHTML={{ __html: q.text }}
                />

                {/* Response Textarea Toolbar */}
                <div style={{ marginTop: "1rem" }}>
                  <div className="flex justify-between items-center" style={{ marginBottom: "0.5rem" }}>
                    <label style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-secondary)" }}>
                      Your Answer:
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: "0.2rem 0.6rem", fontSize: "0.78rem" }}
                        onClick={() => setMathPreview((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                      >
                        {isMathPreviewActive ? "✏️ Edit Mode" : "👁️ Math Preview"}
                      </button>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {wordCount} {wordCount === 1 ? "word" : "words"}
                      </span>
                    </div>
                  </div>

                  {isMathPreviewActive ? (
                    <div
                      style={{
                        minHeight: "140px",
                        padding: "1rem",
                        borderRadius: "10px",
                        background: "#0d1117",
                        border: "1px solid var(--border-color)",
                        fontSize: "1rem",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                      }}
                      dangerouslySetInnerHTML={{ __html: answerText ? renderMathInHtmlText(answerText) : "<em style='color:#666'>No answer entered yet. Switch to Edit Mode to type your answer.</em>" }}
                    />
                  ) : (
                    <textarea
                      rows={6}
                      className="input w-full"
                      placeholder="Write your comprehensive answer step-by-step here... You can use LaTeX math formatting like $E = mc^2$"
                      value={answerText}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      style={{
                        padding: "1rem",
                        borderRadius: "10px",
                        background: "var(--surface)",
                        fontSize: "0.98rem",
                        lineHeight: "1.55",
                        resize: "vertical",
                        fontFamily: "inherit",
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Submission Confirmation Modal */}
      {showSubmitModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
          <div className="card glass animate-fade-in text-center" style={{ maxWidth: "480px", padding: "2.5rem" }}>
            <h3 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Submit Theory Examination?</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
              Are you sure you want to complete and submit your theory paper? Once submitted, your written answers will be evaluated alongside the official marking scheme.
            </p>
            <div className="flex gap-3 justify-center">
              <button className="btn btn-secondary" style={{ padding: "0.75rem 1.5rem" }} onClick={() => setShowSubmitModal(false)}>
                Continue Exam
              </button>
              <button className="btn btn-primary" style={{ padding: "0.75rem 1.5rem", background: "#10b981", borderColor: "#10b981" }} onClick={handleSubmitExam}>
                Yes, Submit Paper
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function renderMathInHtmlText(text: string): string {
  if (!text) return "";
  return text.replace(/\n/g, "<br/>");
}

export default function TheoryTestPage() {
  return (
    <Suspense fallback={<div className="container" style={{ padding: "4rem", textAlign: "center" }}>Loading...</div>}>
      <TheoryTestContent />
    </Suspense>
  );
}
