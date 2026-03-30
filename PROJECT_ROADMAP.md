# LEOFF Helper Project Roadmap

Last updated: March 30, 2026

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
- Canonical state round-tripping now preserves birth month, birth year, and marital-status profile fields needed for trustworthy simulator fallback restores, and shared simulator prefill now restores dependent UI state such as spouse visibility, Social Security optimize, and survivor-option visibility in [core/simulationState.js](/D:/LEOFF%202/core/simulationState.js) and [ui/simulatorUiShared.js](/D:/LEOFF%202/ui/simulatorUiShared.js)

Remaining:
- No major standalone Phase 2 items remain beyond incidental restore/input-prefill bugs discovered during future QA

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
- Shared dashboard view-model helpers now own more of the dashboard-specific recommendation, report, and summary derivation in [analysis/dashboardViewModel.js](/D:/LEOFF%202/analysis/dashboardViewModel.js), reducing inline business logic in [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js)
- Probability-informed readiness scoring now exists for Monte Carlo Plus, blending deterministic coverage/longevity math with a dedicated Monte Carlo durability component so premium dashboard scores react to success odds and failure timing instead of deterministic projections alone in [analysis/readinessScore.js](/D:/LEOFF%202/analysis/readinessScore.js), [analysis/retirementAnalysis.js](/D:/LEOFF%202/analysis/retirementAnalysis.js), and [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js)
- Readiness labels now use plain-language bands instead of letter grades, with user-facing `Durable`, `Strong`, `Workable`, and `Fragile` states reflected in [analysis/readinessScore.js](/D:/LEOFF%202/analysis/readinessScore.js), [analysis/dashboardViewModel.js](/D:/LEOFF%202/analysis/dashboardViewModel.js), [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html), and [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js)

Remaining:
- No major standalone Phase 3 items remain beyond ongoing score tuning and trust-language refinement already tracked under Phase 11

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
- Verification coverage now includes dashboard recommendation consistency, dashboard age-order integrity, dashboard age-adjusted pension/source behavior, retirement-age comparison monotonicity, survivor-estimator ordering, and Monte Carlo regression checks in [ui/verificationRunner.js](/D:/LEOFF%202/ui/verificationRunner.js)

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
- Retirement-age recommendations no longer scan or recommend ages below the user's current age in [analysis/retirementScenarios.js](/D:/LEOFF%202/analysis/retirementScenarios.js), with browser verification coverage in [ui/verificationRunner.js](/D:/LEOFF%202/ui/verificationRunner.js)
- Dashboard recommendation messaging now avoids showing `Not Achievable` for scenarios that still cover expenses but rely on planned portfolio withdrawals, instead falling back to the strongest available displayed timing in [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js)
- Dashboard retirement-age slider and related actions now live within the timeline/chart panel instead of a separate top control bar, improving chart-context alignment in [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html) and [ui/dashboard.css](/D:/LEOFF%202/ui/dashboard.css)
- Dashboard now includes a dedicated Monte Carlo Outlook section, separate from the deterministic chart toggle, with stress-tested success, essential-coverage, failure-age, depletion-age, and net-worth-range summaries in [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html), [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js), and [analysis/dashboardViewModel.js](/D:/LEOFF%202/analysis/dashboardViewModel.js)
- Dashboard retirement-age slider modeling now adjusts pension service credit, pension salary assumptions, and retirement-linked portfolio withdrawal timing so later retirement ages compare against the correct retirement start assumptions in [analysis/dashboardViewModel.js](/D:/LEOFF%202/analysis/dashboardViewModel.js), [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js), and [analysis/monteCarloEngine.js](/D:/LEOFF%202/analysis/monteCarloEngine.js)
- Recommended retirement age now requires the earliest age that both avoids portfolio-withdrawal dependence and clears a `90%` Monte Carlo success threshold in [analysis/retirementScenarios.js](/D:/LEOFF%202/analysis/retirementScenarios.js), with supporting dashboard copy and regression coverage in [analysis/dashboardViewModel.js](/D:/LEOFF%202/analysis/dashboardViewModel.js) and [ui/verificationRunner.js](/D:/LEOFF%202/ui/verificationRunner.js)

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
- Lifetime Pension Value Calculator page now exists in [ui/lifetime-pension-value-calculator.html](/D:/LEOFF%202/ui/lifetime-pension-value-calculator.html)
- The lifetime-value tool now estimates service credit from `Birth Year`, `Retirement Age`, and `LEOFF Start Year`, then shows monthly pension, annual pension, `% of FAS`, cumulative pension value through a target age, and optional lump-sum-inclusive totals
- The lifetime-value tool now includes milestone payout checkpoints, copy/print actions, and a one-more-year tradeoff summary so members can see both pension scale and the cost/benefit of waiting
- Homepage, supporting tool pages, and the articles hub now link into the Lifetime Pension Value Calculator, improving discoverability and internal linking for the new Phase 7 tool
- Homepage hero now includes a direct launch CTA for the Survivor Benefit Comparison tool, improving discoverability of the estimator from the main landing page in [ui/index.html](/D:/LEOFF%202/ui/index.html) and [ui/homepage.css](/D:/LEOFF%202/ui/homepage.css)

