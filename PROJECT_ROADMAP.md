# LEOFF Helper Project Roadmap

Last updated: April 23, 2026

This document is split into two parts:

- Completed Features: shipped or operationally proven work.
- Pending Roadmap: only work that still needs implementation, verification, or follow-up.

## Pending Roadmap

### Security, Operations, and Launch Readiness

- Verify the first successful Lightsail automatic snapshot through the AWS Lightsail console or a configured AWS CLI/API environment, then document the snapshot name or ID, source instance, region, creation time, state, and whether a non-production restore was performed.
- Add audit-event retention and review procedures once real traffic makes recurring audit review useful.
- Continue hardening the deployment/update workflow for safer live releases.
- Verify live asset paths, SEO metadata, and public page routing after significant launch changes.

### Pension and Deterministic Accuracy

- Add additional pension-system engines later through the pension registry pattern.
- Continue expanding multi-pension UI support beyond the current LEOFF2 + optional PERS2 + optional TRS2 flow.
- Continue deepening edge-case pension-rule accuracy across LEOFF2, PERS2, TRS2, and future systems.
- Continue improving expense-category realism beyond the current split-inflation and essential/discretionary baseline.
- Continue improving tax-aware retirement withdrawals beyond the current progressive-tax and need-aware sequencing baseline.
- Add stronger non-Monte-Carlo deterministic stress paths, such as stagnant-decade and early-retirement recession scenarios.

### Asset, Cash Flow, and Withdrawal Modeling

- Deepen retirement-account withdrawal realism around year-by-year tax-aware bridge strategy and later premium tax-detail views.
- Add explicit pre-retirement surplus savings modeling so excess earned income can flow into cash, savings, or taxable brokerage instead of disappearing after annual expenses, with user-controlled sweep behavior and clear chart/report treatment.

### Dashboard, Reports, and Tools

- Continue trimming section-specific render orchestration from the dashboard loader as needed.
- Continue refining the Survivor Benefit Estimator toward closer DRS-table fidelity.
- Add optional true one-click PDF generation beyond the browser print-to-PDF flow.
- Continue tuning readiness score language, trust language, and score calibration as more modeling and user feedback arrive.

### Accounts, Billing, and Premium

- Replace the old one-time premium plan direction with a clearer annual-subscription path:
  - make annual premium the primary paid offer, bundling Monte Carlo Plus, premium scenario comparison, withdrawal strategy guidance, estate projection, premium readiness-by-age analysis, and stronger export/report output around real retirement decisions
  - keep the core planner, account creation, saved scenarios, and basic dashboard/report flow free so trust and product adoption stay high
  - consider adding a monthly option later only if there is clear ongoing value and lower-friction pricing is needed after the annual offer is established
- Add billing and payment collection for the annual premium subscription.
- Add premium Monte Carlo Plus features such as deeper stress testing, higher-trial runs, retirement-age probability comparison, and stronger downside-case summaries.
- Continue premium strategy optimization beyond the current withdrawal-order V1, including Social Security timing guidance, deeper bridge-year funding suggestions, and stronger tax-aware income planning.
- Continue premium estate-planning / estate-advising beyond the current estate-projection V1, including deeper transfer, beneficiary, and professional-review support.
- Continue improving premium export packages beyond the current household/advisor copy packets, including cleaner print bundles and stronger professional-facing formatting.
- Add major life-event presets inside the planner and `My Scenarios` flow, such as `work one more year`, `pay off mortgage`, `healthcare costs jump`, `buy a second home`, or `spouse retires earlier`.
- Add premium household-planning mode so spouse income, survivor elections, and shared retirement sequencing become easier to model together.
- Add premium priority support / plan-review options if the product later includes a service layer alongside the software features.

### Monte Carlo and Scenario Modeling

- Continue scenario comparison work where deeper comparison is still needed outside the current saved-scenario comparison surfaces.
- Consider explicit recession/regime clustering beyond the current independent year-by-year Monte Carlo shocks.

### SEO, Content, and Public Site

- Continue technical SEO improvements for non-article pages.
- Expand page-level keyword targeting beyond the current article library.
- Expand internal linking strategy across the full site.
- Continue maintaining the trusted assumptions library as model defaults, methodology, and public trust language evolve.

### Mobile and Device QA

- Finish real-device QA across the homepage, simulator, dashboard, Retirement Age Comparison, Survivor Benefit Estimator, contact page, and at least one article page.
- Validate the current responsive pass at `360px`, `390px`, `412px`, `430px`, and `768px` on real devices or reliable device labs.
- Log and fix any remaining overflow, clipping, tiny touch targets, unreadable charts or tables, awkward spacing, or controls hidden below the fold.
- Continue real-device QA on the contact-page flow and make sure public `Contact Us` links, larger social buttons, and footer icon visibility all feel intentional on real devices.

