# LEOFF Helper Project Roadmap

Last updated: March 22, 2026

## Current Status

### Phase 1 - Pension Calculation Engine
Status: Implemented for LEOFF2 and PERS2

Completed:
- Dedicated LEOFF2 pension engine exists in [pensions/LEOFF2/leoff2Engine.js](/D:/LEOFF%202/pensions/LEOFF2/leoff2Engine.js)
- Dedicated PERS2 pension engine exists in [pensions/pers2/pers2Engine.js](/D:/LEOFF%202/pensions/pers2/pers2Engine.js)
- Early retirement reduction logic exists in [pensions/LEOFF2/leoff2EarlyRetirement.js](/D:/LEOFF%202/pensions/LEOFF2/leoff2EarlyRetirement.js)
- Early retirement reduction logic exists in [pensions/pers2/pers2EarlyRetirement.js](/D:/LEOFF%202/pensions/pers2/pers2EarlyRetirement.js)
- Pension registry routing exists in [pensions/pensionRegistry.js](/D:/LEOFF%202/pensions/pensionRegistry.js)
- Dashboard UI now calls the pension engine instead of calculating LEOFF pension inline
- LEOFF2 engine now exposes formal pension math functions:
  `calculateBasePension()`, `calculateEarlyRetirementReduction()`,
  `calculateTieredMultiplier()`, and `calculateMonthlyPension()`
- LEOFF2 engine now models the DRS optional `tiered multiplier` versus `2% pension + lump sum` election, and the simulator can project the one-time lump sum at retirement
- PERS2 engine now exposes formal pension math functions:
  `calculateBasePension()`, `calculateEarlyRetirementReduction()`,
  and `calculateMonthlyPension()`

Remaining:
- Add additional pension-system engines later through the registry pattern
- Continue expanding multi-pension UI support beyond the current LEOFF2 + optional PERS2 flow

### Phase 2 - Projection Engine
Status: Implemented and refactored

Completed:
- Core projection math exists in [core/incomeEngine.js](/D:/LEOFF%202/core/incomeEngine.js)
- Projection wrapper added in [core/projectionEngine.js](/D:/LEOFF%202/core/projectionEngine.js)
- Canonical simulation state builder added in [core/simulationState.js](/D:/LEOFF%202/core/simulationState.js)
- Workspace state persistence now stores canonical `simulationState` in [core/stateManager.js](/D:/LEOFF%202/core/stateManager.js)
- Standard simulator inputs can now repopulate from canonical `simulationState`
- Dashboard can rebuild from persisted canonical `simulationState` when session projection data is absent
- UI and analysis callers now route through the projection engine
- Shared simulator helpers now reduce duplication between simulator entry points in [ui/simulatorShared.js](/D:/LEOFF%202/ui/simulatorShared.js)
- Shared UI helpers now reduce duplicated input population and preview logic in [ui/simulatorUiShared.js](/D:/LEOFF%202/ui/simulatorUiShared.js)
- Shared simulator bootstrap helpers now reduce duplicated profile/module bootstrapping and asset-button setup in [ui/simulatorBootstrap.js](/D:/LEOFF%202/ui/simulatorBootstrap.js)
- Canonical simulator state now carries `Current Annual Pay` alongside final salary assumptions, allowing pay-based retirement-account accumulation to project consistently across save/restore, simulator, and dashboard flows
- Retirement account withdrawals now distinguish `401k`, `Roth 401k`, `Traditional IRA`, `Roth IRA`, and `457b` tax treatment in [core/incomeEngine.js](/D:/LEOFF%202/core/incomeEngine.js)
- Expense projection now supports split inflation across goods/services, housing, and healthcare in [core/incomeEngine.js](/D:/LEOFF%202/core/incomeEngine.js) and [core/projectionEngine.js](/D:/LEOFF%202/core/projectionEngine.js)

Remaining:
- Continue refining any remaining restore and input-prefill edge cases to canonical `simulationState`

### Phase 3 - Retirement Analysis Engine
Status: Implemented

