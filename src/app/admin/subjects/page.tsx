"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ManageSubjects() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [loading, setLoading] = useState(true);

  // Guard: only admin can access
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (session?.user?.role !== "ADMIN" && session?.user?.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    } else {
      // Placeholder subjects for now
      setSubjects(["Mathematics", "English Language", "Physics"]);
      setLoading(false);
    }
  }, [status, session, router]);

  const addSubject = () => {
    if (newSubject && !subjects.includes(newSubject)) {
      setSubjects([...subjects, newSubject]);
      setNewSubject("");
    }
  };

  const removeSubject = (sub: string) => {
    setSubjects(subjects.filter(s => s !== sub));
  };

  if (loading) {
    return (
      <main className="container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Loading admin panel…</p>
      </main>
    );
  }

  return (
    <main className="container" style={{ padding: '2rem 1rem' }}>
      <div className="flex justify-between items-center mb-8">
        <h1 style={{ color: 'var(--accent-color)' }}>Manage Subjects</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => router.push('/')}>Home</button>
          <button className="btn btn-secondary" onClick={() => signOut({ redirect: false, callbackUrl: '/' })}>Sign Out</button>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Existing Subjects</h2>
        <ul className="list-disc pl-5">
          {subjects.map(sub => (
            <li key={sub} className="flex items-center justify-between">
              <span>{sub}</span>
              <button className="btn btn-sm btn-error" onClick={() => removeSubject(sub)}>Delete</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Add New Subject</h2>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={newSubject}
            onChange={e => setNewSubject(e.target.value)}
            placeholder="Subject name"
            className="input input-bordered"
          />
          <button className="btn btn-primary" onClick={addSubject}>Add</button>
        </div>
      </section>
    </main>
  );
}