Planned:
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
Status: In progress

Completed / In progress:
- A standalone backend service now exists in [backend/src/server.js](/D:/LEOFF%202/backend/src/server.js) and [backend/src/app.js](/D:/LEOFF%202/backend/src/app.js), with session-based auth and plan CRUD routes for account work
- The live API is now deployed behind `https://api.leoffhelper.com`, giving the project a real backend entry point for account features
- The login page now supports real email/password account creation, sign-in, session restore, and logout through [ui/login.html](/D:/LEOFF%202/ui/login.html), [ui/login.js](/D:/LEOFF%202/ui/login.js), and [ui/apiClient.js](/D:/LEOFF%202/ui/apiClient.js)
- Simulator import/export remains available as a non-backend backup path, while account-backed plan syncing is now wired into the simulator shell through [ui/simulator.html](/D:/LEOFF%202/ui/simulator.html) and [ui/simulator-dashboard.js](/D:/LEOFF%202/ui/simulator-dashboard.js)
- Account plans can now persist full `workspaceState`, not just `simulationState`, so asset/debt module cards restore more faithfully across saved sessions in [backend/src/app.js](/D:/LEOFF%202/backend/src/app.js)
- Shared site headers now support logged-in account state, showing `Welcome, <username>` plus `LOG OUT` instead of `LOG IN`, through [ui/authHeader.js](/D:/LEOFF%202/ui/authHeader.js) and the public page shells
- Accounts now use a 15-minute inactivity timeout with backend sliding-session refresh behavior in [backend/src/app.js](/D:/LEOFF%202/backend/src/app.js), [backend/src/config.js](/D:/LEOFF%202/backend/src/config.js), and [ui/authHeader.js](/D:/LEOFF%202/ui/authHeader.js)
- The account page now includes a real settings surface for preferred name, visible session-policy details, session refresh, and in-session password updates through [ui/login.html](/D:/LEOFF%202/ui/login.html), [ui/login.js](/D:/LEOFF%202/ui/login.js), [ui/apiClient.js](/D:/LEOFF%202/ui/apiClient.js), and [backend/src/app.js](/D:/LEOFF%202/backend/src/app.js)
- New registrations now trigger an automated account-created email with a simulator/login return path, using the same outbound email configuration and local log fallback as password recovery, through [backend/src/app.js](/D:/LEOFF%202/backend/src/app.js) and [backend/src/lib/email.js](/D:/LEOFF%202/backend/src/lib/email.js)
- Out-of-session password recovery now exists through token-based reset links, with configurable outbound email delivery plus a server-log fallback for local/dev testing, in [backend/src/app.js](/D:/LEOFF%202/backend/src/app.js), [backend/src/lib/email.js](/D:/LEOFF%202/backend/src/lib/email.js), [ui/login.html](/D:/LEOFF%202/ui/login.html), [ui/login.js](/D:/LEOFF%202/ui/login.js), and [ui/apiClient.js](/D:/LEOFF%202/ui/apiClient.js)
- The live Lightsail backend now has production email env configuration for `RESEND_API_KEY`, `EMAIL_FROM`, and `PUBLIC_SITE_URL`, and the deployed API on `https://api.leoffhelper.com` is healthy on the current password-recovery build
- Production password recovery has now been live-verified end to end against `https://api.leoffhelper.com`, with Resend-backed forgot-password requests successfully accepted for a real production account
- The simulator now includes a first-pass `My Scenarios` account surface with clearer synced-scenario framing, current save-target messaging, rename, duplicate, delete, and reopen flows in [ui/simulator.html](/D:/LEOFF%202/ui/simulator.html), [ui/simulator-dashboard.js](/D:/LEOFF%202/ui/simulator-dashboard.js), and [ui/simulator-dashboard.css](/D:/LEOFF%202/ui/simulator-dashboard.css)
- The simulator preview rail now gives `My Scenarios` a more intentional workspace section, grouping report generation, synced-scenario actions, and local import/export into a clearer saved-scenario management surface in [ui/simulator.html](/D:/LEOFF%202/ui/simulator.html) and [ui/simulator-dashboard.css](/D:/LEOFF%202/ui/simulator-dashboard.css)
- `My Scenarios` now includes a first-pass scenario comparison surface that compares the current workspace against selected synced scenarios and persists the selected comparison scenario IDs inside `workspaceState`, allowing that comparison set to travel with saved account scenarios in [ui/simulator.html](/D:/LEOFF%202/ui/simulator.html), [ui/simulator-dashboard.js](/D:/LEOFF%202/ui/simulator-dashboard.js), and [core/stateManager.js](/D:/LEOFF%202/core/stateManager.js)
- The account stack now exposes billing-agnostic entitlement state, including `free` versus `premium` tier data plus a shared frontend helper for premium gating, and includes a manual tier-assignment script for testing before checkout is built in [backend/src/app.js](/D:/LEOFF%202/backend/src/app.js), [backend/src/lib/store.js](/D:/LEOFF%202/backend/src/lib/store.js), [backend/src/setUserPlanTier.js](/D:/LEOFF%202/backend/src/setUserPlanTier.js), [ui/accountEntitlements.js](/D:/LEOFF%202/ui/accountEntitlements.js), and [ui/apiClient.js](/D:/LEOFF%202/ui/apiClient.js)
- Premium custom stress testing V1 now exists in the simulator and dashboard flow, allowing premium members to persist harsher inflation, healthcare, portfolio-floor, and early-recession assumptions into `workspaceState` and apply them to Monte Carlo Plus runs in [core/premiumStressTesting.js](/D:/LEOFF%202/core/premiumStressTesting.js), [core/stateManager.js](/D:/LEOFF%202/core/stateManager.js), [ui/simulator.html](/D:/LEOFF%202/ui/simulator.html), [ui/simulator-dashboard.js](/D:/LEOFF%202/ui/simulator-dashboard.js), [analysis/monteCarloEngine.js](/D:/LEOFF%202/analysis/monteCarloEngine.js), and [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js)
- Premium saved-scenario comparison now upgrades `My Scenarios` from a plain assumptions snapshot to a richer side-by-side planning compare view for premium accounts, showing readiness, retirement-year income/margin, depletion timing, and key strategy setup details while keeping the lighter snapshot compare available on free accounts in [analysis/scenarioComparisonSummary.js](/D:/LEOFF%202/analysis/scenarioComparisonSummary.js), [ui/simulator.html](/D:/LEOFF%202/ui/simulator.html), [ui/simulator-dashboard.js](/D:/LEOFF%202/ui/simulator-dashboard.js), and [ui/simulator-dashboard.css](/D:/LEOFF%202/ui/simulator-dashboard.css)
- A first-pass premium withdrawal strategy optimizer now exists on the dashboard, turning the current account mix into personalized withdrawal-order, bridge-year, RMD, and Roth-preservation guidance for premium members in [analysis/withdrawalStrategyOptimizer.js](/D:/LEOFF%202/analysis/withdrawalStrategyOptimizer.js), [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js), [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html), and [ui/dashboard.css](/D:/LEOFF%202/ui/dashboard.css)
- A first-pass premium estate projection now exists on the dashboard, showing deterministic expected net worth for every projected year of life plus estate-planning prompts around beneficiaries, real-estate transfer planning, household coordination, and when to seek professional help in [analysis/estateProjectionSummary.js](/D:/LEOFF%202/analysis/estateProjectionSummary.js), [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js), [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html), and [ui/dashboard.css](/D:/LEOFF%202/ui/dashboard.css)
- PostgreSQL migration groundwork now exists in the backend through a storage-adapter layer, PostgreSQL schema file, JSON-to-PostgreSQL import script, and backend config support in [backend/src/lib/storage/index.js](/D:/LEOFF%202/backend/src/lib/storage/index.js), [backend/src/lib/storage/postgresStore.js](/D:/LEOFF%202/backend/src/lib/storage/postgresStore.js), [backend/src/lib/storage/schema.sql](/D:/LEOFF%202/backend/src/lib/storage/schema.sql), and [backend/src/migrateJsonStoreToPostgres.js](/D:/LEOFF%202/backend/src/migrateJsonStoreToPostgres.js)
- The live Lightsail backend has now been migrated from the temporary JSON store to PostgreSQL, with production smoke-test coverage for auth and plan CRUD plus rollback backups of both the legacy `store.json` and the PostgreSQL database
- Auth-sensitive backend endpoints now use per-IP in-memory rate limiting for `register`, `login`, `forgot-password`, and `reset-password`, with configurable thresholds and retry headers in [backend/src/lib/rateLimit.js](/D:/LEOFF%202/backend/src/lib/rateLimit.js), [backend/src/app.js](/D:/LEOFF%202/backend/src/app.js), and [backend/src/config.js](/D:/LEOFF%202/backend/src/config.js)
- The live backend now has a stronger operational security baseline: runtime secrets moved out of systemd drop-ins into a protected root-owned env file, and root-owned daily PostgreSQL backups now run on a systemd timer with `700` directory permissions and `600` backup files on Lightsail
- The live backup flow is now encrypted at rest on the server as well: daily PostgreSQL and legacy JSON backups are written as encrypted artifacts with a separate root-only backup key, and older plaintext backup files on Lightsail have been converted to encrypted versions

