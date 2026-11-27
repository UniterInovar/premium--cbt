import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
} from "docx";

// ─────────────────────────────────────────────────────────────────────────────
// LaTeX → Unicode symbol map (Greek letters, math operators, arrows, etc.)
// ─────────────────────────────────────────────────────────────────────────────
const LATEX_SYMBOLS: Record<string, string> = {
  // Greek lowercase
  "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ",
  "\\epsilon": "ε", "\\varepsilon": "ε", "\\zeta": "ζ", "\\eta": "η",
  "\\theta": "θ", "\\vartheta": "ϑ", "\\iota": "ι", "\\kappa": "κ",
  "\\lambda": "λ", "\\mu": "μ", "\\nu": "ν", "\\xi": "ξ",
  "\\pi": "π", "\\varpi": "ϖ", "\\rho": "ρ", "\\varrho": "ϱ",
  "\\sigma": "σ", "\\varsigma": "ς", "\\tau": "τ", "\\upsilon": "υ",
  "\\phi": "φ", "\\varphi": "φ", "\\chi": "χ", "\\psi": "ψ", "\\omega": "ω",
  // Greek uppercase
  "\\Gamma": "Γ", "\\Delta": "Δ", "\\Theta": "Θ", "\\Lambda": "Λ",
  "\\Xi": "Ξ", "\\Pi": "Π", "\\Sigma": "Σ", "\\Upsilon": "Υ",
  "\\Phi": "Φ", "\\Psi": "Ψ", "\\Omega": "Ω",
  // Math operators / relations
  "\\times": "×", "\\div": "÷", "\\pm": "±", "\\mp": "∓",
  "\\cdot": "·", "\\bullet": "•", "\\star": "★",
  "\\leq": "≤", "\\le": "≤", "\\geq": "≥", "\\ge": "≥",
  "\\neq": "≠", "\\ne": "≠", "\\approx": "≈", "\\equiv": "≡",
  "\\sim": "∼", "\\simeq": "≃", "\\propto": "∝", "\\infty": "∞",
  "\\partial": "∂", "\\nabla": "∇", "\\forall": "∀", "\\exists": "∃",
  "\\in": "∈", "\\notin": "∉", "\\subset": "⊂", "\\supset": "⊃",
  "\\subseteq": "⊆", "\\supseteq": "⊇", "\\cup": "∪", "\\cap": "∩",
  "\\emptyset": "∅", "\\varnothing": "∅",
  // Arrows
  "\\rightarrow": "→", "\\leftarrow": "←", "\\Rightarrow": "⇒",
  "\\Leftarrow": "⇐", "\\leftrightarrow": "↔", "\\Leftrightarrow": "⟺",
  "\\to": "→", "\\gets": "←", "\\uparrow": "↑", "\\downarrow": "↓",
  // Misc
  "\\sum": "Σ", "\\prod": "Π", "\\int": "∫", "\\oint": "∮",
  "\\sqrt": "√", "\\degree": "°", "\\circ": "°",
  "\\ldots": "…", "\\cdots": "⋯", "\\vdots": "⋮", "\\ddots": "⋱",
  "\\hbar": "ℏ", "\\ell": "ℓ", "\\Re": "ℜ", "\\Im": "ℑ",
  "\\angle": "∠", "\\perp": "⊥", "\\parallel": "∥",
  "\\triangle": "△", "\\square": "□",
  "\\oplus": "⊕", "\\otimes": "⊗",
  "\\dagger": "†", "\\ddagger": "‡",
};

