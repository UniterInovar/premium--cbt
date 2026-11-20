"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ActivateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setMessage("No activation token was provided in the link.");
      return;
    }

    const activate = async () => {
      try {
        const res = await fetch(`/api/auth/activate?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (res.ok) {
          setSuccess(true);
          setMessage(data.message || "Your account has been successfully activated!");
        } else {
          setSuccess(false);
          setMessage(data.error || "Unable to activate account. The link may have expired.");
        }
      } catch (err: any) {
        setSuccess(false);
        setMessage("A network error occurred while activating your account.");
      } finally {
        setLoading(false);
      }
    };

    activate();
  }, [token]);

  return (
    <main className="container flex flex-col justify-center items-center min-h-screen" style={{ padding: "1.5rem" }}>
      <div className="card glass w-full animate-fade-in text-center" style={{ maxWidth: "480px", padding: "2.5rem 2rem" }}>
        <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>
          {loading ? "⏳" : success ? "🎉" : "⚠️"}
        </div>

        <h1 style={{ color: success ? "#10b981" : "var(--accent-color)", fontSize: "1.75rem", marginBottom: "0.75rem" }}>
          {loading ? "Activating Account..." : success ? "Account Activated!" : "Activation Issue"}
        </h1>

        <p style={{ color: "var(--text-secondary)", marginBottom: "2rem", fontSize: "1rem", lineHeight: "1.5" }}>
          {message}
        </p>

        {loading && (
          <div style={{ display: "inline-block", width: "32px", height: "32px", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "var(--accent-color)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        )}

        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {success ? (
              <button
                onClick={() => router.push("/login")}
                className="btn btn-primary w-full"
                style={{ padding: "0.9rem", fontSize: "1.05rem" }}
              >
                Sign In to Your Account
              </button>
            ) : (
              <>
                <button
                  onClick={() => router.push("/login?register=true")}
                  className="btn btn-primary w-full"
                  style={{ padding: "0.9rem" }}
                >
                  Create Account / Register Again
                </button>
                <Link
                  href="/login"
                  className="btn btn-secondary w-full"
                  style={{ padding: "0.9rem", display: "inline-block", textAlign: "center" }}
                >
                  Back to Login
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={
      <main className="container flex flex-col justify-center items-center min-h-screen">
        <div className="card glass text-center" style={{ padding: "2rem" }}>
          <p>Loading activation details...</p>
        </div>
      </main>
    }>
      <ActivateContent />
    </Suspense>
  );
}

