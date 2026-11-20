import sanitizeHtml from "sanitize-html";

/**
 * Allowed HTML tags and attributes for CBT content (Math, text, images, tables, formatting).
 * Strips all script tags, object/embed/iframe tags, event handlers (onclick, onerror, onload),
 * and javascript: or data: hrefs.
 */
export const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "span", "svg", "path", "line", "circle", "rect", "polygon",
    "math", "annotation", "semantics", "mrow", "mi", "mo", "mn",
    "msup", "msub", "mfrac", "msqrt", "mroot", "mtext", "mspace",
    "mstyle", "sub", "sup", "img", "div", "h1", "h2", "h3", "h4",
    "h5", "h6", "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    "br", "hr", "p", "b", "i", "strong", "em", "u", "s", "strike",
    "code", "pre", "blockquote", "mark"
  ],
  allowedAttributes: {
    "*": ["class", "style", "aria-hidden", "aria-label", "role", "title", "dir"],
    img: ["src", "alt", "width", "height", "loading"],
    a: ["href", "target", "rel", "title"],
    table: ["border", "cellpadding", "cellspacing", "width", "align"],
    td: ["colspan", "rowspan", "align", "valign", "width"],
    th: ["colspan", "rowspan", "align", "valign", "width"],
    svg: ["width", "height", "viewBox", "preserveAspectRatio", "fill", "stroke", "stroke-width"],
    path: ["d", "fill", "stroke"],
    line: ["x1", "y1", "x2", "y2", "stroke", "stroke-width"],
  },
  allowedSchemes: ["http", "https", "mailto", "data"],
  allowedSchemesByTag: {
    img: ["http", "https", "data"],
    a: ["http", "https", "mailto"],
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
};

/**
 * Sanitize untrusted HTML to neutralize XSS vectors while preserving legitimate math & formatting.
 */
export function cleanHtml(html: string): string {
  if (!html) return "";
  try {
    return sanitizeHtml(html, SANITIZE_OPTIONS);
  } catch (err) {
    console.error("Sanitization error:", err);
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  }
}

/**
 * CBT Option Prefix Cleansing & Sanitization Utilities
 * Prevents double option prefixes (e.g. "A. A. Option text", "Option A: Text")
 */

/**
 * Clean HTML-aware option prefix string for display in UI components.
 * Preserves wrapping HTML tags (like <p>, <span>, math formatting) while removing leading letters/labels.
 */
export function cleanOptionPrefix(opt: string): string {
  if (!opt) return "";

  let clean = opt;
  // Match prefix patterns: A., A), A:, A -, Option A:, Option A.
  const prefixRegex = /^\s*(?:<[^>]+>\s*)*(?:Option\s+[A-E]\s*[:\.\)]?|[A-E]\s*[\.\):\s\-])\s*(?:<[^>]+>\s*)*/i;

  let last = "";
  while (clean !== last) {
    last = clean;
    clean = clean.replace(prefixRegex, (match) => {
      const tags = match.match(/<[^>]+>/g);
      return tags ? tags.join("") : "";
    });
  }

  return clean.trim();
}

/**
 * Server-side / Ingestion-stage option cleaner for scraped or user-submitted content.
 */
export function sanitizeScrapedOption(optHtml: string): string {
  if (!optHtml) return "";

  let clean = optHtml.trim();

  // 1. Remove standard strong / span elements wrapping letters at start
  clean = clean.replace(/^<strong>\s*[A-E]\s*[\.\)]?\s*<\/strong>\s*/i, "");
  clean = clean.replace(/^<span>\s*[A-E]\s*[\.\)]?\s*<\/span>\s*/i, "");

  // 2. Clear out recurring/nested prefixes (e.g. "A. B. Option text")
  let last = "";
  while (clean !== last) {
    last = clean;
    clean = clean.replace(/^\s*[A-E]\s*[\.\):-]?\s+/gi, "");
    clean = clean.trim();
  }

  // 3. Clear text-based indicators like "Option A: "
  clean = clean.replace(/^\s*Option\s*[A-E]\s*:?\s*/gi, "");

  return clean.trim();
}

/**
 * Clean question text of empty links, empty paragraphs, or extraneous wrapping tags.
 */
export function cleanQuestionText(text: string): string {
  if (!text) return "";
  const cleaned = text
    .replace(/<a\b[^>]*>\s*<\/a>/gi, "")
    .replace(/<p>\s*<\/p>/gi, "")
    .trim();
  return cleanHtml(cleaned);
}

/**
 * Pre-render LaTeX math expressions in an HTML string using KaTeX (renderToString).
 * This is the correct approach: math is rendered into the string BEFORE React sets it
 * into state, so dangerouslySetInnerHTML always receives already-rendered HTML and
 * React re-renders never cause the "flash back to raw LaTeX" problem.
 *
 * Works in both Node.js (SSR) and browser environments.
 * Falls back to the original string if KaTeX is not available or if parsing fails.
 */
export function renderMathInHtml(html: string): string {
  if (!html) return "";

  let katex: any;
  try {
    // Dynamic require — safe for "use client" components via webpack
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    katex = require("katex");
  } catch {
    // KaTeX not available — return as-is
    return html;
  }

  let result = html;

  // 1. Display math: \[ ... \] or $$ ... $$
  result = result.replace(
    /(?:\\\[|\$\$)([\s\S]+?)(?:\\\]|\$\$)/g,
    (match, math) => {
      try {
        return katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
          strict: false,
        });
      } catch {
        return match;
      }
    }
  );

  // 2. Inline math: \( ... \)
  result = result.replace(
    /\\\(([\s\S]+?)\\\)/g,
    (match, math) => {
      try {
        return katex.renderToString(math.trim(), {
          displayMode: false,
          throwOnError: false,
          strict: false,
        });
      } catch {
        return match;
      }
    }
  );

  // 3. Inline math: $ ... $ (single dollar — only if not followed by a digit to avoid price strings)
  result = result.replace(
    /(?<!\$)\$(?!\d)([^$\n]+?)\$/g,
    (match, math) => {
      try {
        return katex.renderToString(math.trim(), {
          displayMode: false,
          throwOnError: false,
          strict: false,
        });
      } catch {
        return match;
      }
    }
  );

  return cleanHtml(result);
}

/**
 * Render LaTeX math expressions within a specified DOM container element (or by element ID).
 * NOTE: Prefer renderMathInHtml() to pre-process strings before React state — this DOM-based
 * approach is only needed as a last-resort fallback for content rendered outside React.
 */
export function renderMath(containerIdOrElement?: string | HTMLElement | null) {
  if (typeof window === "undefined") return;

  const target = typeof containerIdOrElement === "string"
    ? document.getElementById(containerIdOrElement)
    : (containerIdOrElement || document.body);

  if (!target) return;

  // Try KaTeX auto-render if available (loaded via CDN in layout.tsx)
  if (typeof (window as any).renderMathInElement === "function") {
    try {
      (window as any).renderMathInElement(target, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
        errorColor: "#cc0000",
        strict: false,
        ignoredTags: ["script", "noscript", "style", "textarea", "pre"],
      });
    } catch (e) {
      console.warn("KaTeX render error:", e);
    }
  }

  // MathJax v2 fallback
  if ((window as any).MathJax?.Hub) {
    try {
      (window as any).MathJax.Hub.Queue(["Typeset", (window as any).MathJax.Hub, target]);
    } catch (e) {
      console.warn("MathJax render error:", e);
    }
  }
}
