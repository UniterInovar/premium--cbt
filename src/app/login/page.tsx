"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("register") === "true") {
        setIsRegister(true);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (isRegister) {
      try {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          setError(data.error || "Failed to create account. Please try again.");
          setLoading(false);
          return;
        }
        
        // After successful registration, notify user to activate via email
        setIsRegister(false);
        setError("");
        alert(data.message || "Account created! Please check your email to activate your account before logging in.");
        setLoading(false);
        return;
      } catch (err: any) {
        console.error("Registration fetch error:", err);
        setError("An unexpected error occurred: " + (err.message || "Unknown error"));
        setLoading(false);
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setLoading(false);
      if (result.error.includes("ACCOUNT_NOT_ACTIVATED")) {
        setError("Your account is not activated yet. Please check your email for the activation link.");
      } else {
        setError("Invalid email or password. Please try again.");
      }
    } else {
      router.replace("/dashboard");
    }
  };

  return (
    <main className="container h-screen flex flex-col justify-center items-center">
      <div className="card glass animate-fade-in w-full" style={{ maxWidth: "480px" }}>
        {/* Logo / Header */}
        <div className="text-center" style={{ marginBottom: "2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🎓</div>
          <h1 style={{ color: "var(--accent-color)", margin: 0, fontSize: "2rem" }}>
            CBT Portal
          </h1>
          <p style={{ margin: "0.5rem 0 0", color: "var(--text-secondary)" }}>
            {isRegister ? "Create a new account" : "Sign in to your account"}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.95rem" }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="student@example.com"
              style={{
                width: "100%", padding: "0.85rem 1rem", borderRadius: "10px",
                border: "1px solid var(--border-color)", backgroundColor: "var(--bg-color)",
                color: "var(--text-primary)", fontFamily: "inherit", fontSize: "1rem", outline: "none",
                boxSizing: "border-box", transition: "border-color 0.2s",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <label style={{ fontWeight: 600, fontSize: "0.95rem" }}>Password</label>
              {!isRegister && (
                <button
                  type="button"
                  onClick={() => router.push('/forgot-password')}
                  style={{ background: "none", border: "none", color: "var(--accent-color)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 500 }}
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: "100%", padding: "0.85rem 3rem 0.85rem 1rem", borderRadius: "10px",
                  border: "1px solid var(--border-color)", backgroundColor: "var(--bg-color)",
                  color: "var(--text-primary)", fontFamily: "inherit", fontSize: "1rem", outline: "none",
                  boxSizing: "border-box", transition: "border-color 0.2s",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute", right: "0.85rem", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: "0",
                  color: "var(--text-secondary)", display: "flex", alignItems: "center",
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: "0.85rem", borderRadius: "8px", backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", marginBottom: "1.25rem", fontSize: "0.95rem" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
            style={{ padding: "1rem", fontSize: "1.1rem", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Please wait..." : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>

        <div className="text-center" style={{ marginTop: "1.5rem", color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          {isRegister ? "Already have an account? " : "New here? "}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(""); }}
            style={{ background: "none", border: "none", color: "var(--accent-color)", cursor: "pointer", fontWeight: 600, fontSize: "0.95rem" }}
          >
            {isRegister ? "Sign In" : "Create Account"}
          </button>
        </div>

      </div>
    </main>
  );
}
