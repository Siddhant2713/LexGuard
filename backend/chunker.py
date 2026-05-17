import re
from dataclasses import dataclass, field


@dataclass
class Chunk:
    id: str
    heading: str
    text: str
    page_ref: int = 0


# Patterns that indicate the start of a new clause/section
_SECTION_PATTERN = re.compile(
    r"""(?mx)                          # multiline, verbose
    ^(?:
        (?:Article|Section|Clause)\s+\d+[\.\d]*[:\s]  # Article 1, Section 2.1:
        | (?:\d+\.)+\d*\s+[A-Z]                        # 1.1 Something
        | \d+\.\s+[A-Z][A-Za-z]                        # 1. Something
        | [A-Z][A-Z\s\-]{4,}(?=\n)                     # ALL CAPS HEADING
    )
    """,
)


def split_clauses(raw_text: str) -> list[Chunk]:
    """
    Split a contract into semantically meaningful clause chunks.

    Strategy:
    1. Regex-based splitting on structural markers (numbered sections, ALL CAPS headings)
    2. Fallback to paragraph splitting if regex finds < 3 chunks
    3. Skip chunks shorter than 50 chars
    4. Split chunks longer than 2000 chars at paragraph boundaries
    """
    splits = list(_SECTION_PATTERN.finditer(raw_text))
    chunks: list[Chunk] = []

    if len(splits) >= 3:
        for i, match in enumerate(splits):
            start = match.start()
            end = splits[i + 1].start() if i + 1 < len(splits) else len(raw_text)
            chunk_text = raw_text[start:end].strip()

            if len(chunk_text) < 50:
                continue

            # Truncate oversized chunks at paragraph boundary
            if len(chunk_text) > 2000:
                truncate_at = chunk_text.rfind("\n\n", 0, 2000)
                chunk_text = chunk_text[: truncate_at if truncate_at > 0 else 2000]

            heading = match.group(0).strip()[:80]
            chunks.append(Chunk(id=f"clause_{i:02d}", heading=heading, text=chunk_text))

    # Fallback: paragraph-based splitting
    if len(chunks) < 3:
        paragraphs = [p.strip() for p in raw_text.split("\n\n") if len(p.strip()) >= 50]
        chunks = [
            Chunk(
                id=f"para_{i:02d}",
                heading=f"Section {i + 1}",
                text=p[:2000],
            )
            for i, p in enumerate(paragraphs[:30])
        ]

    return chunks