### Domains and Social

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
- Align social profile visuals, bios, and outbound links with the live site and public tool pages.
- Decide whether social links should also appear in the public header or stay footer/contact-page only.
- Publish a first content set around retirement timing, survivor options, pension value, and new-tool releases.
- Reuse article and tool content into short-form social posts that point back to the site.
- Define a simple posting cadence for launch and early beta.
- Track basic engagement and referral traffic from social posts into the public site.

## Completed Features

### Pension Engines

- Dedicated LEOFF2, PERS2, and TRS2 pension engines exist with formal base-pension, early-retirement reduction, and monthly-pension math.
- LEOFF2 supports DRS optional tiered multiplier versus `2% pension + lump sum` election modeling.
- Pension registry routing lets the dashboard and simulator call dedicated pension engines instead of inline pension math.
- Simulator support includes optional PERS2 and TRS2 inputs alongside the main LEOFF2 flow.

### Projection Engine

- Core projection math lives in `core/incomeEngine.js`, with a projection wrapper in `core/projectionEngine.js`.
- Canonical simulation state creation, save/restore, and dashboard fallback restore behavior are in place.
- Shared simulator, simulator UI, and simulator bootstrap helpers reduce duplicate page logic.
- Projection modeling includes current annual pay, final salary assumptions, retirement-account accumulation, split inflation, and differentiated retirement-account tax treatment.
- Restore/input-prefill now preserves birth month, birth year, marital status, spouse visibility, Social Security optimize state, and survivor-option visibility.

### Analysis Engine

- Readiness score, scenario comparison, retirement vulnerability, and unified retirement analysis engines are implemented.
- Dashboard view-model helpers own recommendation, report, summary, age-bound, age-adjusted projection, and vulnerability-list derivation.
- Readiness scoring includes probability-informed Monte Carlo Plus scoring and plain-language readiness bands: `Durable`, `Strong`, `Workable`, and `Fragile`.
- Vulnerability analysis includes stress categories, severity tiers, mitigation guidance, primary risk, and ranked secondary risks.

### Charts and Verification

- Bar chart, income timeline, shared projection chart wrapper, tooltip support, retirement markers, asset depletion markers, default series coloring, and chart legends are implemented.
- Browser verification coverage exists for chart/render/state/module smoke checks, simulator helper behavior, tax handling, dashboard consistency, age ordering, retirement-age comparison, survivor estimator ordering, Monte Carlo regressions, and responsive overflow/layout checks.

### Asset Modules

- Asset modules exist for real estate, retirement accounts, metals, crypto, debts, and liquid/taxable assets.
- Real estate, crypto, metals, debt, and retirement account cards use shared collapsible-card behavior with validation, save, restore, remove, summaries, and draft cleanup.
- Asset/debt module state collection skips empty modules and restores single-versus-multiple card payloads consistently.
- Real estate modeling includes rental income, rent growth separate from property appreciation, extra principal payments, mortgage payoff timing, and debt expense treatment.
- Retirement account modeling includes duplicate/spouse labels, pay-based employee contributions, employer match, account-type tax treatment, RMD floors, realistic default ordering, and need-aware withdrawals.

### Dashboard and Report Output

- Retirement dashboard exists with recommendation ages, readiness, charting, financial snapshot, vulnerability analysis, Monte Carlo outlook, retirement-age slider modeling, and age-adjusted projection rebuilds.
- Recommendation logic avoids recommending ages below current age and requires both non-withdrawal dependence and a 90% Monte Carlo success threshold for recommended retirement age.
- Dashboard shell, chart controls, slider placement, mobile behavior, and report-style print layer have been improved.
- Full printable report sections include recommendation, readiness score breakdown, expense breakdown, tax snapshot, top risks, shortfall summary, and print-focused charts.

### LEOFF-Specific Public Tools

- Retirement Age Comparison Tool is implemented with birth-year/start-year service-credit derivation, tiered multiplier versus lump-sum comparison, bridge-year framing, deltas, tooltips, copy/print actions, and public links.
- Survivor Benefit Estimator is implemented with sampled DRS age-gap outputs for 50%, 66.67%, and 100% survivor choices, decision-oriented comparisons, copy/print actions, and explicit estimator framing.
- Lifetime Pension Value Calculator is implemented with service-credit derivation, monthly/annual pension, percent of FAS, cumulative value, lump-sum-inclusive totals, milestone checkpoints, copy/print actions, and one-more-year tradeoff summary.

### Accounts and Persistence