// Unicode superscript / subscript character maps
const SUPERSCRIPT_MAP: Record<string, string> = {
  "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹",
  "+":"⁺","-":"⁻","=":"⁼","(":"⁽",")":"⁾","n":"ⁿ","i":"ⁱ","a":"ᵃ","b":"ᵇ",
  "c":"ᶜ","d":"ᵈ","e":"ᵉ","f":"ᶠ","g":"ᵍ","h":"ʰ","j":"ʲ","k":"ᵏ","l":"ˡ",
  "m":"ᵐ","o":"ᵒ","p":"ᵖ","r":"ʳ","s":"ˢ","t":"ᵗ","u":"ᵘ","v":"ᵛ","w":"ʷ",
  "x":"ˣ","y":"ʸ","z":"ᶻ",
};
const SUBSCRIPT_MAP: Record<string, string> = {
  "0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉",
  "+":"₊","-":"₋","=":"₌","(":"₍",")":"₎","a":"ₐ","e":"ₑ","o":"ₒ","x":"ₓ",
  "i":"ᵢ","j":"ⱼ","k":"ₖ","l":"ₗ","m":"ₘ","n":"ₙ","p":"ₚ","r":"ᵣ","s":"ₛ",
  "t":"ₜ","u":"ᵤ","v":"ᵥ",
};

function toScript(text: string, map: Record<string, string>): string {
  return text.split("").map(c => map[c] || c).join("");
}

/**
 * Convert a LaTeX math expression to a readable Unicode string.
 * Handles: fractions, sqrt, super/subscripts, Greek letters, operators.
 */
function latexToUnicode(latex: string): string {
  let s = latex.trim();

  // Named symbols (longest match first)
  const sortedKeys = Object.keys(LATEX_SYMBOLS).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    s = s.split(key).join(LATEX_SYMBOLS[key]);
  }

  // \frac{a}{b} → (a/b) — two passes for nested fractions
  for (let i = 0; i < 3; i++) {
    s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, n, d) => `(${n}/${d})`);
  }

  // \sqrt[n]{x} and \sqrt{x}
  s = s.replace(/\\sqrt\[([^\]]+)\]\{([^{}]*)\}/g, (_, n, x) => `${toScript(n, SUPERSCRIPT_MAP)}√(${x})`);
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, (_, x) => `√(${x})`);
  s = s.replace(/\\sqrt\b/g, "√");

  // ^{...} braced superscript, _{...} braced subscript
  s = s.replace(/\^\{([^{}]+)\}/g, (_, e) => toScript(e, SUPERSCRIPT_MAP));
  s = s.replace(/_\{([^{}]+)\}/g, (_, e) => toScript(e, SUBSCRIPT_MAP));
  // ^x and _x single char
  s = s.replace(/\^([A-Za-z0-9+\-])/g, (_, c) => toScript(c, SUPERSCRIPT_MAP));
  s = s.replace(/_([A-Za-z0-9+\-])/g, (_, c) => toScript(c, SUBSCRIPT_MAP));

  // \text{...} and \math*{...} → unwrap
  s = s.replace(/\\text\{([^{}]*)\}/g, "$1");
  s = s.replace(/\\math[a-z]+\{([^{}]*)\}/g, "$1");

  // \left( \right) brackets
  s = s.replace(/\\left\s*\(/g, "(").replace(/\\right\s*\)/g, ")");
  s = s.replace(/\\left\s*\[/g, "[").replace(/\\right\s*\]/g, "]");
  s = s.replace(/\\left\s*\|/g, "|").replace(/\\right\s*\|/g, "|");
  s = s.replace(/\\left\s*\./g, "").replace(/\\right\s*\./g, "");

  // Remove braces
  s = s.replace(/\{([^{}]*)\}/g, "$1");

  // Remove remaining backslash commands
  s = s.replace(/\\[a-zA-Z]+\s*/g, "");

  // Spacing
  s = s.replace(/\\[,;!]/g, " ").replace(/\\quad/g, "  ").replace(/\\qquad/g, "    ");

  return s.replace(/\s{2,}/g, " ").trim();
}

/** Inline segment for a Word TextRun */
interface Segment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  sup?: boolean;
  sub?: boolean;
}

/**
 * Parse HTML string into Segments for Word TextRun rendering.
 * Handles: <sub>, <sup>, <strong>, <b>, <em>, <i>, LaTeX \(...\) and $...$,
 * <br>, HTML entities, and strips remaining tags.
 */
