import { test } from "node:test";
import assert from "node:assert/strict";
import { extractDocument, hasValidMagic } from "../src/lib/parser.js";

test("rejects unsupported extension", async () => {
  await assert.rejects(extractDocument(Buffer.from("x"), "contract.xlsx"), /Unsupported file type/);
});

test("magic bytes accept PDF/DOCX and reject others", () => {
  assert.ok(hasValidMagic(Buffer.from("%PDF-1.7")));
  assert.ok(hasValidMagic(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0])));
  assert.ok(!hasValidMagic(Buffer.from("hello")));
});
