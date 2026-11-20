"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { renderMath } from "@/lib/sanitizer";

export default function EditQuestion() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [form, setForm] = useState({
    text: "",
    type: "Objective",
    year: "2024",
    options: ["", "", "", ""],
    correctAnswer: "0",
    explanation: "",
    examType: "JAMB",
    subject: "Mathematics",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
    if (session && session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }
    
    if (id) {
       fetchQuestion();
    }
  }, [status, session, router, id]);

  // Math & LaTeX Preview effect
  useEffect(() => {
    let attempts = 0;
    const trigger = () => renderMath("preview-container");
    trigger();
    const interval = setInterval(() => {
      attempts++;
      trigger();
      if (attempts >= 10) clearInterval(interval);
    }, 120);
    return () => clearInterval(interval);
  }, [form.text, form.options]);

  const cleanTextData = (text: string) => {
    let clean = text || "";
    
    // 0. Convert subscripts and superscripts to MathJax BEFORE stripping tags
    clean = clean.replace(/<sub\b[^>]*>(.*?)<\/sub>/gi, "\\(_{$1}\\)");
    clean = clean.replace(/<sup\b[^>]*>(.*?)<\/sup>/gi, "\\(^{$1}\\)");

    // 1. Replace block-level tags with line breaks for readability
    clean = clean.replace(/<(p|div|tr|li|br|hr|h[1-6])\b[^>]*>/gi, "\n");
    
    // 2. Add spaces for table cells to keep data separable
    clean = clean.replace(/<(td|th)\b[^>]*>/gi, "  ");
    
    // 3. Strip ALL remaining HTML tags
    clean = clean.replace(/<[^>]*>/g, "");
    
    // 4. Handle multiple line breaks and trim
    clean = clean.replace(/\n\s*\n/g, "\n\n");
    
    return clean.trim();
  }
 
  const cleanOptionsArray = (options: string[]) => {
    return options.map(opt => {
      let clean = opt || "";
      
      // 0. Convert sub/sup to MathJax
      clean = clean.replace(/<sub\b[^>]*>(.*?)<\/sub>/gi, "\\(_{$1}\\)");
      clean = clean.replace(/<sup\b[^>]*>(.*?)<\/sup>/gi, "\\(^{$1}\\)");

      // 1. Strip all other tags
      clean = clean.replace(/<[^>]*>/g, "");
      
      // 2. Aggressively remove leading [A-E][. or )] markers
      // Use a loop to remove multiple prefixes (e.g. "A.  B.  Text")
      let last = "";
      while (clean !== last) {
        last = clean;
        clean = clean.replace(/^\s*[A-E]\s*[\.\)]\s*/gi, ""); // Strip letters
        clean = clean.trim();
      }
      
      // 3. Remove leading text labels like "Option A:"
      clean = clean.replace(/^\s*Option\s*[A-E]\s*:?\s*/gi, "");
      
      return clean.trim();
    });
  }

  const cleanContent = () => {
    setForm(prev => ({
      ...prev,
      text: cleanTextData(prev.text),
      options: cleanOptionsArray(prev.options)
    }));
    setMessage("✨ Content cleaned!");
  };

  const fetchQuestion = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/questions/${id}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" }});
      if (res.ok) {
        const q = await res.json();
        
        const rawOptions = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        
        // Auto-clean on load
        setForm({
          text: cleanTextData(q.text),
          type: q.type,
          year: q.year.toString(),
          options: cleanOptionsArray(rawOptions),
          correctAnswer: q.correctAnswer,
          explanation: cleanTextData(q.explanation || ""),
          examType: q.examType.name,
          subject: q.subject.name,
        });
      } else {
        setMessage("❌ Question not found.");
      }
    } catch (e) {
      setMessage("❌ Failed to fetch question details.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch(`/api/admin/questions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setMessage("✅ Question updated successfully!");
        // Optional: redirect back after a short delay
        setTimeout(() => router.push('/admin/questions'), 1500);
      } else {
        const err = await res.json();
        setMessage("❌ Error: " + err.error);
      }
    } catch (e) {
      setMessage("❌ Failed to connect to server.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !message) {
    return <div className="container" style={{ padding: '4rem', textAlign: 'center' }}>Loading question data...</div>;
  }

  if (!loading && message && message.startsWith("❌") && !message.includes("update")) {
    return <div className="container" style={{ padding: '4rem', textAlign: 'center', color: '#ef4444' }}>{message}</div>;
  }

  return (
    <main className="container" style={{ padding: '2rem 1rem' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--accent-color)' }}>Edit Question</h1>
        <button className="btn btn-secondary" onClick={() => router.push('/admin/questions')}>Back to List</button>
      </div>

      <div className="card glass animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
             <div>
               <label className="label">Exam Type</label>
               <select 
                 className="input" 
                 style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'inherit' }}
                 value={form.examType} 
                 onChange={e => setForm({...form, examType: e.target.value})}
               >
                 {["JAMB", "WAEC", "NECO", "IGCSE"].map(et => <option key={et}>{et}</option>)}
               </select>
             </div>
             <div>
               <label className="label">Subject</label>
               <input 
                 className="input" 
                 style={{ width: '100%', boxSizing: 'border-box' }}
                 value={form.subject} 
                 onChange={e => setForm({...form, subject: e.target.value})}
                 placeholder="e.g. Mathematics"
               />
             </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label className="label" style={{ marginBottom: 0 }}>Question Text (HTML allowed)</label>
              <button 
                type="button" 
                onClick={cleanContent}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
              >
                🪄 Clean HTML & Labels
              </button>
            </div>
            <textarea 
               className="input" 
               style={{ width: '100%', minHeight: '120px', padding: '1rem', boxSizing: 'border-box' }}
               value={form.text}
               onChange={e => setForm({...form, text: e.target.value})}
               required
               placeholder="Enter the question text here..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
             <div>
               <label className="label">Question Type</label>
               <select 
                 className="input" 
                 style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'inherit' }}
                 value={form.type} 
                 onChange={e => setForm({...form, type: e.target.value})}
               >
                 <option>Objective</option>
                 <option>Theory</option>
               </select>
             </div>
             <div>
               <label className="label">Year</label>
               <input 
                 className="input" 
                 type="number"
                 style={{ width: '100%', boxSizing: 'border-box' }}
                 value={form.year} 
                 onChange={e => setForm({...form, year: e.target.value})}
               />
             </div>
          </div>

          <h3 style={{ marginBottom: '1rem' }}>Options</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem', marginBottom: '2rem' }}>
             {form.options.map((opt, idx) => (
               <div key={idx} style={{ 
                 display: 'flex', 
                 alignItems: 'center', 
                 gap: '1rem', 
                 padding: '1rem', 
                 background: 'rgba(255,255,255,0.03)', 
                 borderRadius: '12px',
                 border: `1px solid ${form.correctAnswer === idx.toString() ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-color)'}`,
                 transition: 'all 0.3s ease'
               }}>
                 <div style={{ 
                   fontWeight: 'bold', 
                   fontSize: '1.2rem', 
                   color: 'var(--accent-color)', 
                   minWidth: '1.5rem', 
                   textAlign: 'center' 
                 }}>
                   {String.fromCharCode(65 + idx)}
                 </div>
                 <input 
                   className="input" 
                   style={{ flex: 1, padding: '0.85rem', fontSize: '1rem', border: 'none', background: 'transparent' }}
                   value={opt}
                   onChange={e => {
                     const newOpts = [...form.options];
                     newOpts[idx] = e.target.value;
                     setForm({...form, options: newOpts});
                   }}
                   placeholder={`Enter Option ${String.fromCharCode(65 + idx)}...`}
                   required
                 />
                 <label style={{ 
                   display: 'flex', 
                   alignItems: 'center', 
                   gap: '0.5rem', 
                   fontSize: '0.85rem', 
                   fontWeight: 600,
                   cursor: 'pointer',
                   padding: '0.6rem 1rem',
                   borderRadius: '10px',
                   backgroundColor: form.correctAnswer === idx.toString() ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                   color: form.correctAnswer === idx.toString() ? '#10b981' : 'var(--text-secondary)',
                   border: `1px solid ${form.correctAnswer === idx.toString() ? '#10b981' : 'transparent'}`,
                   transition: 'all 0.2s'
                 }}>
                   <input 
                     type="radio" 
                     name="correctAnswer" 
                     style={{ cursor: 'pointer', width: '1.1rem', height: '1.1rem' }}
                     checked={form.correctAnswer === idx.toString()} 
                     onChange={() => setForm({...form, correctAnswer: idx.toString()})}
                   />
                   Correct
                 </label>
               </div>
             ))}
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label className="label">Explanation (Optional)</label>
            <textarea 
               className="input" 
               style={{ width: '100%', minHeight: '80px', padding: '1rem', boxSizing: 'border-box' }}
               value={form.explanation}
               onChange={e => setForm({...form, explanation: e.target.value})}
               placeholder="Explain the correct answer..."
            />
          </div>

          {message && (
             <div style={{ 
               padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem',
               backgroundColor: message.startsWith('✅') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
               color: message.startsWith('✅') ? '#10b981' : '#ef4444',
               border: `1px solid ${message.startsWith('✅') ? '#10b981' : '#ef4444'}`
             }}>
               {message}
             </div>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '1rem' }} disabled={saving}>
              {saving ? "Updating..." : "Update Question"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => router.push('/admin/questions')}>
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* Preview Section */}
      <div className="card glass animate-fade-in" style={{ maxWidth: '800px', margin: '2rem auto 4rem' }}>
        <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent-color)' }}>👀 Question Preview</h3>
        <div id="preview-container" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
           <div style={{ marginBottom: '1.5rem', fontSize: '1.1rem', lineHeight: '1.6' }}>
             {/* Rendered Question Body */}
             <div dangerouslySetInnerHTML={{ __html: form.text.replace(/\n/g, '<br/>') }} />
           </div>

           <div style={{ display: 'grid', gap: '0.75rem' }}>
             {form.options.map((opt, idx) => (
               <div key={idx} style={{ 
                 padding: '0.75rem 1rem', 
                 borderRadius: '8px', 
                 background: form.correctAnswer === idx.toString() ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                 border: `1px solid ${form.correctAnswer === idx.toString() ? '#10b981' : 'transparent'}`,
                 display: 'flex',
                 alignItems: 'baseline',
                 gap: '0.75rem'
               }}>
                 <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{String.fromCharCode(65 + idx)}.</span>
                 <div dangerouslySetInnerHTML={{ __html: opt }} />
               </div>
             ))}
           </div>
        </div>
        <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
          💡 Scientific formulas like <code>\(H_2O\)</code> will render properly above.
        </p>
      </div>
    </main>
  );
}