function htmlToSegments(html: string): Segment[] {
  if (!html) return [{ text: "" }];

  // Replace LaTeX display math → Unicode
  let s = html
    .replace(/\\\[([^]+?)\\\]/g, (_, m) => ` [${latexToUnicode(m)}] `)
    .replace(/\$\$([^]+?)\$\$/g, (_, m) => ` [${latexToUnicode(m)}] `);

  // Replace inline LaTeX
  s = s
    .replace(/\\\(([^]+?)\\\)/g, (_, m) => latexToUnicode(m))
    .replace(/(?<!\$)\$(?!\d)([^$\n]+?)\$/g, (_, m) => latexToUnicode(m));

  // <br> → newline
  s = s.replace(/<br\s*\/?>/gi, "\n");

  const segments: Segment[] = [];
  type State = { bold: boolean; italic: boolean; sup: boolean; sub: boolean };
  const stateStack: State[] = [{ bold: false, italic: false, sup: false, sub: false }];
  const cur = () => stateStack[stateStack.length - 1];

  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  const flushText = (text: string) => {
    if (!text) return;
    // Decode HTML entities
    text = text
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&[a-z]+;/gi, " ");
    if (!text.trim() && !text.includes("\n")) return;
    const c = cur();
    segments.push({ text, bold: c.bold, italic: c.italic, sup: c.sup, sub: c.sub });
  };

  while ((m = tagRe.exec(s)) !== null) {
    flushText(s.slice(lastIndex, m.index));
    lastIndex = m.index + m[0].length;
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    if (!closing) {
      const prev = cur();
      const next: State = { ...prev };
      if (tag === "strong" || tag === "b") next.bold = true;
      if (tag === "em" || tag === "i") next.italic = true;
      if (tag === "sup") next.sup = true;
      if (tag === "sub") next.sub = true;
      stateStack.push(next);
    } else {
      if (stateStack.length > 1) stateStack.pop();
    }
  }
  flushText(s.slice(lastIndex));
  return segments.length ? segments : [{ text: "" }];
}

/** Convert Segment array to docx TextRun array */
function segmentsToRuns(segments: Segment[], colorOverride?: string): TextRun[] {
  return segments.map(
    (seg) =>
      new TextRun({
        text: seg.text,
        bold: seg.bold,
        italics: seg.italic,
        superScript: seg.sup,
        subScript: seg.sub,
        color: colorOverride,
      })
  );
}

function htmlToRuns(html: string, colorOverride?: string): TextRun[] {
  return segmentsToRuns(htmlToSegments(html), colorOverride);
}