Completed:
- Readiness score engine exists in [analysis/readinessScore.js](/D:/LEOFF%202/analysis/readinessScore.js)
- The readiness score now uses a lighter interim deterministic model focused on retirement-year income coverage, essential coverage, longevity safety, early retirement cushion, and margin strength; this is intended as a bridge until Monte Carlo modeling arrives
- Scenario comparison exists in [analysis/retirementScenarios.js](/D:/LEOFF%202/analysis/retirementScenarios.js)
- Unified analysis engine added in [analysis/retirementAnalysis.js](/D:/LEOFF%202/analysis/retirementAnalysis.js)
- Dashboard now consumes the analysis engine instead of recomputing key values inline
- V1 retirement vulnerability engine exists in [analysis/retirementVulnerability.js](/D:/LEOFF%202/analysis/retirementVulnerability.js)
- Retirement vulnerability analysis now includes richer stress categories, severity tiers, and mitigation guidance in [analysis/retirementVulnerability.js](/D:/LEOFF%202/analysis/retirementVulnerability.js)

Remaining:
- Revisit readiness scoring once Monte Carlo modeling exists so the dashboard can shift from an interim deterministic composite toward a probability-informed readiness view

### Phase 4 - Chart Engine
Status: Implemented

Completed:
- Bar chart renderer exists in [ui/chartRenderer.js](/D:/LEOFF%202/ui/chartRenderer.js)
- Timeline renderer exists in [ui/incomeTimelineRenderer.js](/D:/LEOFF%202/ui/incomeTimelineRenderer.js)
- Tooltips are supported
- Retirement markers are supported
- Asset depletion markers are supported
- Shared chart wrapper now provides one projection-chart API in [ui/projectionChart.js](/D:/LEOFF%202/ui/projectionChart.js)
- Shared chart wrapper now supports explicit dataset contracts for `incomeVsExpenses`, `pensionIncome`, and `assetsOverTime`
- Shared chart wrapper now also owns default series-color assignment, reducing caller-specific chart assumptions in [ui/projectionChart.js](/D:/LEOFF%202/ui/projectionChart.js)
- Shared chart wrapper now owns tooltip and legend target configuration, reducing page-specific renderer assumptions in [ui/projectionChart.js](/D:/LEOFF%202/ui/projectionChart.js), [ui/chartRenderer.js](/D:/LEOFF%202/ui/chartRenderer.js), and [ui/incomeTimelineRenderer.js](/D:/LEOFF%202/ui/incomeTimelineRenderer.js)
- Browser verification page exists for chart/render/state/module smoke checks in [ui/verification.html](/D:/LEOFF%202/ui/verification.html)
- Verification runner now exercises shared simulator helpers and preview metrics in [ui/verificationRunner.js](/D:/LEOFF%202/ui/verificationRunner.js)
- Verification runner now checks differentiated retirement-account tax handling in [ui/verificationRunner.js](/D:/LEOFF%202/ui/verificationRunner.js)
- Level 1 browser smoke testing now exists in [ui/verification.html](/D:/LEOFF%202/ui/verification.html) and [ui/verificationRunner.js](/D:/LEOFF%202/ui/verificationRunner.js), covering key page loads, key DOM surfaces, and image-load checks across the main public pages

### Phase 5 - Asset Modules
Status: Partially implemented

