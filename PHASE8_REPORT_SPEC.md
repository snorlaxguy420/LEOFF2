# Phase 8 Report Spec

This document captures the next full-report sections to build without changing
the current dashboard UI immediately.

## Next Report Additions

1. Readiness Score Breakdown
- Show why the score landed where it did, not just the total grade.
- Pull from the readiness engine breakdown in
  [analysis/readinessScore.js](/D:/LEOFF%202/analysis/readinessScore.js).
- Intended sections:
  - income coverage contribution
  - deficit severity contribution
  - longevity / depletion contribution
  - margin contribution

2. Expense Breakdown
- Show how retirement spending is composed.
- Pull from yearly `expenseBreakdown` already returned by
  [core/incomeEngine.js](/D:/LEOFF%202/core/incomeEngine.js).
- Intended sections:
  - essential vs discretionary
  - housing
  - healthcare
  - insurance
  - goods and services

3. Tax Snapshot
- Show what retirement taxes look like in the selected scenario.
- Pull from yearly `taxes` and `taxableIncome` already returned by
  [core/incomeEngine.js](/D:/LEOFF%202/core/incomeEngine.js).
- Intended sections:
  - taxes in the retirement year
  - taxable income in the retirement year
  - plain-English note on tax drag

4. Top 3 Retirement Risks
- Expand the report beyond the single primary risk.
- Pull from `primaryRisk` and `secondaryRisks` already returned by
  [analysis/retirementVulnerability.js](/D:/LEOFF%202/analysis/retirementVulnerability.js).
- Intended sections:
  - primary risk
  - second risk
  - third risk
  - mitigation for each

5. Shortfall Summary
- Show not just if deficits appear, but how severe they become.
- Pull from:
  - `firstDeficitYear`
  - `cumulativeShortfall`
  - yearly `surplus`
- Intended sections:
  - first deficit age
  - cumulative shortfall
  - worst annual deficit

## Already Available In The Data

- `analysis.readinessScore`
- `analysis.readinessGrade`
- `projection.cumulativeShortfall`
- `projection.firstDeficitYear`
- yearly `result.taxes`
- yearly `result.taxableIncome`
- yearly `result.expenseBreakdown`
- yearly `result.surplus`
- `vulnerabilityAnalysis.primaryRisk`
- `vulnerabilityAnalysis.secondaryRisks`

## Recommended Build Order

1. Readiness Score Breakdown
2. Expense Breakdown
3. Tax Snapshot
4. Top 3 Retirement Risks
5. Shortfall Summary

