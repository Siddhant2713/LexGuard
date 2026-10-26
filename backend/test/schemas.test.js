import { test } from "node:test";
import assert from "node:assert/strict";
import { RiskAnalysis, Pass1Result, RawClause } from "../src/lib/schemas.js";

const base = {
  clause_id: "c1", severity: "high", risk_type: "Broad IP", affects: ["income"],
  plain_english: "Risky.", consequence: "If you sign this, you lose IP.", red_flags: [], negotiation_tip: "Ask.",
};

test("consequence gets the required prefix", () => {
  const r = RiskAnalysis.parse({ ...base, consequence: "you may lose your IP rights." });
  assert.ok(r.consequence.startsWith("If you sign this"));
});

test("correct consequence is unchanged", () => {
  assert.equal(RiskAnalysis.parse(base).consequence, base.consequence);
});

test("unknown severity/category are coerced", () => {
  assert.equal(RiskAnalysis.parse({ ...base, severity: "SEVERE" }).severity, "medium");
  const c = RawClause.parse({ id: "a", heading: "h", text: "t", category: "Non-Compete", suspicion_score: "7" });
  assert.equal(c.category, "non_compete");
  assert.equal(c.suspicion_score, 7);
});

test("Pass1Result requires clauses", () => {
  assert.throws(() => Pass1Result.parse({ document_type: "", parties: [], clauses: null }));
});
