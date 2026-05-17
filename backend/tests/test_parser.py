import pytest
from parser import extract_document

def test_extract_unsupported():
    with pytest.raises(ValueError, match="Unsupported file type"):
        extract_document(b"dummy", "test.txt")
