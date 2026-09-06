import pytest
from job_dashboard.offer_analytics import (
    detect_seniority,
    detect_sector_track,
    calculate_australian_tax,
    calculate_compensation_benchmark,
    scan_employment_contract_risks,
    STATUTORY_SUPERANNUATION_RATE,
)


def test_detect_seniority_tiers():
    assert detect_seniority("Junior Software Developer") == "junior"
    assert detect_seniority("Graduate Registered Nurse") == "junior"
    assert detect_seniority("Systems Engineer") == "mid"
    assert detect_seniority("Senior Financial Accountant") == "senior"
    assert detect_seniority("Site Coordinator") == "senior"
    assert detect_seniority("Principal Cloud Architect") == "lead"
    assert detect_seniority("Head of Legal & Compliance") == "lead"


def test_detect_sector_track():
    assert detect_sector_track("Clinical Nurse Specialist") == "healthcare"
    assert detect_sector_track("Commercial Construction Site Supervisor") == "trades"
    assert detect_sector_track("CPA Senior Tax Accountant") == "finance"
    assert detect_sector_track("Senior Legal Counsel") == "legal"
    assert detect_sector_track("Azure DevOps Cloud Engineer") == "technology"
    assert detect_sector_track("General Operations Officer") == "general"


def test_calculate_australian_tax():
    # Below tax-free threshold
    low_inc = calculate_australian_tax(15000)
    assert low_inc["income_tax"] == 0.0
    assert low_inc["net_annual"] == 15000.0

    # Middle income ($90,000)
    # Tax: $4,288 + 30% of ($90,000 - $45,000) = $4,288 + $13,500 = $17,788
    # Medicare (2%): $1,800. Total = $19,588
    mid_inc = calculate_australian_tax(90000)
    assert mid_inc["income_tax"] == 17788.0
    assert mid_inc["medicare_levy"] == 1800.0
    assert mid_inc["total_tax"] == 19588.0
    assert mid_inc["net_annual"] == 70412.0
    assert mid_inc["net_monthly"] == round(70412.0 / 12, 2)
    assert mid_inc["effective_tax_rate_percent"] == 21.8

    # High income ($200,000)
    high_inc = calculate_australian_tax(200000)
    assert high_inc["gross_annual"] == 200000.0
    assert high_inc["total_tax"] > 50000.0
    assert high_inc["net_annual"] < 150000.0


def test_calculate_compensation_benchmark_multi_industry():
    # 1. Tech Senior: $180,000 base
    tech = calculate_compensation_benchmark(180000, role_title="Senior Cloud Engineer", sector="technology")
    assert tech["sector"] == "technology"
    assert tech["seniority"] == "senior"
    assert tech["actual_base_salary"] == 180000.0
    assert tech["superannuation_amount"] == 180000.0 * STATUTORY_SUPERANNUATION_RATE
    assert tech["percentile"] == 50
    assert "Competitive" in tech["verdict"]

    # 2. Healthcare Mid: $108,000 base
    health = calculate_compensation_benchmark(108000, role_title="Registered Nurse", sector="healthcare")
    assert health["sector"] == "healthcare"
    assert health["seniority"] == "mid"
    assert health["percentile"] == 50

    # 3. Finance Senior: $168,000 base
    fin = calculate_compensation_benchmark(168000, role_title="Senior Accountant", sector="finance")
    assert fin["sector"] == "finance"
    assert fin["seniority"] == "senior"
    assert fin["percentile"] == 50

    # 4. Trades Mid: $115,000 base
    trade = calculate_compensation_benchmark(115000, role_title="Site Supervisor", sector="trades")
    assert trade["sector"] == "trades"
    assert trade["percentile"] == 50

    # 5. Legal Senior: $215,000 base
    legal = calculate_compensation_benchmark(215000, role_title="Senior Legal Counsel", sector="legal")
    assert legal["sector"] == "legal"
    assert legal["percentile"] == 50

    # 6. Super included calculation
    package_deal = calculate_compensation_benchmark(111500, role_title="Systems Administrator", super_included=True)
    assert round(package_deal["actual_base_salary"]) == 100000
    assert round(package_deal["superannuation_amount"]) == 11500
    assert package_deal["total_remuneration_package"] == 111500.0


def test_scan_employment_contract_risks():
    clean_contract = """
    This agreement outlines terms of employment. Standard working hours are 38 hours per week.
    Employees are entitled to 4 weeks annual leave and standard National Employment Standards.
    Mutual notice period is 4 weeks.
    """
    clean_result = scan_employment_contract_risks(clean_contract)
    assert clean_result["contract_safety_score"] == 100
    assert clean_result["total_flags"] == 0
    assert clean_result["risk_rating"] == "Low Risk (Standard Contract)"

    onerous_contract = """
    1. Restraint: The employee agrees to a restraint period of 12 months across 50 km prohibiting
       any employment with any competitor or similar entity in the industry.
    2. Intellectual Property: All intellectual property created at any time whether during or outside working hours
       by the employee shall belong exclusively to the company.
    3. Working Hours: Salary is in full satisfaction of all hours worked, and employee may be required
       to work reasonable additional hours with no overtime penalty or additional remuneration.
    4. Termination: Employee shall provide 8 weeks notice before resigning, while company may terminate with 1 week notice.
    """
    risky_result = scan_employment_contract_risks(onerous_contract)
    assert risky_result["contract_safety_score"] < 50
    assert risky_result["high_risk_count"] >= 3
    assert risky_result["risk_rating"] == "High Risk (Careful Redline Required)"

    categories = [f["category"] for f in risky_result["flags"]]
    assert "Restraint of Trade / Non-Compete" in categories
    assert "Intellectual Property Ownership" in categories
    assert "Working Hours & Overtime" in categories
    assert "Termination & Notice" in categories

    # Verify Fair Work guidance is provided for each flag
    for flag in risky_result["flags"]:
        assert len(flag["fair_work_guidance"]) > 10
        assert len(flag["recommended_counter"]) > 10

