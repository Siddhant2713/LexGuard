import pytest
from schemas import RiskAnalysis, Pass1Result, AggregationResult, RawClause


def test_consequence_auto_prefix():
    r = RiskAnalysis(
        clause_id="c1",
        severity="high",
        risk_type="Broad IP",
        affects=["income"],
        plain_english="This clause is risky.",
        consequence="you may lose your IP rights.",  # missing prefix
        red_flags=[],
        negotiation_tip="Ask for a carve-out.",
    )
    assert r.consequence.startswith("If you sign this")


def test_consequence_unchanged_if_correct():
    r = RiskAnalysis(
        clause_id="c2",
        severity="critical",
        risk_type="Non-compete",
        affects=["employment"],
        plain_english="You cannot work for competitors.",
        consequence="If you sign this, you cannot work for any competitor for 2 years.",
        red_flags=["work for competitors"],
        negotiation_tip="Limit scope to direct competitors only.",
    )
    assert r.consequence.startswith("If you sign this, you cannot")


def test_severity_enum_valid():
    for sev in ["critical", "high", "medium", "low"]:
        r = RiskAnalysis(
            clause_id="c1", severity=sev, risk_type="Test",
            affects=[], plain_english="x", consequence="If you sign this, x.",
            red_flags=[], negotiation_tip="x"
        )
        assert r.severity.value == sev


def test_pass1_result_requires_clauses():
    with pytest.raises(Exception):
        Pass1Result(document_type="", parties=[], clauses=None)