Remaining:
- Deploy the latest frontend auth and synced-plan UI to the live site and verify the full end-to-end account flow against production
- Add premium billing and payment collection, including checkout/subscription management for `$1.49/month` or `$14.99/year` premium accounts
- Add premium `Monte Carlo Plus` features such as deeper stress testing, higher-trial runs, retirement-age probability comparison, and stronger downside-case summaries
- Continue premium strategy optimization beyond the current withdrawal-order V1, including Social Security timing guidance, deeper bridge-year funding suggestions, and stronger tax-aware income planning
- Continue premium estate-planning / estate-advising beyond the current estate-projection V1, including deeper transfer, beneficiary, and professional-review support
- Add premium advanced printable reports and cleaner export packages for spouse, household, or professional planning discussions
- Add premium household-planning mode so spouse income, survivor elections, and shared retirement sequencing become easier to model together
- Add premium tax-detail views with stronger year-by-year taxable-income and withdrawal-impact visibility
- Add premium priority support / plan-review options if the product later includes a service layer alongside the software features
- Replace the temporary file-backed backend store with PostgreSQL once the route contract is stable enough to migrate

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
- Homepage hero CTA stack now links directly into the Survivor Benefit Comparison tool, extending internal linking and tool discovery from the main landing page in [ui/index.html](/D:/LEOFF%202/ui/index.html) and [ui/homepage.css](/D:/LEOFF%202/ui/homepage.css)
- The article library now includes a dedicated Monte Carlo guide in [ui/articles/article-monte-carlo-retirement-modeling.html](/D:/LEOFF%202/ui/articles/article-monte-carlo-retirement-modeling.html), and the dashboard Monte Carlo panel plus related retirement guides now link into it from [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html), [ui/articles.html](/D:/LEOFF%202/ui/articles.html), [ui/articles/article-recession-before-retirement.html](/D:/LEOFF%202/ui/articles/article-recession-before-retirement.html), and [ui/articles/article-leoff-retirement.html](/D:/LEOFF%202/ui/articles/article-leoff-retirement.html)

