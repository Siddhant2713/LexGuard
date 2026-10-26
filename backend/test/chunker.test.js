import { test } from "node:test";
import assert from "node:assert/strict";
import { splitClauses } from "../src/lib/chunker.js";

const CONTRACT = `
1. EMPLOYMENT RELATIONSHIP
The Company hereby employs Employee as a Software Engineer on an at-will basis.
This is a legal employment agreement between the parties.

2. INTELLECTUAL PROPERTY ASSIGNMENT
Employee agrees that all inventions, discoveries, and works of authorship,
whether or not patentable, that Employee conceives or creates during employment
shall be the sole and exclusive property of the Company.

NON-COMPETE RESTRICTION
During employment and for 24 months thereafter, Employee shall not engage
in any business activity that competes directly with the Company anywhere globally.
`;

test("finds numbered sections", () => {
  assert.ok(splitClauses(CONTRACT).length >= 2);
});

test("finds ALL CAPS headings", () => {
  assert.ok(splitClauses(CONTRACT).some((c) => c.heading.includes("NON-COMPETE")));
});

test("drops chunks under 50 chars", () => {
  for (const c of splitClauses(CONTRACT)) assert.ok(c.text.length >= 50);
});

test("truncates oversized chunks", () => {
  const big = "1. BIG SECTION\n" + "x ".repeat(1500);
  for (const c of splitClauses(big)) assert.ok(c.text.length <= 2001);
});
