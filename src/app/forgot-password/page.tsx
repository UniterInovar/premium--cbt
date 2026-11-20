"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container flex flex-col justify-center items-center min-h-screen">
      <div className="card glass w-full animate-fade-in" style={{ maxWidth: '450px' }}>
        <h1 className="text-center" style={{ marginBottom: '1rem', color: 'var(--accent-color)' }}>Forgot Password</h1>
        <p className="text-center" style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
          Enter your email address and we'll send you a link to reset your password.
        </p>

        {message && (
          <div style={{ padding: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '12px', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
            {message}
          </div>
        )}

        {error && (
          <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="student@example.com"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary w-full" style={{ padding: '1rem' }}>
            {loading ? "Sending..." : "Send Reset Link"}
          </button>

          <button type="button" onClick={() => router.push('/login')} className="btn btn-secondary w-full" style={{ padding: '1rem' }}>
            Back to Login
          </button>
        </form>
      </div>
    </main>
  );
}
