# Monte Carlo Roadmap

## Purpose

Monte Carlo modeling will be a premium analysis module layered on top of the
existing deterministic retirement simulator.

It should not replace the current projection engine. It should use the current
`SimulationState` and deterministic projection flow as the base case, then run
many randomized variants of that same plan.

Core question answered:

- How likely is this retirement plan to hold up when market returns and
  inflation vary over time?

## Product Positioning

- Free tool:
  - deterministic planning
  - vulnerability analysis
  - retirement age recommendations
  - charts and dashboard reporting
- Premium tool:
  - Monte Carlo simulation
  - probability of success
  - probabilistic range of outcomes
  - sequence-of-returns analysis

## Architecture

Recommended flow:

- UI
- SimulationState
- Projection Engine
- Monte Carlo Engine
- Monte Carlo Analysis
- Charts / Report

Monte Carlo should be its own module, not mixed into the base simulator logic.

## V1 Scope

Monte Carlo V1 should randomize only the major uncertain variables that matter
most and are understandable to users:

- portfolio returns
- inflation
- housing inflation
- healthcare inflation

V1 should keep these deterministic:

- pension rules
- Social Security rules and claim ages
- retirement age selected by the user
- initial balances
- debt balances
- fixed real estate assumptions unless explicitly expanded later

## One Simulation Path

Each simulation should:

1. Start from the same `SimulationState`.
2. Generate a randomized annual return path.
3. Generate a randomized annual inflation path.
4. Run the projection through the target horizon.
5. Record outcomes such as:
   - success or failure
   - depletion age
   - ending net worth
   - worst shortfall
   - years with deficits

## Number of Simulations

Roadmap target:

- 10,000 simulations

Recommended operating tiers:

- Quick preview: 1,000
- Standard premium run: 5,000
- Full run: 10,000

This keeps browser performance manageable while preserving the premium
10,000-run target.

## Success Definition

Monte Carlo success should align with the rest of the planner.

Recommended success rule:

- essential expenses are covered every year
- assets are not depleted through age 100

Alternative success definitions can be added later, but this should be the V1
default so the premium analysis matches the deterministic recommendation logic.

## Return Modeling

V1 return modeling:

- annual randomized portfolio returns
- mean return and standard deviation assumptions
- one portfolio return distribution if allocation detail is not yet modeled

Future versions may add:

- stock / bond allocation detail
- asset-class correlations
- more advanced sequence-of-returns modeling

## Inflation Modeling

V1 inflation modeling:

- random annual inflation draws around a mean
- support for:
  - general inflation
  - housing inflation
  - healthcare inflation

This should build on the split-inflation work already in the deterministic
engine.

## User Outputs

Monte Carlo should show a simpler premium output set than the deterministic
dashboard:

- Probability of Success
- Median Ending Net Worth
- 10th Percentile Ending Net Worth
- Median Depletion Age
- Chance of Depletion Before Age 90 / 95 / 100
- Best Case / Median / Weak Case summary

## Charts

Recommended V1 charts:

- success-rate summary
- histogram of ending net worth
- percentile asset bands over time
- optional 10th / 50th / 90th percentile asset paths

## UI Placement

Monte Carlo should be a separate premium module or premium tab.

Recommended product structure:

- deterministic dashboard remains the default report
- Monte Carlo appears as an advanced premium analysis panel

This avoids confusing free users while still providing a strong premium feature.

## File Structure

Recommended implementation files:

- `analysis/monteCarloEngine.js`
- `analysis/monteCarloDistributions.js`
- `analysis/monteCarloAnalysis.js`
- `ui/monteCarloRenderer.js`

Primary entry point:

- `runMonteCarlo(simulationState, options)`

## Options

Recommended Monte Carlo options:

- number of simulations
- target age / horizon
- return assumptions
- inflation assumptions
- success definition

## Implementation Order

1. Build Monte Carlo engine.
2. Add randomized projection paths.
3. Compute success/failure metrics.
4. Add premium output panel.
5. Add Monte Carlo charts.

## V1 Guardrails

Do not include these in V1:

- tax-law randomness
- pension-law randomness
- survivor mortality modeling
- stochastic real estate modeling
- dynamic spending behavior
- regime-switching macro models

These can be future upgrades after the first premium release.

## Product Guidance

Monte Carlo should be presented carefully:

- it is not a prediction
- it estimates a range of possible outcomes
- success probability is not a guarantee

If presented clearly, Monte Carlo is a strong premium feature because it adds
probability-based planning on top of the deterministic tool the user already
understands.