Planned:
- Technical SEO improvements for non-article pages
- Page-level keyword targeting beyond the current article library
- Internal linking strategy expansion across the full site
- Additional content support for calculator and article pages

### Phase 11 - Premium Modeling
Status: In progress

Completed / In progress:
- Monte Carlo simulation now exists as a separate engine in [analysis/monteCarloEngine.js](/D:/LEOFF%202/analysis/monteCarloEngine.js) rather than being mixed into the deterministic projection path
- Monte Carlo now samples year-by-year market and inflation scenarios, reuses the shared projection engine, and reports aggregated success, essential-coverage, readiness, depletion-age, failure-age, and ending-wealth summaries
- Monte Carlo is now surfaced on the dashboard as its own `Monte Carlo Outlook` section rather than as a deterministic chart mode in [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html) and [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js)
- Monte Carlo dashboard comparisons now use a stable seed across retirement ages and evaluate retirement-year outcomes against age-adjusted pension and withdrawal timing assumptions, improving slider-to-slider comparability in [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js), [analysis/dashboardViewModel.js](/D:/LEOFF%202/analysis/dashboardViewModel.js), and [analysis/monteCarloEngine.js](/D:/LEOFF%202/analysis/monteCarloEngine.js)
- Monte Carlo-backed recommendation policy now uses a `90%` success-rate threshold for the earliest strict recommended age, separating `workable` retirement ages from more durable `recommended` ones in [analysis/retirementScenarios.js](/D:/LEOFF%202/analysis/retirementScenarios.js)
- Monte Carlo now exposes representative best-case, mean, and worst-case net-worth paths directly on the dashboard, giving the report a more premium-style downside/upside visualization in [analysis/monteCarloEngine.js](/D:/LEOFF%202/analysis/monteCarloEngine.js), [analysis/dashboardViewModel.js](/D:/LEOFF%202/analysis/dashboardViewModel.js), [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html), [ui/monteCarloProjectionChart.js](/D:/LEOFF%202/ui/monteCarloProjectionChart.js), and [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js)
- Monte Carlo Plus now respects the new account-entitlement layer, using deeper trial counts plus premium-only best/mean/worst path visualization when an authenticated account has premium access in [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js), [ui/accountEntitlements.js](/D:/LEOFF%202/ui/accountEntitlements.js), and [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html)
- Probability-informed readiness scoring now exists for Monte Carlo Plus, blending deterministic coverage/longevity math with a dedicated Monte Carlo durability component so premium dashboard scores react to success odds and failure timing instead of deterministic projections alone in [analysis/readinessScore.js](/D:/LEOFF%202/analysis/readinessScore.js), [analysis/retirementAnalysis.js](/D:/LEOFF%202/analysis/retirementAnalysis.js), and [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js)
- Premium custom stress testing now lets Monte Carlo Plus runs apply persisted harsher inflation, healthcare, downside-floor, and early-recession assumptions from the simulator workspace, creating a clearer member-facing downside-analysis upgrade in [core/premiumStressTesting.js](/D:/LEOFF%202/core/premiumStressTesting.js), [analysis/monteCarloEngine.js](/D:/LEOFF%202/analysis/monteCarloEngine.js), [ui/simulator-dashboard.js](/D:/LEOFF%202/ui/simulator-dashboard.js), and [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js)
- A first-pass withdrawal strategy optimizer now exists for premium dashboards, turning the account mix into suggested withdrawal order, bridge-year funding, RMD watch, and Roth-preservation guidance in [analysis/withdrawalStrategyOptimizer.js](/D:/LEOFF%202/analysis/withdrawalStrategyOptimizer.js), [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js), [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html), and [ui/dashboard.css](/D:/LEOFF%202/ui/dashboard.css)
- A first-pass estate projection now exists for premium dashboards, showing expected net worth by projected year of life and wiring in estate-planning prompts around beneficiaries, property transfer, household coordination, and professional review in [analysis/estateProjectionSummary.js](/D:/LEOFF%202/analysis/estateProjectionSummary.js), [ui/dashboardLoader.js](/D:/LEOFF%202/ui/dashboardLoader.js), [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html), and [ui/dashboard.css](/D:/LEOFF%202/ui/dashboard.css)

