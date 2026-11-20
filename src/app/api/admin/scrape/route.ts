import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

import { sanitizeScrapedOption } from "@/lib/sanitizer";

const BASE_URL = "https://myschool.ng";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

/**
 * Extract all unique detail-page links from a classroom list page.
 */
function extractDetailLinks($: cheerio.CheerioAPI, subject: string): string[] {
  const seen = new Set<string>();
  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (/^\/classroom\/[^/]+\/\d+(\?.*)?$/.test(href)) {
      const cleanPath = href.split("?")[0];
      seen.add(`${BASE_URL}${cleanPath}`);
    }
  });
  return [...seen];
}

/**
 * Extract the highest page number from pagination links or script payload.
 */
function getTotalPages($: cheerio.CheerioAPI, currentPage: number, html?: string): number {
  let totalPages = currentPage;
  $("a[href*='page=']").each((_, el) => {
    const href = $(el).attr("href") || "";
    const m = href.match(/[?&]page=(\d+)/);
    if (m) {
      const p = parseInt(m[1], 10);
      if (p > totalPages) totalPages = p;
    }
  });

  // Also check any page= query occurrences in the raw HTML / Nuxt payload
  if (html) {
    const pageMatches = html.matchAll(/page=(\d+)/g);
    for (const match of pageMatches) {
      const p = parseInt(match[1], 10);
      if (p > totalPages && p < 1000) totalPages = p;
    }
  }

  return totalPages;
}

/**
 * Extract year from badge spans (used in probe mode for informational display only).
 */
function extractYearFromBadges($: cheerio.CheerioAPI, container: cheerio.Cheerio<any>): number {
  let year = 0;
  container.find("span.inline-flex").each((_, el) => {
    const text = $(el).text().trim();
    const m = text.match(/\d{4}/);
    if (m) {
      const y = parseInt(m[0]);
      if (y > 1970 && y <= new Date().getFullYear()) {
        year = y;
      }
    }
  });
  return year;
}

/**
 * Parse a detail page for its question text, options, correct answer, and explanation.
 * Works with the Nuxt 3 rendered Myschool layout.
 */