Completed:
- Asset modules exist for real estate, retirement accounts, metals, crypto, and debts
- Several modules already support edit, save, remove, and collapse behavior
- Shared collapsible card helper exists in [core/createCollapsibleCard.js](/D:/LEOFF%202/core/createCollapsibleCard.js)
- Real estate, crypto, metals, debt, and retirement account cards now use the shared helper
- Shared container resolution now normalizes restore and placement logic in [core/assetRegistry.js](/D:/LEOFF%202/core/assetRegistry.js)
- Retirement account modules now save, restore, and simulate multiple cards of the same account type more consistently in [modules/assets/taxAdvantagedAccounts.js](/D:/LEOFF%202/modules/assets/taxAdvantagedAccounts.js)
- Retirement accounts now support distinct account labels so spouse and duplicate same-type accounts are projected as separate sources in [modules/assets/taxAdvantagedAccounts.js](/D:/LEOFF%202/modules/assets/taxAdvantagedAccounts.js)
- Real estate modules now roll rent from any property type into a shared `Rental Income` category so it is counted in total income and charted consistently across the simulator/report flow in [modules/assets/realEstate.js](/D:/LEOFF%202/modules/assets/realEstate.js), [core/realEstateEngine.js](/D:/LEOFF%202/core/realEstateEngine.js), and [ui/projectionChart.js](/D:/LEOFF%202/ui/projectionChart.js)
- Real estate rent growth is now modeled separately from property appreciation, with a Washington-specific suggested default sourced from WCRER apartment-market reporting in [modules/assets/realEstate.js](/D:/LEOFF%202/modules/assets/realEstate.js) and [core/realEstateEngine.js](/D:/LEOFF%202/core/realEstateEngine.js)
- Asset/debt module state collection now skips empty modules instead of persisting null/empty noise in [core/stateManager.js](/D:/LEOFF%202/core/stateManager.js)
- Real estate, crypto, precious metals, and debt modules now restore and emit single-versus-multiple card payloads more consistently across save/restore/simulation flows
- Debt modules now emit true `expense` payloads instead of negative `income`, aligning debt treatment with the rest of the projection engine in [modules/assets/debts.js](/D:/LEOFF%202/modules/assets/debts.js) and [core/incomeEngine.js](/D:/LEOFF%202/core/incomeEngine.js)
- Shared collapsible cards now support module-level validation messaging, and current asset/debt modules now block obviously incomplete saves more gracefully in [core/createCollapsibleCard.js](/D:/LEOFF%202/core/createCollapsibleCard.js)
- Asset/debt saved-card summaries are now more consistent in tone and structure, with save-time and restore-time cards sharing the same summary builders across crypto, metals, real estate, debts, and retirement accounts
- Retirement-account projection now applies an approximate IRS-style required minimum distribution floor for eligible tax-deferred accounts at age 73+, and processes retirement-account sources in a more realistic default order in [core/incomeEngine.js](/D:/LEOFF%202/core/incomeEngine.js)
- Retirement-account cards now support employee contribution rates as `% of annual pay`, plus employer match fields on `401k` and `457b`, and the projection engine now amortizes pay from current annual pay to expected final annual pay while continuing account growth before withdrawals begin in [modules/assets/taxAdvantagedAccounts.js](/D:/LEOFF%202/modules/assets/taxAdvantagedAccounts.js), [core/incomeEngine.js](/D:/LEOFF%202/core/incomeEngine.js), and [ui/simulator.html](/D:/LEOFF%202/ui/simulator.html)

Remaining:
- Continue refining any remaining edge-case behavior across all asset/debt cards
- Deepen retirement-account withdrawal realism beyond the current baseline rules

### Phase 6 - Dashboard
Status: Implemented

Completed:
- Dashboard file exists in [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html)
- Dashboard loader exists in [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js)
- Current dashboard shows recommendation ages, readiness, chart, and financial snapshot
- Dashboard page shell and styling now align with the simulator/site visual language in [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html) and [ui/dashboard.css](/D:/LEOFF%202/ui/dashboard.css)
- Dashboard slider now reruns the report by retirement age, and recommendation logic now targets the earliest age that avoids deficits and avoids asset depletion through age 100 in [analysis/retirementScenarios.js](/D:/LEOFF%202/analysis/retirementScenarios.js) and [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js)
- Retirement summary ages now use more distinct definitions in [analysis/retirementScenarios.js](/D:/LEOFF%202/analysis/retirementScenarios.js):
  `Earliest Sustainable` focuses on solvency,
  `Financial Freedom` allows planned withdrawals while covering expenses,
  and `Recommended Retirement Age` requires expense coverage without portfolio withdrawals
- Dashboard now displays the `Largest Retirement Vulnerability` with a tooltip and stress-test explanation using [analysis/retirementVulnerability.js](/D:/LEOFF%202/analysis/retirementVulnerability.js)
- Dashboard now displays mitigation guidance and ranked secondary vulnerability output for the currently selected retirement age

Remaining:
- Continue removing remaining inline business logic from the dashboard loader

### Phase 7 - LEOFF-Specific Tools
Status: In progress

Completed / In progress:
- Retirement Age Comparison Tool page now exists in [ui/retirement-age-comparison.html](/D:/LEOFF%202/ui/retirement-age-comparison.html)
- The tool now focuses on the economic power of working longer instead of full-plan affordability
- It now uses `Birth Year` plus `LEOFF Start Year` to derive age-specific service credit and reuses birth year for Social Security timing
- It now keeps user-entered `Final Average Salary` fixed while deriving service credit from retirement year minus LEOFF start year
- It now supports `Tiered Multiplier` versus `2% Pension + Lump Sum` comparison inputs
- It now shows `% of FAS`, bridge years, deltas versus the earliest compared age, a key takeaway summary, copy/print actions, and a print-friendly comparison box
- The comparison page now includes tooltips and on-page formula guidance for the tiered multiplier and related retirement-age math
- Existing public placeholder links for `Pension Age Comparison` now route to the new tool
- Survivor Benefit Estimator page now exists in [ui/survivor-benefit-estimator.html](/D:/LEOFF%202/ui/survivor-benefit-estimator.html)
- The survivor tool now uses sampled DRS age-gap outputs to estimate joint-option reductions for `50%`, `66.67%`, and `100%` survivor choices
- The estimator now compares single life versus survivor options with a clearer decision-oriented layout: monthly-benefit comparison, give-up versus single-life framing, early/middle/late death snapshots, copy/print actions, and explicit estimator framing

