import { test } from "node:test";
import assert from "node:assert/strict";
import { diffClauses, diffRisks, normalizeHeading, similarity, wordDiff } from "../src/lib/compare.js";

test("headings normalize away numbering and punctuation", () => {
  assert.equal(normalizeHeading("Section 7.2: Relocation Allowance."), "relocation allowance");
  assert.equal(normalizeHeading("IV. Termination"), "termination");
  assert.equal(normalizeHeading("12) Non-Compete"), "non compete");
});

test("similarity is word-set overlap", () => {
  assert.equal(similarity("a b c", "a b c"), 1);
  assert.equal(similarity("a b", "c d"), 0);
  assert.ok(Math.abs(similarity("a b c", "a b d") - 0.5) < 1e-9);
});

test("wordDiff reconstructs both sides", () => {
  const before = "Employee shall not compete for 24 months anywhere.";
  const after = "Employee shall not compete for 6 months in Bengaluru.";
  const d = wordDiff(before, after);
  assert.equal(d.filter((r) => r.op !== "add").map((r) => r.text).join(""), before);
  assert.equal(d.filter((r) => r.op !== "del").map((r) => r.text).join(""), after);
  assert.ok(d.some((r) => r.op === "del" && r.text.includes("24")));
  assert.ok(d.some((r) => r.op === "add" && r.text.includes("6")));
});

test("diffClauses pairs renumbered clauses and finds added, removed and changed", () => {
  const base = [
    { heading: "1. Position", text: "You will work as a software engineer." },
    { heading: "2. Relocation", text: "You must repay the full relocation allowance if you leave within 18 months." },
    { heading: "3. Arbitration", text: "All disputes go to binding arbitration." },
  ];
  const revised = [
    { heading: "1. Position", text: "You will work as a software engineer." },
    { heading: "2. Remote work", text: "You may work remotely two days a week." },
    { heading: "3. Relocation", text: "You must repay half of the relocation allowance if you leave within 12 months." },
  ];
  const { changes, unchanged } = diffClauses(base, revised);
  assert.equal(unchanged, 1);
  const kinds = Object.fromEntries(changes.map((c) => [c.heading, c.kind]));
  assert.deepEqual(kinds, { "2. Remote work": "added", "3. Relocation": "changed", "3. Arbitration": "removed" });
  assert.ok(changes.find((c) => c.kind === "changed").diff.length > 1);
});

test("diffClauses pairs retitled clauses by content", () => {
  const text = "Either party may terminate this agreement with thirty days written notice to the other party.";
  const { changes, unchanged } = diffClauses([{ heading: "Section 1", text }], [{ heading: "Section 4", text: text.replace("thirty", "sixty") }]);
  assert.equal(unchanged, 0);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].kind, "changed");
});

test("diffRisks lines up severities across versions", () => {
  const rows = diffRisks(
    [{ heading: "9. Non-compete", risk_type: "Worldwide non-compete", severity: "critical" }, { heading: "Arbitration", risk_type: "Forced arbitration", severity: "high" }],
    [{ heading: "10. Non-compete", risk_type: "Local non-compete", severity: "medium" }],
  );
  assert.deepEqual(rows.map((r) => [r.before, r.after]), [["critical", "medium"], ["high", null]]);
});
