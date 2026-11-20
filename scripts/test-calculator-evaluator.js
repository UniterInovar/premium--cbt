const evaluateExpression = (expr, isDegreeMode) => {
  let processed = expr;
  
  // Custom Math helper functions
  const fact = (n) => {
    if (n < 0 || !Number.isInteger(n)) return NaN;
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
  };

  const perm = (n, r) => {
    if (n < 0 || r < 0 || r > n || !Number.isInteger(n) || !Number.isInteger(r)) return NaN;
    return fact(n) / fact(n - r);
  };

  const comb = (n, r) => {
    if (n < 0 || r < 0 || r > n || !Number.isInteger(n) || !Number.isInteger(r)) return NaN;
    return fact(n) / (fact(r) * fact(n - r));
  };

  // Replace factorials: e.g. 5! -> fact(5)
  processed = processed.replace(/([0-9.]+)!/g, "fact($1)");

  // Replace permutation: e.g. 5P3 -> perm(5, 3)
  processed = processed.replace(/([0-9.]+)P([0-9.]+)/g, "perm($1, $2)");

  // Replace combination: e.g. 5C3 -> comb(5, 3)
  processed = processed.replace(/([0-9.]+)C([0-9.]+)/g, "comb($1, $2)");

  processed = processed.replace(/³√/g, "cbrt");
  processed = processed.replace(/√/g, "sqrt");
  processed = processed.replace(/π/g, "Math.PI");
  processed = processed.replace(/\be\b/g, "Math.E");
  processed = processed.replace(/×/g, "*");
  processed = processed.replace(/÷/g, "/");
  processed = processed.replace(/\^/g, "**");

  // Auto-close open parentheses
  let openCount = (processed.match(/\(/g) || []).length;
  let closeCount = (processed.match(/\)/g) || []).length;
  while (openCount > closeCount) {
    processed += ")";
    closeCount++;
  }

  const context = {
    sin: (x) => isDegreeMode ? Math.sin(x * Math.PI / 180) : Math.sin(x),
    cos: (x) => isDegreeMode ? Math.cos(x * Math.PI / 180) : Math.cos(x),
    tan: (x) => isDegreeMode ? Math.tan(x * Math.PI / 180) : Math.tan(x),
    log: (x) => Math.log10(x),
    ln: (x) => Math.log(x),
    sqrt: (x) => Math.sqrt(x),
    cbrt: (x) => Math.cbrt(x),
    fact,
    perm,
    comb,
    Math
  };

  console.log("Evaluating processed expression:", processed);
  const keys = Object.keys(context);
  const values = Object.values(context);
  const evaluator = new Function(...keys, `return ${processed}`);
  const result = evaluator(...values);
  
  if (typeof result !== "number" || isNaN(result)) {
    throw new Error("Invalid Expression");
  }
  return result;
};

const formatResult = (val) => {
  if (Number.isInteger(val)) return val.toString();
  return (Math.round(val * 1e10) / 1e10).toString();
};

// Tests
try {
  console.log("5!: ", formatResult(evaluateExpression("5!", true)));
  console.log("5P3: ", formatResult(evaluateExpression("5P3", true)));
  console.log("5C3: ", formatResult(evaluateExpression("5C3", true)));
  console.log("10^2: ", formatResult(evaluateExpression("10^2", true)));
  console.log("e^3: ", formatResult(evaluateExpression("e^3", true)));
  console.log("5! + 5C3: ", formatResult(evaluateExpression("5!+5C3", true)));
} catch (e) {
  console.error("Test failed", e);
}
