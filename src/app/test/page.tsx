"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSession } from "next-auth/react";
import { cleanOptionPrefix, cleanQuestionText, renderMathInHtml } from "@/lib/sanitizer";


// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns a short display name for long subject names */
function shortSubjectName(name: string): string {
  const map: Record<string, string> = {
    "Mathematics": "Maths",
    "English Language": "English",
    "Further Mathematics": "Further Maths",
    "Christian Religious Knowledge (CRK)": "CRK",
    "Agricultural Science": "Agric Science",
    "Literature in English": "Literature",
    "Principles of Accounts": "Accounts",
    "Civic Education": "Civic Edu",
  };
  return map[name] || name;
}


// ─── Main Test Content ───────────────────────────────────────────────────────

function TestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const exam = searchParams.get("exam") || "";
  const subjectsParam = searchParams.get("subjects") || "";
  const year = searchParams.get("year") || "";
  const isStrict = searchParams.get("strict") === "true";

  const examUpper = exam.toUpperCase();
  const subjectList = subjectsParam
    ? subjectsParam.split(",").map((s: string) => s.trim()).filter(Boolean)
    : [];
  const subjectCount = Math.max(1, subjectList.length);
  const totalSeconds =
    examUpper === "JAMB"
      ? 120 * 60
      : examUpper === "WAEC" || examUpper === "NECO"
      ? subjectCount * 40 * 60
      : subjectCount * 30 * 60;

  // ── Core state ──────────────────────────────────────────────────────────
  /** All questions flat — used for scoring on submit */
  const [questions, setQuestions] = useState<any[]>([]);
  /** Questions grouped by subject name */
  const [questionsBySubject, setQuestionsBySubject] = useState<Record<string, any[]>>({});
  /** Currently active subject tab */
  const [currentSubject, setCurrentSubject] = useState<string>("");
  /** Saved position per subject so switching preserves position */
  const [subjectIndices, setSubjectIndices] = useState<Record<string, number>>({});
  /** Current question index within the active subject */
  const [currentIndex, setCurrentIndex] = useState(0);
  /** Answers keyed by question id */
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(totalSeconds);
  const [showCalculator, setShowCalculator] = useState(false);

  // ── Strict mode state ──────────────────────────────────────────────────
  const [strictStarted, setStrictStarted] = useState(!isStrict);
  const [warnings, setWarnings] = useState(0);

  // ── Calculator state ───────────────────────────────────────────────────
  const [calcFormula, setCalcFormula] = useState("");
  const [calcResult, setCalcResult] = useState("");
  const [calcIsDegree, setCalcIsDegree] = useState(true);
  const [calcShowFraction, setCalcShowFraction] = useState(false);
  const [calcPosition, setCalcPosition] = useState({ x: 100, y: 120 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // ── Draggable calculator ───────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.closest("button")) return;
    setIsDragging(true);
    setDragOffset({ x: e.clientX - calcPosition.x, y: e.clientY - calcPosition.y });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setCalcPosition({
        x: Math.max(0, Math.min(window.innerWidth - 340, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(window.innerHeight - 500, e.clientY - dragOffset.y)),
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // ── Calculator logic ───────────────────────────────────────────────────
  const decimalToFraction = (val: number): string => {
    if (isNaN(val) || !isFinite(val)) return "";
    const sign = val < 0 ? "-" : "";
    const absVal = Math.abs(val);
    if (Number.isInteger(absVal)) return val.toString();
    const tolerance = 1.0e-9;
    let h1 = 1, h2 = 0, k1 = 0, k2 = 1, b = absVal;
    do {
      const a = Math.floor(b);
      const aux = h1; h1 = a * h1 + h2; h2 = aux;
      const aux2 = k1; k1 = a * k1 + k2; k2 = aux2;
      b = 1 / (b - a);
    } while (Math.abs(absVal - h1 / k1) > absVal * tolerance);
    if (k1 > 1000) return val.toString();
    if (h1 > k1) {
      const whole = Math.floor(h1 / k1);
      const rem = h1 % k1;
      if (rem === 0) return `${sign}${whole}`;
      return `${sign}${whole} ${rem}/${k1}`;
    }
    return `${sign}${h1}/${k1}`;
  };

  const evaluateCalc = (expr: string) => {
    if (!expr) return "";
    try {
      let processed = expr;
      const fact = (n: number): number => {
        if (n < 0 || !Number.isInteger(n)) return NaN;
        if (n === 0 || n === 1) return 1;
        let res = 1;
        for (let i = 2; i <= n; i++) res *= i;
        return res;
      };
      const perm = (n: number, r: number): number => {
        if (n < 0 || r < 0 || r > n || !Number.isInteger(n) || !Number.isInteger(r)) return NaN;
        return fact(n) / fact(n - r);
      };
      const comb = (n: number, r: number): number => {
        if (n < 0 || r < 0 || r > n || !Number.isInteger(n) || !Number.isInteger(r)) return NaN;
        return fact(n) / (fact(r) * fact(n - r));
      };
      processed = processed.replace(/([0-9.]+)!/g, "fact($1)");
      processed = processed.replace(/([0-9.]+)P([0-9.]+)/g, "perm($1, $2)");
      processed = processed.replace(/([0-9.]+)C([0-9.]+)/g, "comb($1, $2)");
      processed = processed.replace(/³√/g, "cbrt");
      processed = processed.replace(/√/g, "sqrt");
      processed = processed.replace(/π/g, "Math.PI");
      processed = processed.replace(/\be\b/g, "Math.E");
      processed = processed.replace(/×/g, "*");
      processed = processed.replace(/÷/g, "/");
      processed = processed.replace(/\^/g, "**");
      let openCount = (processed.match(/\(/g) || []).length;
      let closeCount = (processed.match(/\)/g) || []).length;
      while (openCount > closeCount) { processed += ")"; closeCount++; }
      const context = {
        sin: (x: number) => calcIsDegree ? Math.sin(x * Math.PI / 180) : Math.sin(x),
        cos: (x: number) => calcIsDegree ? Math.cos(x * Math.PI / 180) : Math.cos(x),
        tan: (x: number) => calcIsDegree ? Math.tan(x * Math.PI / 180) : Math.tan(x),
        log: (x: number) => Math.log10(x),
        ln: (x: number) => Math.log(x),
        sqrt: (x: number) => Math.sqrt(x),
        cbrt: (x: number) => Math.cbrt(x),
        fact, perm, comb, Math,
      };
      const keys = Object.keys(context);
      const values = Object.values(context);
      const evaluator = new Function(...keys, `return ${processed}`);
      const result = evaluator(...values);
      if (typeof result !== "number" || isNaN(result)) return "Error";
      return Number.isInteger(result) ? result.toString() : (Math.round(result * 1e10) / 1e10).toString();
    } catch { return "Error"; }
  };

  const handleCalcBtnClick = (val: string) => {
    setCalcFormula(prev => {
      if (calcResult === "Error") setCalcResult("");
      if (["sin", "cos", "tan", "log", "ln", "√", "³√"].includes(val)) return prev + val + "(";
      return prev + val;
    });
  };
  const handleCalcDelete = () => {
    setCalcFormula(prev => {
      const fns = ["sin(", "cos(", "tan(", "log(", "ln(", "³√(", "√("];
      for (const fn of fns) { if (prev.endsWith(fn)) return prev.slice(0, -fn.length); }
      return prev.slice(0, -1);
    });
  };
  const handleCalcNegate = () => {
    setCalcFormula(prev => {
      if (!prev) return "-";
      if (prev.endsWith("-")) return prev.slice(0, -1);
      if (/[+\-*÷×/^]$/.test(prev)) return prev + "-";
      return prev + "-";
    });
  };
  const handleCalcEquals = () => setCalcResult(evaluateCalc(calcFormula));
  const getDisplayResult = () => {
  if (!calcResult || calcResult === "Error") return calcResult;
  const num = parseFloat(calcResult);
  if (isNaN(num)) return calcResult;
  let display = calcShowFraction ? decimalToFraction(num) : calcResult;
  // Unicode fraction slash
  display = display.replace(/\//g, "⁄");
  // Common simple fractions to proper unicode characters
  display = display.replace(/\b1\/2\b/g, "½");
  display = display.replace(/\b1\/4\b/g, "¼");
  display = display.replace(/\b3\/4\b/g, "¾");
  // Superscript units with caret
  display = display.replace(/(cm|mm|m|kg|g)\^2/g, "$1²");
  display = display.replace(/(cm|mm|m|kg|g)\^3/g, "$1³");
  // Units without caret (e.g., cm2, cm3)
  display = display.replace(/(cm|mm|m|kg|g)2\b/g, "$1²");
  display = display.replace(/(cm|mm|m|kg|g)3\b/g, "$1³");
  return display;
};

  // ── Fetch questions ────────────────────────────────────────────────────
  useEffect(() => {
    setTimeLeft(totalSeconds);
    async function fetchQuestions() {
      try {
        const query = new URLSearchParams();
        if (exam) query.set("examType", exam);
        if (subjectsParam) query.set("subject", subjectsParam);
        if (year) query.set("year", year);

        const res = await fetch(`/api/questions?${query.toString()}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Failed to fetch questions");

        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((q: any) => {
            const rawOptions: string[] = typeof q.options === "string" ? JSON.parse(q.options) : (q.options || []);
            return {
              id: q.id,
              text: renderMathInHtml(q.text || ""),
              type: q.type,
              subjectName: q.subject?.name || "General",
              options: rawOptions.map((opt: string) => renderMathInHtml(cleanOptionPrefix(opt))),
              correctAnswer: q.correctAnswer,
              explanation: renderMathInHtml(q.explanation || ""),
            };
          });

          // Group by subject, preserve up to 50 per subject (100 for English)
          const grouped: Record<string, any[]> = {};
          for (const q of mapped) {
            const sub = q.subjectName;
            if (!grouped[sub]) grouped[sub] = [];
            grouped[sub].push(q);
          }

          setQuestions(mapped);
          setQuestionsBySubject(grouped);
          // Start on the first subject in the list
          const firstSub = Object.keys(grouped)[0] || "";
          setCurrentSubject(firstSub);
          setCurrentIndex(0);
        } else {
          setError(`No questions found for ${exam} — ${subjectList.join(", ")}`);
        }
      } catch (e: any) {
        setError(e.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); submitTest(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam, subjectsParam, year]);



  // ── Strict mode: tab-switch detection ─────────────────────────────────
  useEffect(() => {
    if (!isStrict || !strictStarted) return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setWarnings(prev => {
          const n = prev + 1;
          if (n >= 3) { alert("Exam submitted automatically due to multiple tab-switching violations."); submitTest(); }
          else alert(`WARNING: Tab switch detected. Violation ${n} of 3. 3 violations = auto-submit.`);
          return n;
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStrict, strictStarted]);

  // ── Derived values ─────────────────────────────────────────────────────
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const allSubjects = Object.keys(questionsBySubject);
  const currentSubjectQuestions = questionsBySubject[currentSubject] || [];
  const currentQ = currentSubjectQuestions[currentIndex];

  const totalAnswered = Object.keys(answers).length;
  const totalQuestionsAll = questions.length;

  /** Count answered questions for a given subject */
  const countAnsweredForSubject = (sub: string) => {
    const qs = questionsBySubject[sub] || [];
    return qs.filter(q => answers[q.id] !== undefined).length;
  };

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleSelectOption = (optIndex: number) => {
    if (!currentQ) return;
    setAnswers(prev => ({ ...prev, [currentQ.id]: optIndex }));
  };

  const handleTextAnswer = (text: string) => {
    if (!currentQ) return;
    setAnswers(prev => ({ ...prev, [currentQ.id]: text }));
  };

  /** Switch to another subject, saving + restoring position */
  const switchSubject = (sub: string) => {
    if (sub === currentSubject) return;
    // Save current position for the outgoing subject
    setSubjectIndices(prev => ({ ...prev, [currentSubject]: currentIndex }));
    setCurrentSubject(sub);
    // Restore saved position for the incoming subject (or start at 0)
    setCurrentIndex(subjectIndices[sub] ?? 0);
  };

  const navigateTo = (idx: number) => {
    setCurrentIndex(Math.max(0, Math.min(currentSubjectQuestions.length - 1, idx)));
  };

  const startStrictMode = async () => {
    try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); }
    catch {}
    setStrictStarted(true);
  };

  const submitTest = async () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    let score = 0;
    questions.forEach(q => {
      if (q.type !== "Theory") {
        if (answers[q.id] === Number(q.correctAnswer)) score++;
      }
    });
    const timeTaken = totalSeconds - timeLeft;
    try {
      await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examType: exam,
          subjects: subjectsParam,
          score: score.toString(),
          total: questions.length.toString(),
          timeTaken: timeTaken.toString(),
        }),
      });
    } catch {}
    sessionStorage.setItem("last_exam_questions", JSON.stringify(questions));
    const q = new URLSearchParams();
    q.set("score", score.toString());
    q.set("total", questions.length.toString());
    q.set("answers", encodeURIComponent(JSON.stringify(answers)));
    router.push(`/result?${q.toString()}`);
  };

  // Clean question text of empty links/paragraphs
  const cleanQuestionText = (text: string): string => {
    if (!text) return "";
    return text
      .replace(/<a\b[^>]*>\s*<\/a>/gi, "")
      .replace(/<p>\s*<\/p>/gi, "")
      .trim();
  };

  // ── Strict mode gate ───────────────────────────────────────────────────
  if (isStrict && !strictStarted) {
    return (
      <div className="container flex flex-col items-center justify-center h-screen" style={{ textAlign: "center" }}>
        <div className="card glass animate-fade-in" style={{ maxWidth: "600px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🚨</div>
          <h1 style={{ fontSize: "2.5rem", color: "#ef4444", marginBottom: "1rem" }}>Strict Mode Enabled</h1>
          <p style={{ fontSize: "1.1rem", marginBottom: "2rem", color: "var(--text-secondary)" }}>
            You are about to enter a strict, full-screen examination environment.
            Leaving the exam window, switching tabs, or exiting full-screen will result in warnings.<br /><br />
            <strong>3 warnings = Automatic Submission.</strong>
          </p>
          <button
            className="btn btn-primary"
            style={{ padding: "1rem 3rem", fontSize: "1.2rem", backgroundColor: "#ef4444", border: "none", boxShadow: "0 4px 15px rgba(239,68,68,0.4)" }}
            onClick={startStrictMode}
          >
            I Understand, Begin Exam
          </button>
        </div>
      </div>
    );
  }

  // ── Loading / Error states ─────────────────────────────────────────────
  const questionAreaContent = () => {
    if (loading) {
      return (
        <div style={{ padding: "4rem", textAlign: "center", color: "var(--text-secondary)" }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⌛</div>
          Preparing your questions...
        </div>
      );
    }
    if (error || questions.length === 0) {
      return (
        <div style={{ padding: "4rem", textAlign: "center", color: "var(--text-secondary)" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1.5rem" }}>⚠️</div>
          <h3 style={{ color: "var(--text-primary)", marginBottom: "1rem" }}>Data Fetch Error</h3>
          <p style={{ maxWidth: "400px", margin: "0 auto 2rem" }}>
            {error || "No questions found for the selected criteria."}
          </p>
          <div className="flex gap-4 justify-center">
            <button className="btn btn-secondary" onClick={() => window.location.reload()}>Retry</button>
            <button className="btn btn-primary" onClick={() => router.push("/")}>Change Subjects</button>
          </div>
        </div>
      );
    }
    return null;
  };

  // ── Main render ────────────────────────────────────────────────────────
  return (
    <div className="container" style={{ padding: "2rem 1rem", display: "flex", gap: "2rem", minHeight: "100vh", flexDirection: "row", flexWrap: "wrap" }}>

      {/* ── Main Question Card ── */}
      <div className="card glass flex-col animate-fade-in" style={{ flex: "1 1 60%", display: "flex", position: "relative" }}>

        {/* Top bar: exam name + timer + calculator */}
        <div className="flex justify-between items-center" style={{ marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border-color)" }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--accent-color)" }}>{exam}</h2>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              {totalAnswered} / {totalQuestionsAll} answered across all subjects
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button className="btn btn-secondary" style={{ padding: "0.5rem 1rem" }} onClick={() => setShowCalculator(!showCalculator)}>
              🧮 Calculator
            </button>
            <div style={{ fontSize: "1.75rem", fontWeight: "bold", color: timeLeft < 300 ? "#ef4444" : "var(--text-primary)", letterSpacing: "1px" }}>
              {formatTime(timeLeft)}
            </div>
          </div>
        </div>

        {/* ── Subject Tab Switcher ── */}
        {!loading && allSubjects.length > 0 && (
          <div style={{
            display: "flex", gap: "0.5rem", flexWrap: "wrap",
            marginBottom: "1.5rem", paddingBottom: "1rem",
            borderBottom: "1px solid var(--border-color)"
          }}>
            {allSubjects.map(sub => {
              const isActive = sub === currentSubject;
              const answered = countAnsweredForSubject(sub);
              const total = (questionsBySubject[sub] || []).length;
              const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
              return (
                <button
                  key={sub}
                  onClick={() => switchSubject(sub)}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "999px",
                    border: isActive ? "2px solid var(--accent-color)" : "1.5px solid var(--border-color)",
                    background: isActive ? "var(--accent-glow)" : "transparent",
                    color: isActive ? "var(--accent-color)" : "var(--text-secondary)",
                    fontWeight: isActive ? 700 : 500,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  {shortSubjectName(sub)}
                  <span style={{
                    fontSize: "0.72rem",
                    padding: "0.1rem 0.45rem",
                    borderRadius: "999px",
                    background: answered === total && total > 0 ? "#10b981" : isActive ? "var(--accent-color)" : "var(--border-color)",
                    color: answered === total && total > 0 ? "white" : isActive ? "white" : "var(--text-secondary)",
                    fontWeight: 700,
                    minWidth: "2rem",
                    textAlign: "center",
                  }}>
                    {answered}/{total}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Question Area ── */}
        <div style={{ flex: 1 }} id="question-container">
          {questionAreaContent() || (
            <>
              <h3 style={{ marginBottom: "1rem", fontSize: "1rem", color: "var(--text-secondary)" }}>
                {shortSubjectName(currentSubject)} — Question {currentIndex + 1} of {currentSubjectQuestions.length}
              </h3>

              <div
                style={{ fontSize: "1.3rem", marginBottom: "2.5rem", lineHeight: "1.6", fontWeight: "500" }}
                dangerouslySetInnerHTML={{ __html: currentQ?.text || "" }}
              />

              {currentQ?.type === "Theory" ? (
                <div className="flex-col gap-4 animate-fade-in">
                  <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--text-primary)" }}>Your Answer:</label>
                  <textarea
                    className="input"
                    style={{ minHeight: "200px", fontSize: "1.15rem" }}
                    placeholder="Type your theory response here..."
                    value={answers[currentQ.id] || ""}
                    onChange={e => handleTextAnswer(e.target.value)}
                  />
                </div>
              ) : (
                <div className="flex-col gap-4 animate-fade-in">
                  {currentQ?.options?.map((opt: string, idx: number) => {
                    const letters = ["A", "B", "C", "D", "E"];
                    const isSelected = answers[currentQ.id] === idx;
                    return (
                      <label
                        key={idx}
                        style={{
                          display: "flex", alignItems: "center", gap: "1rem",
                          padding: "1.25rem", borderRadius: "12px",
                          border: `2px solid ${isSelected ? "var(--accent-color)" : "var(--border-color)"}`,
                          backgroundColor: isSelected ? "var(--accent-glow)" : "var(--surface)",
                          cursor: "pointer", transition: "all 0.2s", fontSize: "1.15rem",
                        }}
                      >
                        <input
                          type="radio"
                          name={`q-${currentQ.id}`}
                          checked={isSelected}
                          onChange={() => handleSelectOption(idx)}
                          style={{ width: "1.2rem", height: "1.2rem", accentColor: "var(--accent-color)", cursor: "pointer" }}
                        />
                        <span style={{ fontWeight: "bold", width: "2rem", color: isSelected ? "var(--accent-color)" : "var(--text-secondary)" }}>
                          {letters[idx]}.
                        </span>
                        <span dangerouslySetInnerHTML={{ __html: opt }} />
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between items-center" style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border-color)" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => navigateTo(currentIndex - 1)}
                  disabled={currentIndex === 0}
                >
                  ← Previous
                </button>

                {/* Jump to next unanswered in this subject */}
                {currentSubjectQuestions.some(q => answers[q.id] === undefined) && (
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
                    onClick={() => {
                      const nextUnanswered = currentSubjectQuestions.findIndex(
                        (q, i) => i > currentIndex && answers[q.id] === undefined
                      );
                      if (nextUnanswered !== -1) navigateTo(nextUnanswered);
                      else {
                        const first = currentSubjectQuestions.findIndex(q => answers[q.id] === undefined);
                        if (first !== -1) navigateTo(first);
                      }
                    }}
                  >
                    Skip to Unanswered
                  </button>
                )}

                <button
                  className="btn btn-primary"
                  onClick={() => navigateTo(currentIndex + 1)}
                  disabled={currentIndex === currentSubjectQuestions.length - 1}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Sidebar ── */}
      <div className="card glass flex-col animate-fade-in" style={{ flex: "1 1 260px", maxWidth: "320px", minWidth: "260px", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* Subject progress overview */}
        {!loading && allSubjects.length > 0 && (
          <div>
            <h3 style={{ marginBottom: "1rem", fontSize: "1rem" }}>Subject Progress</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {allSubjects.map(sub => {
                const answered = countAnsweredForSubject(sub);
                const total = (questionsBySubject[sub] || []).length;
                const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
                const isActive = sub === currentSubject;
                return (
                  <button
                    key={sub}
                    onClick={() => switchSubject(sub)}
                    style={{
                      display: "flex", flexDirection: "column", gap: "0.3rem",
                      padding: "0.65rem 0.85rem", borderRadius: "10px", cursor: "pointer",
                      border: isActive ? "2px solid var(--accent-color)" : "1.5px solid var(--border-color)",
                      background: isActive ? "var(--accent-glow)" : "transparent",
                      textAlign: "left", transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.9rem", color: isActive ? "var(--accent-color)" : "var(--text-primary)" }}>
                        {shortSubjectName(sub)}
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{answered}/{total}</span>
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: "4px", borderRadius: "2px", background: "var(--border-color)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: "2px",
                        width: `${pct}%`,
                        background: pct === 100 ? "#10b981" : isActive ? "var(--accent-color)" : "#64748b",
                        transition: "width 0.3s ease",
                      }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Question palette for current subject */}
        {!loading && currentSubjectQuestions.length > 0 && (
          <div style={{ flex: 1 }}>
            <h3 style={{ marginBottom: "0.75rem", fontSize: "1rem" }}>
              {shortSubjectName(currentSubject)} — Question Map
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(42px, 1fr))", gap: "0.6rem" }}>
              {currentSubjectQuestions.map((q, idx) => {
                const isAnswered = answers[q.id] !== undefined;
                const isCurrent = idx === currentIndex;
                let bg = "var(--surface)";
                let color = "var(--text-primary)";
                let border = "1px solid var(--border-color)";
                if (isAnswered) { bg = "var(--accent-color)"; color = "white"; border = "1px solid var(--accent-color)"; }
                if (isCurrent) { border = "2px solid var(--text-primary)"; if (!isAnswered) bg = "var(--border-color)"; }
                return (
                  <button
                    key={q.id}
                    onClick={() => navigateTo(idx)}
                    style={{
                      height: "42px", borderRadius: "8px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: bg, color, border,
                      fontWeight: "bold", cursor: "pointer", transition: "all 0.2s", fontSize: "0.9rem",
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Submit */}
        {!loading && questions.length > 0 && (
          <div>
            <div style={{
              padding: "0.75rem", marginBottom: "0.75rem", borderRadius: "8px",
              background: totalAnswered === totalQuestionsAll
                ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
              border: `1px solid ${totalAnswered === totalQuestionsAll ? "#10b981" : "#f59e0b"}`,
              fontSize: "0.85rem", textAlign: "center",
              color: totalAnswered === totalQuestionsAll ? "#10b981" : "#f59e0b",
            }}>
              {totalAnswered === totalQuestionsAll
                ? "✅ All questions answered!"
                : `⚠️ ${totalQuestionsAll - totalAnswered} question${totalQuestionsAll - totalAnswered !== 1 ? "s" : ""} unanswered`}
            </div>
            <button
              onClick={submitTest}
              className="btn w-full shadow-lg"
              style={{ backgroundColor: "#10b981", color: "white", padding: "1rem", fontSize: "1.1rem" }}
            >
              Submit Exam
            </button>
          </div>
        )}
      </div>

      {/* ── Scientific Calculator Modal ── */}
      {showCalculator && (
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: "fixed",
            top: `${calcPosition.y}px`,
            left: `${calcPosition.x}px`,
            width: "320px",
            background: "rgba(15, 23, 42, 0.95)",
            backdropFilter: "blur(20px)",
            padding: "1.25rem",
            borderRadius: "16px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            zIndex: 1000,
            userSelect: "none",
            cursor: isDragging ? "grabbing" : "grab",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "0.5rem" }}>
            <h4 style={{ margin: 0, fontSize: "0.9rem", color: "#94a3b8", fontWeight: 600 }}>🧮 Tyce Scientific Calculator</h4>
            <button onClick={() => setShowCalculator(false)} style={{ background: "none", border: "none", color: "#ef4444", fontSize: "1.2rem", cursor: "pointer" }}>×</button>
          </div>

          {/* Display */}
          <div style={{ background: "#040711", border: "1px solid rgba(255,255,255,0.05)", padding: "0.75rem", borderRadius: "8px", textAlign: "right", marginBottom: "1rem", fontFamily: "monospace", minHeight: "75px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ color: "#64748b", fontSize: "0.9rem", wordBreak: "break-all", minHeight: "1.2rem" }}>{calcFormula || "0"}</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.2rem", borderTop: "1px solid rgba(255,255,255,0.02)", paddingTop: "0.2rem" }}>
              <span style={{ fontSize: "0.65rem", color: "#10b981", fontWeight: "bold" }}>{calcIsDegree ? "DEG" : "RAD"} {calcShowFraction ? "• FRAC" : ""}</span>
              <div style={{ color: "#10b981", fontSize: "1.4rem", fontWeight: "bold", textShadow: "0 0 8px rgba(16,185,129,0.3)" }}>{getDisplayResult() || "0"}</div>
            </div>
          </div>

          {/* Keypad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "0.4rem" }}>
            <button onClick={() => setCalcIsDegree(!calcIsDegree)} style={{ gridColumn: "span 2", padding: "0.5rem", background: "#334155", color: "#f8fafc", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>DEG/RAD</button>
            <button onClick={() => setCalcShowFraction(!calcShowFraction)} style={{ gridColumn: "span 2", padding: "0.5rem", background: "#334155", color: "#f8fafc", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>F↔D</button>
            <button onClick={handleCalcDelete} style={{ padding: "0.5rem", background: "#991b1b", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>DEL</button>
            <button onClick={() => { setCalcFormula(""); setCalcResult(""); }} style={{ padding: "0.5rem", background: "#b91c1c", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>AC</button>

            <button onClick={() => handleCalcBtnClick("sin")} style={{ padding: "0.5rem", background: "#1e293b", color: "#a5b4fc", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>sin</button>
            <button onClick={() => handleCalcBtnClick("cos")} style={{ padding: "0.5rem", background: "#1e293b", color: "#a5b4fc", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>cos</button>
            <button onClick={() => handleCalcBtnClick("tan")} style={{ padding: "0.5rem", background: "#1e293b", color: "#a5b4fc", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>tan</button>
            <button onClick={() => handleCalcBtnClick("log")} style={{ padding: "0.5rem", background: "#1e293b", color: "#fcd34d", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>log</button>
            <button onClick={() => handleCalcBtnClick("ln")} style={{ padding: "0.5rem", background: "#1e293b", color: "#fcd34d", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>ln</button>
            <button onClick={() => handleCalcBtnClick("÷")} style={{ padding: "0.5rem", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "bold" }}>÷</button>

            <button onClick={() => handleCalcBtnClick("√")} style={{ padding: "0.5rem", background: "#1e293b", color: "#38bdf8", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>√</button>
            <button onClick={() => handleCalcBtnClick("³√")} style={{ padding: "0.5rem", background: "#1e293b", color: "#38bdf8", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>³√</button>
            <button onClick={() => handleCalcBtnClick("^")} style={{ padding: "0.5rem", background: "#1e293b", color: "#38bdf8", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>xʸ</button>
            <button onClick={() => handleCalcBtnClick("^2")} style={{ padding: "0.5rem", background: "#1e293b", color: "#38bdf8", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>x²</button>
            <button onClick={() => handleCalcBtnClick("π")} style={{ padding: "0.5rem", background: "#1e293b", color: "#cbd5e1", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>π</button>
            <button onClick={() => handleCalcBtnClick("×")} style={{ padding: "0.5rem", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "bold" }}>×</button>

            <button onClick={() => handleCalcBtnClick("P")} style={{ padding: "0.5rem", background: "#1e293b", color: "#c084fc", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }} title="Permutation (nPr)">nPr</button>
            <button onClick={() => handleCalcBtnClick("C")} style={{ padding: "0.5rem", background: "#1e293b", color: "#c084fc", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }} title="Combination (nCr)">nCr</button>
            <button onClick={() => handleCalcBtnClick("10^")} style={{ padding: "0.5rem", background: "#1e293b", color: "#fb7185", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>10ˣ</button>
            <button onClick={() => handleCalcBtnClick("e^")} style={{ padding: "0.5rem", background: "#1e293b", color: "#fb7185", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>eˣ</button>
            <button onClick={() => handleCalcBtnClick("!")} style={{ padding: "0.5rem", background: "#1e293b", color: "#f43f5e", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}>x!</button>
            <button onClick={() => handleCalcBtnClick("-")} style={{ padding: "0.5rem", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "bold" }}>-</button>

            <button onClick={() => handleCalcBtnClick("7")} style={{ padding: "0.6rem", background: "#0f172a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold" }}>7</button>
            <button onClick={() => handleCalcBtnClick("8")} style={{ padding: "0.6rem", background: "#0f172a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold" }}>8</button>
            <button onClick={() => handleCalcBtnClick("9")} style={{ padding: "0.6rem", background: "#0f172a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold" }}>9</button>
            <button onClick={() => handleCalcBtnClick("(")} style={{ padding: "0.6rem", background: "#1e293b", color: "#94a3b8", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "bold" }}>(</button>
            <button onClick={() => handleCalcBtnClick(")")} style={{ padding: "0.6rem", background: "#1e293b", color: "#94a3b8", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "bold" }}>)</button>
            <button onClick={() => handleCalcBtnClick("+")} style={{ padding: "0.6rem", background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold" }}>+</button>

            <button onClick={() => handleCalcBtnClick("4")} style={{ padding: "0.6rem", background: "#0f172a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold" }}>4</button>
            <button onClick={() => handleCalcBtnClick("5")} style={{ padding: "0.6rem", background: "#0f172a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold" }}>5</button>
            <button onClick={() => handleCalcBtnClick("6")} style={{ padding: "0.6rem", background: "#0f172a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold" }}>6</button>
            <button onClick={() => handleCalcBtnClick("1")} style={{ padding: "0.6rem", background: "#0f172a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold" }}>1</button>
            <button onClick={() => handleCalcBtnClick("2")} style={{ padding: "0.6rem", background: "#0f172a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold" }}>2</button>
            <button onClick={() => handleCalcBtnClick("3")} style={{ padding: "0.6rem", background: "#0f172a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold" }}>3</button>

            <button onClick={() => handleCalcBtnClick("0")} style={{ padding: "0.6rem", background: "#0f172a", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold" }}>0</button>
            <button onClick={() => handleCalcBtnClick(".")} style={{ padding: "0.6rem", background: "#1e293b", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold" }}>.</button>
            <button onClick={handleCalcNegate} style={{ padding: "0.6rem", background: "#1e293b", color: "#cbd5e1", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "bold" }}>+/-</button>
            <button onClick={handleCalcEquals} style={{ gridColumn: "span 3", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "1.25rem", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", padding: "0.6rem" }}>=</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Auth Wrapper ─────────────────────────────────────────────────────────────

export default function TestInterface() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN") {
      alert("Admins and Super Admins cannot take practice tests.");
      router.replace("/admin");
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <div className="container" style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", color: "var(--text-secondary)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem", animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite" }}>🎓</div>
          <p style={{ fontSize: "1.2rem", fontWeight: 500 }}>Verifying your session...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated" || !session) return null;

  return (
    <Suspense fallback={<div className="container" style={{ padding: "2rem", textAlign: "center" }}>Loading exam interface...</div>}>
      <TestContent />
    </Suspense>
  );
}
