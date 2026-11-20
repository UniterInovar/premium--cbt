const katex = require("katex");

function formatMathInString(html) {
  if (!html) return "";

  try {
    let result = html;

    // 1. Match display math: $$ ... $$ or \[ ... \]
    result = result.replace(/(?:\$\$|\\\[)([\s\S]+?)(?:\$\$|\\\])/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
      } catch (e) {
        return _;
      }
    });

    // 2. Match inline math: \( ... \)
    result = result.replace(/\\\(([\s\S]+?)\\\)/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
      } catch (e) {
        return _;
      }
    });

    return result;
  } catch (e) {
    return html;
  }
}

const input = "Evaluate \\(\\frac{81.81+99.44}{20.09+36.16}\\) correct to 3 significant figures.";
console.log("Original Input:", input);
const rendered = formatMathInString(input);
console.log("Rendered Output:", rendered);