- Backend service exists with session-based auth, login/register/logout, `/me`, password change, forgot/reset password, plan CRUD, shareable read-only plan links, and health checks.
- Live API runs behind `https://api.leoffhelper.com`.
- Account-backed plan syncing, `My Scenarios`, scenario rename/duplicate/delete/reopen, selected comparison IDs, and import/export backup paths are implemented.
- Account settings include preferred name, session details, session refresh, in-session password updates, and retirement check-in email frequency.
- Account-created, password-reset, daily signup summary, and retirement check-in email jobs exist, with production email configuration and local log fallback.
- Billing-agnostic entitlement state, premium gating helper, and manual tier assignment script exist.
- PostgreSQL storage adapter, schema, JSON migration script, production PostgreSQL migration, auth/plan CRUD smoke testing, and rollback backup flow are complete.
- Account-backed plan persistence now minimizes saved `simulationState` and `workspaceState` before storage by dropping obvious direct identifiers and financial-account identifiers while preserving projection math and restorable labels.

### Premium Modeling

- Monte Carlo engine exists as a separate module that samples market and inflation scenarios, reuses the shared projection engine, and reports success, essential coverage, readiness, depletion, failure-age, and ending-wealth summaries.
- Monte Carlo Plus supports account entitlements, deeper trial counts, premium-only path visualization, trusted assumptions language, and custom stress inputs.
- Premium stress testing supports harsher inflation, healthcare, downside-floor, early-recession assumptions, and named recession-style stress packs.
- Premium saved-scenario comparison includes side-by-side planning compare cards and a decision scoreboard.
- Premium withdrawal optimizer, bridge-year funding planner, estate projection, Social Security optimizer, readiness timeline, survivor-option optimizer, tax detail views, household decision brief, and professional review packet have first-pass implementations.

### SEO and Public Content

- Article SEO system, reusable article template, canonical tags, keyword metadata, Open Graph/Twitter metadata, JSON-LD article schema, related-guide sidebars, and main public-page metadata/schema are implemented.
- Homepage links, article library links, tool links, and internal links connect guides, tools, dashboard premium sections, and the trusted assumptions library.
- Published long-form guides include LEOFF pension basics, professional financial help, Monte Carlo modeling, withdrawal sequencing, scenario comparison, recession planning, survivor options, and related retirement guides.
- Tools directory has metadata, schema, internal linking, and simplified navigation-hub treatment.
- Trusted assumptions library exists as a public reference page for model defaults, boundaries, and methodology.

### Mobile and Public UX

- Simulator, dashboard, homepage, tools hub, article pages, login, about, Retirement Age Comparison, Survivor Benefit Estimator, contact page, and long-form article shell have responsive/mobile passes.
- Simulator includes phone-specific layout mode, reordered mobile flow, touch-friendly tab navigation, mobile step indicator, previous/next controls, and phone-sized form controls.
- Public contact page exists with comment-to-email draft flow, direct email access, and Facebook/X discovery.
- Responsive verification harness checks key pages at `360px`, `390px`, `412px`, `430px`, and `768px`.

### Domain, Deployment, and Operations

- `leoffhelper.com` is secured, routed, and published through the current static host setup.
- Git push to `main` is the basic deployment/update workflow for the public site.
- Lightsail backend runs with HTTPS, reverse proxying, persistent service management, PostgreSQL, protected root-owned runtime env file, and daily encrypted app-managed backups.
- `leoff-api-backup.timer` runs root-owned daily backups with `700` backup directories, `600` backup files, encrypted artifacts, and a separate root-only backup key.
- Lightsail automatic snapshots are enabled on a daily `4:00 AM Pacific` schedule.
- App-managed encrypted PostgreSQL restore drill passed on April 23, 2026 using backup set `20260422-101514`, with disposable database restore, temporary local API validation, auth/plan smoke checks, and cleanup documented in `backend/docs/backup-restore-drill.md`.
- Production security baseline documents secret rotation, restore drills, least-privilege access, deployment/update handling, audit review, and persistence minimization.
- Auth-sensitive route limiting supports shared PostgreSQL-backed rate-limit buckets when `DATA_BACKEND=postgres` and `RATE_LIMIT_BACKEND=auto`, while retaining memory-backed limiting for local/file-backed development.
- Lightweight audit logging records critical auth, account-profile, password, plan, plan-share, rate-limit block, and manual tier-update actions with hashed request/email identifiers.
- A production-only `REQUEST_IDENTITY_HASH_SALT` has been set in the protected production env file.

### Social Presence

- Official Facebook page exists at `facebook.com/LEOFFHELPER`.
- Official X presence exists at `x.com/LEOFFHelper`.
- Public footers link to Facebook and X with icon-based links.
- Contact page brings together email, comment drafting, and Facebook/X discovery.