/** Fetch a remote image and return as Buffer, or null on failure */
async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const absUrl = url.startsWith("http")
      ? url
      : `https://myschool.ng${url.startsWith("/") ? "" : "/"}${url}`;
    const res = await fetch(absUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

/** Extract first <img> from HTML, fetch it, return ImageRun or null */
async function extractImageRun(html: string): Promise<ImageRun | null> {
  const imgMatch = html.match(/<img[^>]+src="([^"]+)"/i);
  if (!imgMatch) return null;
  const buf = await fetchImage(imgMatch[1]);
  if (!buf) return null;
  const ext = (imgMatch[1].split(".").pop()?.split("?")[0] || "jpeg").toLowerCase();
  const typeMap: Record<string, any> = {
    png: "png", jpg: "jpeg", jpeg: "jpeg", gif: "gif",
  };
  return new ImageRun({
    data: buf,
    transformation: { width: 420, height: 260 },
    type: typeMap[ext] || "jpeg",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/export
// Query params: examType, subject, year, type (mcq|theory|all), images (0|1)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (
    !session ||
    (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const examTypeFilter = (searchParams.get("examType") || "").trim();
  const subjectFilter  = (searchParams.get("subject") || "").trim();
  const yearFilter     = (searchParams.get("year") || "").trim();
  const qtype          = (searchParams.get("type") || "mcq").trim();
  const includeImages  = searchParams.get("images") !== "0";

  const whereBase: any = {};
  if (examTypeFilter) whereBase.examType = { name: examTypeFilter };
  if (subjectFilter)  whereBase.subject  = { name: subjectFilter };
  if (yearFilter) {
    const y = parseInt(yearFilter, 10);
    if (!isNaN(y) && y >= 1970 && y <= 2100) whereBase.year = y;
  }

  const mcqQuestions =
    qtype !== "theory"
      ? await prisma.question.findMany({
          where: whereBase,
          include: { examType: true, subject: true, topic: true },
          orderBy: [
            { examType: { name: "asc" } },
            { subject: { name: "asc" } },
            { year: "asc" },
          ],
          take: 8000,
        })
      : [];

  const theoryQuestions =
    qtype !== "mcq"
      ? await prisma.theoryQuestion.findMany({
          where: whereBase,
          include: { examType: true, subject: true, topic: true },
          orderBy: [
            { examType: { name: "asc" } },
            { subject: { name: "asc" } },
            { year: "asc" },
          ],
          take: 3000,
        })
      : [];

  if (mcqQuestions.length === 0 && theoryQuestions.length === 0) {
    return NextResponse.json(
      { error: "No questions found for the selected filters." },
      { status: 404 }
    );
  }

  const docChildren: any[] = [];
  const typeLabel =
    qtype === "mcq" ? "Objective" : qtype === "theory" ? "Theory" : "All Questions";

  // ── Title page ─────────────────────────────────────────────────────────
  const titleLine = [examTypeFilter, subjectFilter, yearFilter]
    .filter(Boolean)
    .join(" · ") || "Complete Question Bank";

  docChildren.push(
    new Paragraph({
      children: [new TextRun({ text: "Premium CBT — Question Bank", bold: true, size: 48, color: "1A56DB" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `${titleLine} — ${typeLabel}`, size: 32, italics: true, color: "333333" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${mcqQuestions.length + theoryQuestions.length} questions   |   ${new Date().toLocaleString("en-NG")}`,
          size: 20, color: "888888",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    })
  );

  // ── MCQ / Objective section ─────────────────────────────────────────────
  if (mcqQuestions.length > 0) {
    docChildren.push(
      new Paragraph({
        text: `Objective Questions  (${mcqQuestions.length})`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    let currentGroup = "";
    let absoluteNum = 0;

    for (const q of mcqQuestions) {
      absoluteNum++;
      const groupKey = `${q.examType.name}|${q.subject.name}`;
      if (groupKey !== currentGroup) {
        currentGroup = groupKey;
        docChildren.push(
          new Paragraph({
            text: `${q.examType.name} · ${q.subject.name}`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 120 },
          })
        );
      }

      // Question text runs
      const qRuns: any[] = [
        new TextRun({ text: `${absoluteNum}. `, bold: true }),
        ...htmlToRuns(q.text),
        new TextRun({ text: `  [${q.year}]`, color: "888888", italics: true }),
      ];
      docChildren.push(
        new Paragraph({ children: qRuns, spacing: { before: 200, after: 60 } })
      );

      // Embedded image (diagrams)
      if (includeImages && q.text.includes("<img")) {
        const imgRun = await extractImageRun(q.text);
        if (imgRun) {
          docChildren.push(
            new Paragraph({ children: [imgRun], spacing: { before: 60, after: 100 } })
          );
        }
      }

      // Options
      let options: Record<string, string> = {};
      try {
        if (q.options) {
          const parsed = JSON.parse(q.options);
          const labels = ["A", "B", "C", "D", "E"];
          if (Array.isArray(parsed)) {
            parsed.forEach((v: string, i: number) => { options[labels[i] || String(i)] = v; });
          } else {
            options = parsed;
          }
        }
      } catch {}

      const optEntries = Object.entries(options);
      const labels = ["A", "B", "C", "D", "E"];

      optEntries.forEach(([key, val], i) => {
        const label = labels[i] || key;
        const isCorrect =
          q.correctAnswer === key ||
          q.correctAnswer === label ||
          q.correctAnswer === String(i);
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${label}. `, bold: true, color: isCorrect ? "16A34A" : undefined }),
              ...htmlToRuns(typeof val === "string" ? val : String(val), isCorrect ? "16A34A" : undefined),
            ],
            spacing: { before: 20, after: 20 },
            indent: { left: 440 },
          })
        );
      });

      // Correct answer line
      if (q.correctAnswer) {
        // Determine display label for the correct answer
        const correctIdx = optEntries.findIndex(([key], i) =>
          q.correctAnswer === key || q.correctAnswer === labels[i]
        );
        const displayLabel =
          correctIdx >= 0 ? labels[correctIdx] : q.correctAnswer;
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: "✓ Answer: ", bold: true, color: "16A34A" }),
              new TextRun({ text: displayLabel, bold: true, color: "16A34A" }),
            ],
            spacing: { before: 60, after: 40 },
          })
        );
      }

      // Explanation
      if (q.explanation) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Explanation: ", bold: true, italics: true, color: "555555" }),
              ...htmlToRuns(q.explanation, "555555"),
            ],
            spacing: { before: 20, after: 140 },
          })
        );
      } else {
        docChildren.push(new Paragraph({ text: "", spacing: { after: 60 } }));
      }
    }
  }

  // ── Theory section ─────────────────────────────────────────────────────
  if (theoryQuestions.length > 0) {
    docChildren.push(
      new Paragraph({
        text: `Theory Questions  (${theoryQuestions.length})`,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: mcqQuestions.length > 0,
        spacing: { before: 600, after: 200 },
      })
    );

    let currentGroup = "";
    let absoluteNum = 0;

    for (const q of theoryQuestions) {
      absoluteNum++;
      const groupKey = `${q.examType.name}|${q.subject.name}`;
      if (groupKey !== currentGroup) {
        currentGroup = groupKey;
        docChildren.push(
          new Paragraph({
            text: `${q.examType.name} · ${q.subject.name}`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 120 },
          })
        );
      }

      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${absoluteNum}. `, bold: true }),
            ...htmlToRuns(q.text),
            new TextRun({
              text: `  [${q.year}${q.section ? ` · ${q.section}` : ""}]`,
              color: "888888", italics: true,
            }),
          ],
          spacing: { before: 200, after: 60 },
        })
      );

      if (includeImages && q.text.includes("<img")) {
        const imgRun = await extractImageRun(q.text);
        if (imgRun) {
          docChildren.push(
            new Paragraph({ children: [imgRun], spacing: { before: 60, after: 100 } })
          );
        }
      }

      if (q.sampleAnswer) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Sample Answer: ", bold: true, italics: true, color: "555555" }),
              ...htmlToRuns(q.sampleAnswer, "555555"),
            ],
            spacing: { before: 20, after: 140 },
          })
        );
      } else {
        docChildren.push(new Paragraph({ text: "", spacing: { after: 80 } }));
      }
    }
  }

  // ── Pack and stream ─────────────────────────────────────────────────────
  const doc = new Document({
    creator: "Premium CBT",
    title: "Question Bank Export",
    description: `${examTypeFilter || "All"} ${subjectFilter || "subjects"}`,
    sections: [{ children: docChildren }],
  });

  const nodeBuffer = await Packer.toBuffer(doc);
  const buffer = new Uint8Array(nodeBuffer);

  const filename = [examTypeFilter || "ALL", subjectFilter || "AllSubjects", yearFilter, typeLabel]
    .filter(Boolean)
    .join("-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\-_]/g, "")
    .concat(".docx");

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.byteLength.toString(),
      "Cache-Control": "no-store",
    },
  });
}
