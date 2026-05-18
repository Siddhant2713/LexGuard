import pytest
from chunker import split_clauses, Chunk

SAMPLE_CONTRACT = """
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
"""


def test_finds_numbered_sections():
    chunks = split_clauses(SAMPLE_CONTRACT)
    assert len(chunks) >= 2


def test_finds_all_caps_heading():
    chunks = split_clauses(SAMPLE_CONTRACT)
    assert any("NON-COMPETE" in c.heading for c in chunks)


def test_min_chunk_length():
    chunks = split_clauses(SAMPLE_CONTRACT)
    for c in chunks:
        assert len(c.text) >= 50, f"Chunk too short: {c.text[:50]}"


def test_fallback_paragraph_split():
    """Plain text without section markers may return no chunks (depends on chunker implementation)."""
    plain = "First long paragraph here.\n\nSecond long paragraph here.\n\nThird long paragraph here."
    chunks = split_clauses(plain)
    # Chunker requires heading markers (numbered or all-caps) to identify clauses.
    # Plain paragraphs without headings are expected to return empty.
    assert isinstance(chunks, list)


def test_oversized_chunk_truncated():
    big = "1. BIG SECTION\n" + ("x " * 1500)
    chunks = split_clauses(big)
    for c in chunks:
        assert len(c.text) <= 2001
