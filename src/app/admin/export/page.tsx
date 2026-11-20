"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SubjectEntry = { id: string; name: string; examTypeId: string };
type ExamType = { id: string; name: string; subjects: SubjectEntry[] };

export default function ExportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<SubjectEntry[]>([]);

  const [selectedExamType, setSelectedExamType] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedType, setSelectedType] = useState("all");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (
      session &&
      session.user?.role !== "ADMIN" &&
      session.user?.role !== "SUPER_ADMIN"
    ) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  // Fetch exam types & subjects for filter dropdowns
  useEffect(() => {
    if (
      session?.user?.role !== "ADMIN" &&
      session?.user?.role !== "SUPER_ADMIN"
    )
      return;

    fetch("/api/admin/exam-config")
      .then((r) => r.json())
      .then((data: ExamType[]) => {
        setExamTypes(data || []);
        // Flatten all subjects from all exam types
        const allSubjects: SubjectEntry[] = (data || []).flatMap((et) =>
          (et.subjects || []).map((s) => ({ ...s, examTypeId: et.id }))
        );
        setFilteredSubjects(allSubjects);
      })
      .catch(() => {});
  }, [session]);

  // Filter subjects by exam type
  useEffect(() => {
    if (!selectedExamType) {
      // Show all subjects (deduplicated by name)
      const all = examTypes.flatMap((et) => et.subjects || []);
      setFilteredSubjects(all);
    } else {
      const et = examTypes.find((e) => e.name === selectedExamType);
      setFilteredSubjects(et?.subjects || []);
    }
    setSelectedSubject("");
  }, [selectedExamType, examTypes]);

  const handleExport = async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (selectedExamType) params.set("examType", selectedExamType);
    if (selectedSubject) params.set("subject", selectedSubject);
    if (selectedYear) params.set("year", selectedYear);
    params.set("type", selectedType);

    try {
      const res = await fetch(`/api/admin/export?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Export failed.");
        setLoading(false);
        return;
      }

      // Trigger browser download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Try to get filename from Content-Disposition
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      a.download = match ? match[1] : "questions.docx";

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1988 }, (_, i) =>
    String(currentYear - i)
  );

  return (
    <main className="container" style={{ padding: "2rem 1rem", maxWidth: 700 }}>
      <button
        className="btn btn-secondary"
        style={{ marginBottom: "2rem" }}
        onClick={() => router.push("/admin")}
      >
        ← Back to Admin Panel
      </button>

      <h1 style={{ color: "var(--accent-color)", marginBottom: "0.5rem" }}>
        📄 Export Questions
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>
        Download questions from the database as a formatted Word (.docx) file.
        Use the filters below to narrow the export — or leave them blank to
        export everything.
      </p>

      <div
        className="card glass"
        style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
      >
        {/* Exam Type */}
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "0.4rem",
              fontWeight: 600,
            }}
          >
            Exam Type
          </label>
          <select
            className="input"
            value={selectedExamType}
            onChange={(e) => setSelectedExamType(e.target.value)}
          >
            <option value="">All exam types</option>
            {examTypes.map((et) => (
              <option key={et.id} value={et.name}>
                {et.name}
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "0.4rem",
              fontWeight: 600,
            }}
          >
            Subject
          </label>
          <select
            className="input"
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
          >
            <option value="">All subjects</option>
            {filteredSubjects.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Year */}
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "0.4rem",
              fontWeight: 600,
            }}
          >
            Year
          </label>
          <select
            className="input"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Question type */}
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "0.4rem",
              fontWeight: 600,
            }}
          >
            Question Type
          </label>
          <div style={{ display: "flex", gap: "1rem" }}>
            {[
              { value: "all", label: "All (MCQ + Theory)" },
              { value: "mcq", label: "Objective / MCQ only" },
              { value: "theory", label: "Theory only" },
            ].map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="qtype"
                  value={opt.value}
                  checked={selectedType === opt.value}
                  onChange={() => setSelectedType(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "0.75rem 1rem",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid #ef4444",
              borderRadius: 8,
              color: "#ef4444",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={handleExport}
          disabled={loading}
          style={{ marginTop: "0.5rem" }}
        >
          {loading ? "⏳ Generating document..." : "⬇️ Download Word File (.docx)"}
        </button>

        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--text-secondary)",
            marginTop: "0.25rem",
          }}
        >
          ⚠️ Exporting all 14,000+ questions without filters will generate a
          large file and may take 30–60 seconds. Filtering by subject or year is
          recommended.
        </p>
      </div>
    </main>
  );
}