Remaining:
- Social Security optimizer
- Scenario comparison
- Continue hardening Monte Carlo assumptions, presentation, and trust language for live beta use
- Consider adding explicit recession/regime clustering beyond the current independent year-by-year shocks

### Phase 12 - Other Device Support (Phone/Tablet)
Status: In progress

Progress:
- Shared responsive breakpoints improved for the simulator layout in [ui/simulator-dashboard.css](/D:/LEOFF%202/ui/simulator-dashboard.css)
- Dashboard panels, metrics, and tooltip layout now collapse more cleanly on phone widths in [ui/dashboard.css](/D:/LEOFF%202/ui/dashboard.css)
- Article hub and long-form article pages now have stronger phone/tablet layout behavior in [ui/articles.css](/D:/LEOFF%202/ui/articles.css) and [articles/article.css](/D:/LEOFF%202/articles/article.css)
- Simulator chart renderers now use narrower mobile padding, lighter axis labels, and tighter sampling on phone widths in [ui/chartRenderer.js](/D:/LEOFF%202/ui/chartRenderer.js) and [ui/incomeTimelineRenderer.js](/D:/LEOFF%202/ui/incomeTimelineRenderer.js)
- Simulator now has a dedicated phone-specific layout mode in [ui/simulator-dashboard.css](/D:/LEOFF%202/ui/simulator-dashboard.css) and [ui/simulator-dashboard.js](/D:/LEOFF%202/ui/simulator-dashboard.js), with reordered mobile cards, touch-friendly two-column tab navigation, and a simplified total-income-versus-expenses chart view paired with a phone-only retirement income-source summary
- Homepage feature panels have been refreshed to better match the current product mix of tools, forecasting, and guides, with cleaner card presentation in [ui/index.html](/D:/LEOFF%202/ui/index.html) and [ui/homepage.css](/D:/LEOFF%202/ui/homepage.css)
- Dashboard chart controls now collapse with the retirement-age slider inside the chart header rather than a separate top bar, improving mobile and desktop control grouping in [ui/retirementDashboard.html](/D:/LEOFF%202/ui/retirementDashboard.html) and [ui/dashboard.css](/D:/LEOFF%202/ui/dashboard.css)
- Shared mobile header/nav treatment is now stronger across simulator-style public pages through [ui/simulator-dashboard.css](/D:/LEOFF%202/ui/simulator-dashboard.css), improving touch targets and stacked navigation on the calculator, dashboard-adjacent pages, about, articles, login, and tool shells
- Homepage phone/tablet presentation now has a fuller mobile pass across the hero, CTA stack, feature sections, FAQ surfaces, and footer in [ui/homepage.css](/D:/LEOFF%202/ui/homepage.css)
- Articles, article pages, and login now use tighter mobile shell spacing, card padding, and typography in [ui/articles.css](/D:/LEOFF%202/ui/articles.css), [ui/articles/article.css](/D:/LEOFF%202/ui/articles/article.css), [ui/about.css](/D:/LEOFF%202/ui/about.css), and [ui/login.css](/D:/LEOFF%202/ui/login.css)
- Simulator mobile usability now has a more intentional phone flow in [ui/simulator.html](/D:/LEOFF%202/ui/simulator.html), [ui/simulator-dashboard.js](/D:/LEOFF%202/ui/simulator-dashboard.js), and [ui/simulator-dashboard.css](/D:/LEOFF%202/ui/simulator-dashboard.css), including a mobile step indicator, previous/next section controls, reordered mobile panel flow, and stronger phone-sized form controls
- Dashboard mobile readability now has a fuller phone-specific pass in [ui/dashboard.css](/D:/LEOFF%202/ui/dashboard.css), including cleaner overview-card stacking, more readable recommendation/risk text wrapping, larger mobile actions, and a more intentional chart-control block around the retirement-age slider
- Dashboard mobile chart controls no longer reserve a large empty block above the retirement-age slider on phone widths, with the chart header now collapsing without the old flex-basis dead space in [ui/dashboard.css](/D:/LEOFF%202/ui/dashboard.css)
- Retirement Age Comparison and Survivor Benefit Estimator now have stronger phone-specific card, action, and wide-table handling in [ui/retirement-age-comparison.css](/D:/LEOFF%202/ui/retirement-age-comparison.css) and [ui/survivor-benefit-estimator.css](/D:/LEOFF%202/ui/survivor-benefit-estimator.css)
- A tighter `430px` pass now exists across the homepage, simulator shell, dashboard premium/report surfaces, Retirement Age Comparison, Survivor Benefit Estimator, and long-form article shell, reducing cramped header navigation, over-wide phone tables, and oversized card spacing in [ui/homepage.css](/D:/LEOFF%202/ui/homepage.css), [ui/simulator-dashboard.css](/D:/LEOFF%202/ui/simulator-dashboard.css), [ui/dashboard.css](/D:/LEOFF%202/ui/dashboard.css), [ui/retirement-age-comparison.css](/D:/LEOFF%202/ui/retirement-age-comparison.css), [ui/survivor-benefit-estimator.css](/D:/LEOFF%202/ui/survivor-benefit-estimator.css), and [ui/articles/article.css](/D:/LEOFF%202/ui/articles/article.css)

