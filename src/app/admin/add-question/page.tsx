"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AddQuestion() {
  const { data: session, status } = useSession();
  const router = useRouter();

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

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
    if (session && session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setMessage("✅ Question added successfully!");
        setForm({ ...form, text: "", options: ["", "", "", ""], explanation: "" });
      } else {
        const err = await res.json();
        setMessage("❌ Error: " + err.error);
      }
    } catch (e) {
      setMessage("❌ Failed to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container" style={{ padding: '2rem 1rem' }}>
      <div className="flex justify-between items-center" style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--accent-color)' }}>Add New Question</h1>
        <button className="btn btn-secondary" onClick={() => router.push('/admin')}>Back to Admin</button>
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
            <label className="label">Question Text (HTML allowed)</label>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
             {form.options.map((opt, idx) => (
               <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <span style={{ fontWeight: 'bold' }}>{String.fromCharCode(65 + idx)}.</span>
                 <input 
                   className="input" 
                   style={{ flex: 1 }}
                   value={opt}
                   onChange={e => {
                     const newOpts = [...form.options];
                     newOpts[idx] = e.target.value;
                     setForm({...form, options: newOpts});
                   }}
                   placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                   required
                 />
                 <input 
                   type="radio" 
                   name="correctAnswer" 
                   checked={form.correctAnswer === idx.toString()} 
                   onChange={() => setForm({...form, correctAnswer: idx.toString()})}
                 />
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

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? "Saving..." : "Add Question to Database"}
          </button>
        </form>
      </div>
    </main>
  );
}
