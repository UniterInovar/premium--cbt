"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { MOCK_QUESTIONS } from "@/lib/mockData";
import { useEffect, useState } from "react";
import { Suspense } from "react";
import { cleanOptionPrefix, renderMathInHtml } from "@/lib/sanitizer";

function ResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const score = searchParams.get("score") || "0";
  const total = searchParams.get("total") || "0";
  const answersParam = searchParams.get("answers");
  
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [questions, setQuestions] = useState<any[]>(MOCK_QUESTIONS);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    if (answersParam) {
      try {
        setAnswers(JSON.parse(decodeURIComponent(answersParam)));
      } catch (e) {
        console.error(e);
      }
    }
    
    const savedQuestions = sessionStorage.getItem("last_exam_questions");
    if (savedQuestions) {
      try {
        const raw = JSON.parse(savedQuestions);
        // Pre-render math in all text fields once — React re-renders will never revert
        const processed = raw.map((q: any) => {
          const opts: string[] = Array.isArray(q.options) ? q.options : [];
          return {
            ...q,
            text: renderMathInHtml(q.text || ""),
            options: opts.map((opt: string) => renderMathInHtml(cleanOptionPrefix(opt))),
            explanation: renderMathInHtml(q.explanation || ""),
          };
        });
        setQuestions(processed);
      } catch (e) {
        console.error(e);
      }
    }
  }, [answersParam]);

  const totalQuestions = parseInt(total) || questions.length;
  const scoreNum = parseInt(score) || 0;
  const percentage = Math.round((scoreNum / Math.max(1, totalQuestions)) * 100) || 0;

  if (!mounted) {

    return <div className="container" style={{ padding: '3rem', textAlign: 'center' }}>Loading results...</div>;
  }

  return (
    <div className="container" style={{ padding: '3rem 1rem' }}>
      <div className="card glass animate-fade-in no-print" style={{ textAlign: 'center', marginBottom: '3rem', padding: '3rem 1.5rem' }}>
        <h1 style={{ color: 'var(--text-primary)', marginBottom: '1rem', fontSize: '2.5rem' }}>Exam Completed!</h1>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'normal', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Your Score: <span style={{ fontSize: '3.5rem', fontWeight: 'bold', color: percentage >= 50 ? '#10b981' : '#ef4444', display: 'block', margin: '0.5rem 0' }}>{score} <span style={{fontSize: '1.5rem', color: 'var(--text-secondary)'}}>/ {totalQuestions}</span></span>
        </h2>
        
        <div style={{ display: 'inline-block', padding: '0.5rem 1.5rem', borderRadius: '999px', backgroundColor: percentage >= 50 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: percentage >= 50 ? '#10b981' : '#ef4444', fontWeight: 'bold', marginBottom: '2rem' }}>
          {percentage}% Performance
        </div>
        
        <br/>
        <div className="flex gap-4 justify-center">
          <button className="btn btn-secondary shadow-lg" style={{ fontSize: '1.2rem', padding: '1rem 2rem' }} onClick={() => window.print()}>
            📠 Print Report
          </button>
          <button className="btn btn-primary shadow-lg" style={{ fontSize: '1.2rem', padding: '1rem 2rem' }} onClick={() => router.push('/')}>
            Take Another Test
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center" style={{ marginBottom: '2rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Detailed Review & Corrections</h2>
        <div className="print-only" style={{ display: 'none', fontWeight: 'bold' }}>Official Performance Report</div>
      </div>
      
      <div className="flex-col gap-8" id="result-review-container">
        {questions.map((q, idx) => {
          const userAnswer = answers[q.id];
          const isTheory = q.type === 'Theory';
          const skipped = userAnswer === undefined || userAnswer === "";
          
          let cardBorder = '#border-color';
          let headerBadge = null;
          
          if (isTheory) {
            cardBorder = '#3b82f6';
            headerBadge = <div style={{ fontWeight: 'bold', padding: '0.25rem 0.75rem', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>Self-Review</div>;
          } else {
            const isCorrect = userAnswer === q.correctAnswer || Number(userAnswer) === Number(q.correctAnswer);
            cardBorder = isCorrect ? '#10b981' : (skipped ? '#f59e0b' : '#ef4444');
            headerBadge = <div style={{ fontWeight: 'bold', padding: '0.25rem 0.75rem', borderRadius: '4px', backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.1)' : (skipped ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)'), color: isCorrect ? '#10b981' : (skipped ? '#f59e0b' : '#ef4444') }}>
              {isCorrect ? 'Correct' : (skipped ? 'Skipped' : 'Incorrect')}
            </div>;
          }

          return (
            <div key={q.id} className="card glass animate-fade-in" style={{ borderLeft: `6px solid ${cardBorder}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Question {idx + 1}</h4>
                {headerBadge}
              </div>

              <div 
                style={{ fontSize: '1.3rem', marginBottom: '1.5rem', fontWeight: '500' }}
                dangerouslySetInnerHTML={{ __html: q.text }} 
              />
              
              {isTheory ? (
                <>
                  <div style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                     <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Your Answer:</strong>
                     <div style={{ fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}>{userAnswer || <span style={{ color: 'var(--text-secondary)' }}>No answer provided.</span>}</div>
                  </div>
                  <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-color)', borderRadius: '8px', borderLeft: '4px solid var(--accent-color)' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-color)', fontSize: '1.1rem' }}>
                      Official Assessment Rubric:
                    </h5>
                    {q.explanation ? (
                      <div 
                        style={{ margin: 0, fontSize: '1.1rem', lineHeight: '1.6' }} 
                        dangerouslySetInnerHTML={{ __html: q.explanation }} 
                      />
                    ) : (
                      <p style={{ margin: 0, fontSize: '1.1rem' }}>No official rubric provided for this theory question.</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex-col gap-3" style={{ marginBottom: '2rem' }}>
                    {Array.isArray(q.options) && q.options.map((opt: string, oIdx: number) => {
                      const isUserPick = Number(userAnswer) === oIdx;
                      const isActualCorrect = Number(q.correctAnswer) === oIdx;
                      
                      let bg = 'var(--surface)';
                      let border = '1px solid var(--border-color)';
                      let icon = '';

                      if (isActualCorrect) {
                         bg = 'rgba(16, 185, 129, 0.08)';
                         border = '2px solid #10b981';
                         icon = '✅';
                      } else if (isUserPick && !isActualCorrect) {
                         bg = 'rgba(239, 68, 68, 0.05)';
                         border = '2px solid #ef4444';
                         icon = '❌';
                      }

                      return (
                        <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', borderRadius: '8px', background: bg, border, fontSize: '1.1rem' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>{['A','B','C','D','E'][oIdx]}.</span>
                          <span dangerouslySetInnerHTML={{ __html: opt }} />
                          <span style={{ marginLeft: 'auto', fontSize: '1.2rem' }}>{icon}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-color)', borderRadius: '8px', borderLeft: '4px solid var(--accent-color)' }}>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-color)', fontSize: '1.1rem' }}>
                      Explanation:
                    </h5>
                    <div style={{ marginBottom: '0.75rem', fontWeight: 'bold', color: '#10b981', fontSize: '1.1rem' }}>
                      Correct Answer: Option {['A','B','C','D','E'][Number(q.correctAnswer)]}
                    </div>
                    {q.explanation ? (
                      <div 
                        style={{ margin: 0, fontSize: '1.1rem', lineHeight: '1.6' }} 
                        dangerouslySetInnerHTML={{ __html: q.explanation }} 
                      />
                    ) : (
                      <p style={{ margin: 0, fontSize: '1.1rem' }}>No explanation provided for this question.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ResultScreen() {
  return (
    <Suspense fallback={<div className="container" style={{padding:'3rem', textAlign:'center'}}>Loading results...</div>}>
      <ResultContent />
    </Suspense>
  );
}