Planned:
- Lifetime Pension Value Calculator
- Continue refining the Survivor Benefit Estimator toward closer DRS-table fidelity

### Phase 8 - Reports
Status: Partially implemented

Completed:
- [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html) functions as a report-style output page for retirement recommendation, projections, charting, and financial summary
- The dashboard report can now be interactively reviewed by retirement age using the slider in [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js)
- The dashboard now includes a print-focused report layer with executive summary content, print actions, and cleaner print CSS in [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html), [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js), and [ui/dashboard.css](/D:/LEOFF%202/ui/dashboard.css)
- The next five report additions are now defined in [PHASE8_REPORT_SPEC.md](/D:/LEOFF%202/PHASE8_REPORT_SPEC.md): readiness score breakdown, expense breakdown, tax snapshot, top 3 risks, and shortfall summary
- The full printable report now includes a recommendation section, readiness score breakdown, expense breakdown, tax snapshot, top 3 risks, shortfall summary, and print-only stacked bar/line charts in [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html), [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js), and [ui/dashboard.css](/D:/LEOFF%202/ui/dashboard.css)
- Browser smoke testing now verifies the new report sections on the dashboard in [ui/verificationRunner.js](/D:/LEOFF%202/ui/verificationRunner.js)
- The report now includes a browser-native PDF export flow through a dedicated `Download PDF` action on [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html) and [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js)

Remaining:
- Optional true one-click PDF generation beyond the browser print-to-PDF flow

### Phase 9 - Accounts (Premium Feature)
Status: Not implemented

Planned:
- Authentication
- Saved plans
- Scenario comparison persistence

### Phase 10 - Search Engine Optimization
Status: In progress

Completed:
- Article SEO system now exists in [ui/articles/SEO_SYSTEM.md](/D:/LEOFF%202/ui/articles/SEO_SYSTEM.md)
- Reusable SEO-ready article template now exists in [ui/articles/article-template.html](/D:/LEOFF%202/ui/articles/article-template.html)
- Published article pages now include canonical tags, keyword metadata, Open Graph metadata, Twitter metadata, and JSON-LD `Article` schema
- Article sidebars now use more systematic related-guide internal linking across the article library
- Public site pages now include canonical tags, page metadata, share metadata, and page-level schema across [ui/index.html](/D:/LEOFF%202/ui/index.html), [ui/simulator.html](/D:/LEOFF%202/ui/simulator.html), [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html), [ui/articles.html](/D:/LEOFF%202/ui/articles.html), and [ui/about.html](/D:/LEOFF%202/ui/about.html)
- Homepage retirement-guide links now point into the published article library instead of placeholder anchors
- Retirement Age Comparison now has stronger metadata, structured data, internal linking, and supporting on-page content so it can function as a real search landing page
- Long-form article coverage now includes:
  [ui/articles/article-how-leoff-2-pensions-work.html](/D:/LEOFF%202/ui/articles/article-how-leoff-2-pensions-work.html)
  and
  [ui/articles/article-when-to-get-professional-financial-help.html](/D:/LEOFF%202/ui/articles/article-when-to-get-professional-financial-help.html)
- Existing article pages now link to the Retirement Age Comparison Tool where relevant, strengthening internal linking density across the article library
- The survivor-options article now links directly into the Survivor Benefit Estimator where relevant, extending internal linking into the new Phase 7 tool

Planned:
- Technical SEO improvements for non-article pages
- Page-level keyword targeting beyond the current article library
- Internal linking strategy expansion across the full site
- Additional content support for calculator and article pages

### Phase 11 - Premium Modeling
Status: Not implemented

Planned:
- Monte Carlo simulation
- Probability-informed retirement readiness / success scoring layered on top of Monte Carlo results
- Social Security optimizer
- Estate projection
- Withdrawal strategy optimizer
- Scenario comparison

### Phase 12 - Other Device Support (Phone/Tablet)
Status: In progress

