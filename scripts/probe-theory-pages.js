const cheerio = require("cheerio");

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

async function probePage(subject, examSlug, typeParam, page) {
  const typeQuery = typeParam ? `&type=${typeParam}` : "";
  const url = `https://myschool.ng/classroom/${subject}?exam_type=${examSlug}${typeQuery}&page=${page}`;
  
  const res = await fetch(url, { headers: FETCH_HEADERS });
  const html = await res.text();
  const $ = cheerio.load(html);
  
  // Count detail links
  const seen = new Set();
  $("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (/^\/classroom\/[^/]+\/\d+$/.test(href)) {
      seen.add(href);
    }
  });
  const detailCount = seen.size;
  
  // Get pagination links
  let totalPages = page;
  $("a[href*='page=']").each((_, el) => {
    const href = $(el).attr("href") || "";
    const m = href.match(/[?&]page=(\d+)/);
    if (m) {
      const p = parseInt(m[1]);
      if (p > totalPages) totalPages = p;
    }
  });
  
  // Extract years from badge spans
  const years = [];
  $("span.inline-flex").each((_, el) => {
    const text = $(el).text().trim();
    const m = text.match(/\d{4}/);
    if (m) {
      const y = parseInt(m[0]);
      if (y > 1970 && y <= new Date().getFullYear()) years.push(y);
    }
  });
  
  return { page, detailCount, totalPages, years: [...new Set(years)] };
}

async function run() {
  console.log("=== Probing WAEC Chemistry Theory pages ===\n");
  
  // Probe page 1 to get total pages
  const p1 = await probePage("chemistry", "waec", "theory", 1);
  console.log("Page 1:", p1);
  
  await new Promise(r => setTimeout(r, 800));
  
  // Probe last page
  if (p1.totalPages > 1) {
    const last = await probePage("chemistry", "waec", "theory", p1.totalPages);
    console.log(`Last page (${p1.totalPages}):`, last);
    await new Promise(r => setTimeout(r, 800));
  }
  
  // Also compare with objective for reference
  console.log("\n=== WAEC Chemistry Objective (first page for comparison) ===\n");
  const objP1 = await probePage("chemistry", "waec", "", 1);
  console.log("Objective Page 1:", objP1);
}

run().catch(console.error);
