// Clause-level diff between two versions of a contract. Pure functions, no I/O.
//
// Clauses are paired in two rounds: first by heading ("7. Relocation" ↔ "8. Relocation
// allowance" both normalize to start with "relocation"), then the leftovers by word overlap, so
// renumbered or retitled clauses still pair up. Unpaired clauses are added or removed.

const MIN_SIMILARITY = 0.45;
const MAX_DIFF_WORDS = 700;

// "Section 7.2: Relocation Allowance." → "relocation allowance"
export function normalizeHeading(heading) {
  return String(heading ?? "")
    .toLowerCase()
    .replace(/^\s*(?:article|section|clause)\s+/, "")
    .replace(/^\s*(?:[ivxlcdm]+|\d+(?:\.\d+)*)[.):\s]+/, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The paragraph fallback in chunker.js names chunks "Section 1", "Section 2"…, which says
// nothing about their content, so those never pair by heading.
const isGenericHeading = (h) => !h || /^section \d+$/.test(h);

const words = (text) => String(text ?? "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const normalizeText = (text) => words(text).join(" ");

/** Jaccard overlap of the two texts' word sets, 0–1. */
export function similarity(a, b) {
  const A = new Set(words(a));
  const B = new Set(words(b));
  if (!A.size && !B.size) return 1;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / (A.size + B.size - shared);
}

/**
 * Word-level diff as runs of { op: "same" | "add" | "del", text }. Longest common subsequence
 * over whitespace-separated tokens; very long clauses fall back to a whole replace.
 */
export function wordDiff(before, after) {
  const a = String(before ?? "").split(/(\s+)/).filter(Boolean);
  const b = String(after ?? "").split(/(\s+)/).filter(Boolean);
  if (a.length > MAX_DIFF_WORDS * 2 || b.length > MAX_DIFF_WORDS * 2) {
    return [{ op: "del", text: before }, { op: "add", text: after }];
  }
  const eq = (x, y) => x === y || (/^\s+$/.test(x) && /^\s+$/.test(y));
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = eq(a[i], b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out = [];
  const push = (op, text) => {
    const last = out[out.length - 1];
    if (last?.op === op) last.text += text;
    else out.push({ op, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) { push("same", b[j]); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) push("del", a[i++]);
    else push("add", b[j++]);
  }
  while (i < n) push("del", a[i++]);
  while (j < m) push("add", b[j++]);
  return out;
}

/**
 * @param base    [{ heading, text }] clauses of the original, in document order
 * @param revised [{ heading, text }] clauses of the new version, in document order
 * @returns { changes, unchanged } where each change is
 *   { key, kind: "added" | "removed" | "changed", heading, before, after, similarity, diff }
 */
export function diffClauses(base, revised) {
  const pairOf = new Map(); // revised index → base index
  const usedBase = new Set();

  // Round 1: same heading, nearest position wins when a heading repeats.
  const byHeading = new Map();
  base.forEach((c, i) => {
    const h = normalizeHeading(c.heading);
    if (isGenericHeading(h)) return;
    if (!byHeading.has(h)) byHeading.set(h, []);
    byHeading.get(h).push(i);
  });
  revised.forEach((c, j) => {
    const h = normalizeHeading(c.heading);
    const options = (byHeading.get(h) ?? []).filter((i) => !usedBase.has(i));
    if (isGenericHeading(h) || !options.length) return;
    const i = options.reduce((best, k) => (Math.abs(k - j) < Math.abs(best - j) ? k : best));
    pairOf.set(j, i);
    usedBase.add(i);
  });

  // Round 2: greedy by word overlap among what's left.
  const candidates = [];
  revised.forEach((r, j) => {
    if (pairOf.has(j)) return;
    base.forEach((b, i) => {
      if (usedBase.has(i)) return;
      const s = similarity(b.text, r.text);
      if (s >= MIN_SIMILARITY) candidates.push({ i, j, s });
    });
  });
  candidates.sort((x, y) => y.s - x.s);
  for (const { i, j } of candidates) {
    if (pairOf.has(j) || usedBase.has(i)) continue;
    pairOf.set(j, i);
    usedBase.add(i);
  }

  const changes = [];
  let unchanged = 0;
  revised.forEach((r, j) => {
    if (!pairOf.has(j)) {
      changes.push({ key: `r${j}`, kind: "added", heading: r.heading, before: null, after: r.text, similarity: 0, diff: null });
      return;
    }
    const b = base[pairOf.get(j)];
    if (normalizeText(b.text) === normalizeText(r.text)) {
      unchanged++;
      return;
    }
    changes.push({
      key: `r${j}`,
      kind: "changed",
      heading: r.heading,
      before: b.text,
      after: r.text,
      similarity: Number(similarity(b.text, r.text).toFixed(3)),
      diff: wordDiff(b.text, r.text),
    });
  });
  base.forEach((b, i) => {
    if (!usedBase.has(i)) changes.push({ key: `b${i}`, kind: "removed", heading: b.heading, before: b.text, after: null, similarity: 0, diff: null });
  });
  return { changes, unchanged };
}

/**
 * Pairs each version's flagged risks by clause heading, then by risk type.
 * @param base/revised [{ heading, risk_type, severity }]
 */
export function diffRisks(base, revised) {
  const keyOf = (r) => normalizeHeading(r.heading) || normalizeHeading(r.risk_type);
  const left = [...base];
  const rows = revised.map((r) => {
    let i = left.findIndex((b) => keyOf(b) && keyOf(b) === keyOf(r));
    if (i < 0) i = left.findIndex((b) => normalizeHeading(b.risk_type) === normalizeHeading(r.risk_type));
    const b = i >= 0 ? left.splice(i, 1)[0] : null;
    return { heading: r.heading, risk_type: r.risk_type, before: b?.severity ?? null, after: r.severity };
  });
  for (const b of left) rows.push({ heading: b.heading, risk_type: b.risk_type, before: b.severity, after: null });
  return rows;
}
