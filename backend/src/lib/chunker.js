// Splits a contract into clause-sized chunks for retrieval.
const SECTION_PATTERN = new RegExp(
  "^(?:" +
    "(?:Article|Section|Clause)\\s+\\d+[\\.\\d]*[:\\s]" + // Article 1, Section 2.1:
    "|(?:\\d+\\.)+\\d*\\s+[A-Z]" + //                     1.1 Something
    "|\\d+\\.\\s+[A-Z][A-Za-z]" + //                      1. Something
    "|[IVXLCDM]+\\.\\s+[A-Z]" + //                        IV. Something
    "|[A-Z][A-Z\\s\\-]{4,}(?=\\n)" + //                   ALL CAPS HEADING
  ")",
  "gm",
);

const MAX_CHUNK = 2000;
const MIN_CHUNK = 50;

export function splitClauses(rawText) {
  const splits = [...rawText.matchAll(SECTION_PATTERN)];
  let chunks = [];

  if (splits.length >= 3) {
    splits.forEach((match, i) => {
      const end = i + 1 < splits.length ? splits[i + 1].index : rawText.length;
      let text = rawText.slice(match.index, end).trim();
      if (text.length < MIN_CHUNK) return;

      if (text.length > MAX_CHUNK) {
        const cut = text.lastIndexOf("\n\n", MAX_CHUNK);
        text = text.slice(0, cut > 0 ? cut : MAX_CHUNK);
      }
      chunks.push({
        id: `clause_${String(i).padStart(2, "0")}`,
        heading: text.split("\n", 1)[0].trim().slice(0, 80),
        text,
      });
    });
  }

  // Fallback: paragraph splitting when the document has no recognisable structure.
  if (chunks.length < 3) {
    chunks = rawText
      .split("\n\n")
      .map((p) => p.trim())
      .filter((p) => p.length >= MIN_CHUNK)
      .slice(0, 30)
      .map((p, i) => ({
        id: `para_${String(i).padStart(2, "0")}`,
        heading: `Section ${i + 1}`,
        text: p.slice(0, MAX_CHUNK),
      }));
  }
  return chunks;
}