Remaining:
- Finish real-device QA across the homepage, simulator, dashboard, Retirement Age Comparison, Survivor Benefit Estimator, and at least one article page
- Validate the current responsive pass at `360px`, `390px`, `412px`, `430px`, and `768px`
- Log and fix any remaining overflow, clipping, tiny touch targets, unreadable charts or tables, awkward spacing, or controls hidden below the fold

### Phase 13 - Domain and Launch
Status: In progress

Completed:
- Production domain `leoffhelper.com` is now secured and configured through the current static-host setup
- DNS and domain routing are now configured for the live site
- The site is now published to a live production environment on GitHub Pages with the custom domain in place
- A basic deployment/update workflow now exists through Git pushes to `main`
- A live backend service now exists on Lightsail behind `https://api.leoffhelper.com`, with HTTPS, reverse proxying, and persistent service management in place for the new accounts foundation

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

## Security Hardening Roadmap

Completed:
- Production storage has been migrated from the temporary JSON file backend to PostgreSQL on Lightsail, with smoke-tested auth and plan CRUD plus rollback backups
- Auth-sensitive routes now use per-IP rate limiting for `register`, `login`, `forgot-password`, and `reset-password`
- Runtime secrets now load from a protected root-owned env file on the Lightsail host instead of raw systemd drop-ins
- Root-owned daily backups now run through `leoff-api-backup.timer`, with `700` backup directories and `600` backup files
- Backup artifacts are now encrypted at rest on the server using a separate root-only backup key, and older plaintext backup files have been converted