async function parseDetailPage(detailUrl: string, questionTypeOverride: string): Promise<{
  text: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  type: string;
  year: number;
} | null> {
  try {
    const res = await fetch(detailUrl, { headers: FETCH_HEADERS });
    const html = await res.text();
    const $ = cheerio.load(html);

    // --- Question Text ---
    let questionText = $("h1").first().text().trim();
    if (!questionText) {
      // Fallback: check .q-area or .question-text
      questionText = $(".q-area h1, .question-text, .q-text").first().text().trim();
    }
    if (!questionText) return null;

    // Check if there is an associated question diagram/image immediately preceding or inside question container
    const questionImg = $("h1").parent().find("img").first();
    if (questionImg.length > 0) {
      const src = questionImg.attr("src") || questionImg.attr("data-src");
      if (src && !src.includes("placeholder") && !src.includes("members")) {
        const fullSrc = src.startsWith("http") ? src : `${BASE_URL}${src}`;
        if (!questionText.includes(fullSrc)) {
          questionText += `\n\n<p><img src="${fullSrc}" alt="Question Diagram" class="img-fluid" /></p>`;
        }
      }
    }

    // --- Year from badge spans (stored for informational purposes) ---
    let year = 0;
    $("span.inline-flex").each((_, el) => {
      const text = $(el).text().trim();
      const m = text.match(/\d{4}/);
      if (m) {
        const y = parseInt(m[0]);
        if (y > 1970 && y <= new Date().getFullYear()) {
          year = y;
        }
      }
    });

    // --- Options & Correct Answer ---
    const options: string[] = [];
    let correctAnswerIdx = 0;
    $("div.flex.gap-6.items-center.rounded-lg").each((_, el) => {
      const optionTextEl = $(el).find("p.font-medium").first();
      if (optionTextEl.length === 0) return;

      const optHtml = (optionTextEl.html() || "").trim()
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gmi, "")
        .replace(/on\w+="[^"]*"/gmi, "");

      options.push(sanitizeScrapedOption(optHtml));

      const cls = $(el).attr("class") || "";
      if (cls.includes("bg-[#DFFFEC]") || cls.includes("!border-[#0C5132]")) {
        correctAnswerIdx = options.length - 1;
      }
    });

    // --- Question Type ---
    let type: string;
    if (questionTypeOverride === "theory") {
      type = "Theory";
    } else if (questionTypeOverride === "practical") {
      type = "Practical";
    } else {
      type = options.length === 0 ? "Theory" : "Objective";
    }

    // --- Explanation / Model Answer ---
    let explanation = "No explanation provided.";
    $("h4").each((_, h) => {
      const hText = $(h).text().toLowerCase();
      if (hText.includes("explanation") || hText.includes("solution") || hText.includes("answer")) {
        const container = $(h).closest("div.bg-surface, div.space-y-1, .q-area, div.flex-col").parent();
        const pEl = container.find("p.text-tx_secondary, p").first();
        const imgEl = container.find("img[src*='classroom_answers'], img").first();
        
        let contentHtml = "";
        if (imgEl.length > 0) {
          const src = imgEl.attr("src") || imgEl.attr("data-src") || "";
          if (src && !src.includes("placeholder") && !src.includes("members")) {
            const fullSrc = src.startsWith("http") ? src : `${BASE_URL}${src}`;
            contentHtml += `<p><img src="${fullSrc}" alt="Model Answer / Solution" class="img-fluid" /></p>`;
          }
        }
        
        if (pEl.length > 0) {
          const raw = pEl.html() || pEl.text().trim();
          if (raw && raw.trim() !== "No explanation available") {
            const cleanText = raw
              .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gmi, "")
              .replace(/on\w+="[^"]*"/gmi, "")
              .trim();
            if (cleanText) {
              contentHtml += (contentHtml ? "<br/>" : "") + cleanText;
            }
          }
        }

        if (contentHtml) {
          explanation = contentHtml;
        }
      }
    });

    return {
      text: questionText,
      options,
      correctAnswer: correctAnswerIdx.toString(),
      explanation,
      type,
      year,
    };
  } catch (err) {
    console.error(`Error parsing detail page ${detailUrl}:`, err);
    return null;
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user?.role !== "ADMIN" && session.user?.role !== "SUPER_ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const {
      subject,
      examType,
      page = 1,
      probe = false,
      // "objective" | "theory" | "practical" — determines which questions are fetched
      questionType = "objective",
      // Optional year filter: when provided and valid, limits scraping to that specific exam year
      examYear,
    } = await request.json();

    const formattedSubject = subject.toLowerCase().replace(/\s+/g, "-");
    const examSlug = examType.toLowerCase();

    // Build list URL — pass type= and optional exam_year=
    const typeParam =
      questionType === "theory" ? "&type=theory" :
      questionType === "practical" ? "&type=practical" : "";

    const parsedYear = examYear ? parseInt(examYear.toString(), 10) : null;
    const yearParam = parsedYear && parsedYear >= 1970 ? `&exam_year=${parsedYear}` : "";

    const listUrl = `${BASE_URL}/classroom/${formattedSubject}?exam_type=${examSlug}${typeParam}${yearParam}&page=${page}`;

    console.log(`[Scraper] ${probe ? "PROBE" : "SCRAPE"} [${questionType.toUpperCase()}] ${parsedYear ? `(Year ${parsedYear}) ` : ""}– ${listUrl}`);

    const response = await fetch(listUrl, { headers: FETCH_HEADERS });
    const html = await response.text();
    const $ = cheerio.load(html);

    // If an examYear was specifically requested, verify page title or content matches
    // Myschool redirects or serves fallback if year doesn't exist
    let yearMismatch = false;
    if (parsedYear) {
      const pageTitle = $("title").text().toLowerCase();
      // If the page title has a 4-digit year, it must match parsedYear
      const titleYearMatch = pageTitle.match(/\b(19\d\d|20\d\d)\b/);
      if (titleYearMatch && parseInt(titleYearMatch[1], 10) !== parsedYear) {
        yearMismatch = true;
      }
    }

    // Get paginated detail links
    const detailLinks = yearMismatch ? [] : extractDetailLinks($, subject);
    const totalPages = yearMismatch ? 0 : getTotalPages($, page, html);

    // ─────────────────────────────────────────────────────────────
    // PROBE MODE: return page info without fetching detail pages
    // ─────────────────────────────────────────────────────────────
    if (probe) {
      const years: number[] = [];

      // Extract years from question cards on this page
      $(".q-area, section").each((_, el) => {
        const text = $(el).text();
        const matches = text.match(/>?\s*(19\d\d|20\d\d)\s*<?/g);
        if (matches) {
          for (const m of matches) {
            const y = parseInt(m.replace(/[^\d]/g, ""), 10);
            if (y > 1970 && y <= new Date().getFullYear()) {
              if (!years.includes(y)) years.push(y);
            }
          }
        }
      });

      if (years.length === 0) {
        $("span.inline-flex").each((_, el) => {
          const text = $(el).text().trim().toUpperCase();
          const m = text.match(/\b(19\d\d|20\d\d)\b/);
          if (m) {
            const y = parseInt(m[1], 10);
            if (!years.includes(y)) years.push(y);
          }
        });
      }

      return NextResponse.json({
        probe: true,
        page,
        totalOnPage: detailLinks.length,
        years,
        totalPages,
        yearMismatch,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // FULL SCRAPE MODE
    // ─────────────────────────────────────────────────────────────
    const fetchedQuestions: any[] = [];
    const rawCount = detailLinks.length;
    let skippedCount = 0;

    console.log(`Found ${detailLinks.length} detail links on list page.`);

    for (const detailUrl of detailLinks) {
      await new Promise((r) => setTimeout(r, 800));
      console.log(`Scraping: ${detailUrl}`);

      const parsed = await parseDetailPage(detailUrl, questionType);
      if (!parsed) {
        skippedCount++;
        console.log(`⏭ Skipping: Could not parse detail page`);
        continue;
      }

      // Fallback year if 0
      if (parsed.year === 0) parsed.year = new Date().getFullYear();

      fetchedQuestions.push({
        text: parsed.text,
        options: parsed.options,
        correctAnswer: parsed.correctAnswer,
        explanation: parsed.explanation,
        type: parsed.type,
        year: parsed.year,
        sourceUrl: detailUrl,
      });
    }

    // ─────────────────────────────────────────────────────────────
    // Save to DB
    // ─────────────────────────────────────────────────────────────
    const et = await prisma.examType.upsert({
      where: { name: examType },
      update: {},
      create: { name: examType },
    });

    const sub = await prisma.subject.upsert({
      where: { name_examTypeId: { name: subject, examTypeId: et.id } },
      update: {},
      create: { name: subject, examTypeId: et.id },
    });

    let savedCount = 0;
    for (const q of fetchedQuestions) {
      if (questionType === "theory") {
        // Save theory questions to TheoryQuestion table
        const existing = await prisma.theoryQuestion.findFirst({
          where: { text: q.text, subjectId: sub.id },
        });
        if (!existing) {
          await prisma.theoryQuestion.create({
            data: {
              text: q.text,
              year: q.year,
              sampleAnswer: q.explanation && q.explanation !== "No explanation provided." ? q.explanation : null,
              sourceUrl: q.sourceUrl,
              examTypeId: et.id,
              subjectId: sub.id,
            },
          });
          savedCount++;
        }
      } else {
        // Save Objective / Practical questions to Question table
        const existing = await prisma.question.findFirst({
          where: { text: q.text, subjectId: sub.id, type: q.type },
        });
        if (!existing) {
          await prisma.question.create({
            data: {
              text: q.text,
              type: q.type,
              year: q.year,
              options: JSON.stringify(q.options),
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              examTypeId: et.id,
              subjectId: sub.id,
            },
          });
          savedCount++;
        }
      }
    }

    const message =
      rawCount === 0
        ? `Page ${page}: No questions found (page may not exist or subject not available for ${examType}).`
        : `Page ${page}: Found ${rawCount} questions, ${skippedCount} skipped, saved ${savedCount} new ${questionType} questions.`;

    return NextResponse.json({
      message,
      count: savedCount,
      rawCount,
      skippedCount,
      inRangeCount: fetchedQuestions.length,
      totalPages,
    });
  } catch (error: any) {
    console.error("Scraping error:", error);
    return NextResponse.json(
      { error: "Failed to scrape: " + error.message },
      { status: 500 }
    );
  }
}