Progress:
- Shared responsive breakpoints improved for the simulator layout in [ui/simulator-dashboard.css](/D:/LEOFF%202/ui/simulator-dashboard.css)
- Dashboard panels, metrics, and tooltip layout now collapse more cleanly on phone widths in [ui/dashboard.css](/D:/LEOFF%202/ui/dashboard.css)
- Article hub and long-form article pages now have stronger phone/tablet layout behavior in [ui/articles.css](/D:/LEOFF%202/ui/articles.css) and [articles/article.css](/D:/LEOFF%202/articles/article.css)
- Simulator chart renderers now use narrower mobile padding, lighter axis labels, and tighter sampling on phone widths in [ui/chartRenderer.js](/D:/LEOFF%202/ui/chartRenderer.js) and [ui/incomeTimelineRenderer.js](/D:/LEOFF%202/ui/incomeTimelineRenderer.js)
- Simulator now has a dedicated phone-specific layout mode in [ui/simulator-dashboard.css](/D:/LEOFF%202/ui/simulator-dashboard.css) and [ui/simulator-dashboard.js](/D:/LEOFF%202/ui/simulator-dashboard.js), with reordered mobile cards, touch-friendly two-column tab navigation, and a simplified total-income-versus-expenses chart view paired with a phone-only retirement income-source summary
- Homepage feature panels have been refreshed to better match the current product mix of tools, forecasting, and guides, with cleaner card presentation in [ui/index.html](/D:/LEOFF%202/ui/index.html) and [ui/homepage.css](/D:/LEOFF%202/ui/homepage.css)

Remaining:
- Touch-friendly controls and interactions
- Responsive chart and dashboard behavior validation
- Cross-device QA for simulator, dashboard, and articles

### Phase 13 - Domain and Launch
Status: In progress

Completed:
- Production domain `leoffhelper.com` is now secured and configured through the current static-host setup
- DNS and domain routing are now configured for the live site
- The site is now published to a live production environment on GitHub Pages with the custom domain in place
- A basic deployment/update workflow now exists through Git pushes to `main`

Remaining:
- Prioritize core domains:
  - `leoffhelper.com`
  - `leoff2helper.com`
  - `leoffretirement.com`
  - `leoffplanner.com`
  - `leoff2retirement.com`
- Consider defensive redirects:
  - `leofhelper.com`
  - `leoff-helper.com`
  - `leoff2-helper.com`
  - `leoffhelper.org`
  - `leoffhelper.net`
- Verify live asset paths, SEO metadata, and public page routing after launch
- Continue hardening the deployment/update workflow for safer live releases

## Deterministic Accuracy Backlog

1. Social Security input fidelity
   Status: Implemented
   Goal: Let users enter the monthly SSA benefit number they actually know at 62, FRA, or 70 and normalize it through the shared engine.

2. Expense realism
   Status: In progress
   Goal: Separate inflation assumptions across goods/services, housing, and healthcare while improving expense-category realism.
   Progress:
   - Added `Insurance` as a distinct expense category
   - Added separate inflation assumptions for goods/services, housing, and healthcare
   - Housing and healthcare suggested defaults now use BLS-based real-world assumptions
   - Added hover tooltips explaining where the suggested defaults come from
   - Added a `Reset to Suggested Defaults` button for inflation assumptions
   - Real estate rent now rolls into a visible `Rental Income` category instead of staying hidden behind per-property assumptions
   - Existing expense categories are now classified into `essential` versus `discretionary` spending inside the projection and analysis layers

3. Tax-aware retirement withdrawals
   Status: In progress
   Goal: Improve net-income realism for pre-tax account withdrawals and bridge-year spending.
   Progress:
   - Pre-tax retirement withdrawals now use progressive incremental federal tax instead of a flat marginal estimate
   - Pension income and Social Security taxability now contribute more realistically to taxable-income stacking
   - Projection results now track estimated yearly taxes and taxable income
   - Retirement accounts now accumulate using employee contributions, employer match where applicable, expected annual returns, and a pay path that ramps from `Current Annual Pay` to expected final pay

4. Pension rule depth
   Status: Planned
   Goal: Continue deepening edge-case accuracy across LEOFF2, PERS2, and future systems.

5. Deterministic stress realism
   Status: Planned
   Goal: Add stronger non-Monte-Carlo sequences like stagnant-decade and early-retirement recession paths.
   Progress:
   - Late-life expense stress now separately tests healthcare, insurance, and housing pressure in the vulnerability engine

## Immediate Next Steps

-> 1. Continue refining the Survivor Benefit Estimator so it becomes easier to trust and easier to choose from at a glance.
2. Verify the updated essential-versus-discretionary expense behavior in real UI runs and decide whether users need manual category overrides.
3. Keep deepening Phase 8 report polish now that printable report, PDF export, and report detail sections are in place.