Deferred / To Revisit:
- Minimize what gets persisted in `workspaceState`, with the explicit intent to avoid full names, spouse names, full birth dates, SSNs, and financial-account identifiers wherever they are not strictly necessary

Next:
1. Enable and verify Lightsail automatic snapshots, then run a documented restore drill so the provider-managed at-rest layer and the app-managed encrypted backup flow are both operationally proven.
2. Document a tighter production security baseline covering secret rotation, backup restore drills, least-privilege access, and deployment/update handling so the live process is operationally repeatable.
3. Replace the current in-memory auth limiter with a durable/shared limiter if the backend ever scales beyond a single instance or adds heavier public traffic.
4. Add lightweight access/audit visibility for critical auth and account-management actions so suspicious login, reset, or admin-tier activity is easier to review.

## Immediate Next Steps

1. Enable and verify Lightsail automatic snapshots, then run a documented restore drill so the provider-managed at-rest layer and the app-managed encrypted backup flow are both operationally proven.
2. Minimize what gets persisted in `workspaceState` so the backend stores less sensitive financial detail by default, with the explicit goal of avoiding full names, spouse names, full birth dates, SSNs, or financial-account identifiers where they are not strictly necessary.
3. Document a tighter production security baseline covering secret rotation, backup restore drills, least-privilege access, and deployment/update handling so the live process is operationally repeatable.
4. Replace the current in-memory auth limiter with a durable/shared limiter if the backend ever scales beyond a single instance or adds heavier public traffic.
5. Add lightweight access/audit visibility for critical auth and account-management actions so suspicious login, reset, or admin-tier activity is easier to review.
