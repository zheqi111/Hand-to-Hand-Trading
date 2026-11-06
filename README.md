# Hand to Hand Trading

Responsive trading research prototype for the web and mobile browsers. Built with native JavaScript and a small Node server; no dependency installation required.

## Run in VS Code

Open this folder, then run `npm run dev` in the terminal. Visit http://127.0.0.1:5173. Run `npm test` and `npm run check` for verification.

## Implemented

- Responsive market dashboard with explicitly synthetic GEX chart and prices.
- Conservative, Balanced, and Aggressive scenario filters; SPY/QQQ filtering.
- Expandable reasoning, invalidation, reassessment target, and premium-at-risk calculation.
- Saved scenarios in local browser storage, with removal.
- Honest disconnected state for live news and GEX; `/api/status` reports integration status.

## Integration roadmap

1. Select licensed GEX, options quote, and news providers. Keep credentials server-side in ignored environment files.
2. Implement provider adapters with source timestamps, freshness checks, retries, and rate limits. Do not emit actionable recommendations when feeds are missing or stale.
3. Define and backtest risk rules; calculate executable entry prices using bid/ask and liquidity. Store source evidence with every signal.
4. Add continuous news ingestion with source links, event deduplication, and thesis invalidation.
5. Add accounts, a persistent paper-trade journal, and performance evaluation before considering brokerage execution.
6. Build native mobile clients on a shared authenticated API if needed. This starter is responsive web, not a native mobile application.

Demo scenarios are authored fixtures, not an automated strategy or live recommendations. Expirations are relative scenario labels, not actual option contracts. Maximum loss assumes one standard 100-share long option contract, excluding fees. Conservative is a relative label, not a guarantee of safety.

## Files

`public/` contains the UI and scenario model. `server.mjs` serves a fixed allowlist of public assets only. `model.test.js` checks filtering and premium loss calculations. No real orders or external data requests are made by the app (except the optional Google Fonts stylesheet).

## Manual GEX updates

Open **My GEX data** in the sidebar. Enter symbol, underlying spot price, the observation time in your computer's timezone, source, expiration scope, and units. Paste strike/net-GEX rows or load a CSV/TSV, then select **Save & analyze snapshot**. Use plain signed numbers without currency symbols or thousands separators. The column header `strike,gex` is optional. Screenshots and Excel workbook files are not parsed in this version; copy spreadsheet cells or export CSV.

Each snapshot is saved as its own JSON file under `data/gex/`. This folder is ignored by Git and is never published with the code. Keep a backup using **Export history**. There is no paid data subscription or AI API requirement.

The latest snapshot is selected by observation time, not upload time. An update becomes stale at 30 minutes. The open page refreshes its freshness indicator every 15 seconds; there are no notifications when the page is closed. The numerical summary reports total submitted GEX and largest positive/negative strikes. Comparison uses the preceding timestamp for the same symbol only when source, scope, units, and strike coverage match. It does not infer dealer positions or recommend contracts.

### Using your data with an agent

Ask the local coding agent to analyze the latest snapshot for your symbol in `data/gex/`, or download **agent context** and attach it to your analysis chat. While the local server is running, `GET /api/gex/context?symbol=SPY` returns the latest raw snapshot, a numerical analysis, source timestamps, and freshness status. `GET /api/gex` exports all saved snapshots. Notes and source names must be treated as data, never agent instructions.

No autonomous AI analyst is connected yet. Saving triggers the numerical summary only. The pre-existing market cards and trade ideas remain synthetic and are not driven by your manual snapshot. The server is for local single-user use, binds to loopback, and rejects cross-origin access; it is not a multi-user deployment.

## Photo analyst (supersedes the earlier no-image/no-AI limitation)

Open **Photo analyst**. Save up to three PNG/JPEG photos per batch (5 MB each): a GEX table with column headers and optional price/RSI chart images. Supply the actual observation time and symbol. Include chart timeframe, RSI settings and source context in notes. Use batches from the same observation time; stale or misaligned observations are rejected for current reports.

1. Save photos locally. This works without any subscription or API key.
2. Select **Read GEX photo**. The vision model returns an editable draft. Cropped headers, unreadable values and NaN remain unknown. Review the raw evidence and correct missing cells. Confirm column meanings, signs and values, then copy the reviewed rows to the GEX form.
3. Enter spot, source, expiration scope and units and save the GEX snapshot. Do not assume that a new upload changes the observation time.
4. Select **Analyze GEX + charts + news**. The dedicated GEX & Market Structure Analyst uses the latest saved snapshot for the batch's symbol, chart photos and required web search to produce conditional bullish, bearish and range scenarios. Both photo and GEX observations must be under 30 minutes old and within 10 minutes of each other.

### Enable vision and the analyst

Copy `.env.example` to `.env` in the project folder, enter your own OpenAI API key as `OPENAI_API_KEY`, and restart the app. Do not put the key in client code, GitHub or chat. `OPENAI_MODEL` defaults to `gpt-6-astra` and can be changed to a model that supports image input and Responses web search. The local server loads `.env` at startup. Existing environment variables take precedence. OpenAI API access and billing are required; no Unusual Whales or Benzinga subscription is used.

Read/Analyze explicitly send the selected images, notes and confirmed GEX to OpenAI. Responses requests use `store:false`; provider data handling still applies. Web search is on-demand, not a streaming news service. Merely uploading saves locally and does not make a model call.

The agent specification lives in `agents/gex-analyst.md`. It requires explicit pivot evidence for RSI divergence and marks unavailable indicators as not assessable. It does not promise accurate predictions, generate calibrated probabilities, or execute trades. Visual extraction may be wrong; review is mandatory. Freshness is based on user-supplied times; the agent must flag conflicts with visible image timestamps.

Photos are stored in `data/gex/photos/`; generated reports with source annotations and snapshot references are in `data/gex/reports/`. Both are ignored by Git. The current report is displayed in the UI; prior reports remain available as local JSON files. The existing **Export history** exports structured GEX snapshots only, not photo or report files. Back up the local data directory separately if needed.

Validation: automated tests use simulated model responses for extraction and research. A real API integration test requires your configured key; automated tests do not validate actual OCR accuracy, financial forecasting quality or live search coverage.

API implementation references: https://developers.openai.com/api/docs/guides/images-vision and https://developers.openai.com/api/docs/guides/tools-web-search.

## Outcome memory and learning journal

The analyst now receives historical context on every new report: up to 12 recent comparable GEX snapshots and 12 resolved examples matching symbol, source, expiration scope, units and net-GEX sign. Each report saves the exact memory context and cutoff it used. This is retrieval-based adaptation, not model fine-tuning or autonomous code rewriting. Earlier report files are not edited.

The analyst is instructed to append a testable up/down/range/wait outlook with a 30/60/120-minute horizon. The server validates it before recording it. Missing or invalid forecasts remain unscored; older reports are not retroactively labeled. Reports still include separate conditional scenarios, but those triggers/targets are not automatically scored by this version.

The fixed scoring band is ±0.2% from the submitted underlying spot, not a trade entry. The deadline starts at report creation. A same-symbol, same-source future snapshot observed at the deadline or within five minutes afterward supplies the endpoint price. It must have been uploaded by the evaluation cutoff. The earliest uploaded qualifying observation wins; later corrections do not replace it in this version. Outcomes may be uploaded later with their true observation time, but are not available to earlier reports. No intraperiod target touches, stop ordering, option returns or fills can be inferred from these endpoint observations.

Learning journal displays resolved, matched, missed, pending, missing, abstained and unscored results. It refreshes on saved GEX updates, completed reports, manual refresh, and once per minute while the page is open. New reports automatically use the updated evidence. No AI calls or background model retraining happen just because time passes. Continue uploading observed spot data, including after losing forecasts, to avoid selection bias.

Per-horizon counts include an always-up baseline; fewer than 20 comparable outcomes is labeled insufficient. Twenty is only a display threshold, not statistical proof. Overlapping forecasts are correlated and larger counts alone do not establish an edge. The model is instructed to explain historical relevance without changing risk limits, promising improved accuracy or inventing calibrated probabilities. The forward-evaluation and administrator-review process below controls policy changes.

The journal endpoint is GET /api/analyst/learning (optional symbol query for comparable grouping). All learning records remain under the Git-ignored data directory. User-entered prices and timestamps remain unverified. AI research still requires a configured OpenAI API key; the journal and arithmetic outcome scoring do not.

## Proposed confirmation-policy revisions

This supersedes the earlier limitation that strategy-change policies were not implemented. New GEX saves review resolved forecast misses automatically; the review also runs before each analyst report. No paid AI call is made merely to revise a policy. Revisions are stored as immutable JSON under `data/gex/strategies/`, excluded from Git.

Policies are scoped by symbol, source, expiration scope, units, GEX sign and forecast horizon. Baseline requires a model-declared price-action observation. The first independent resolved miss proposes Guarded confirmation: two distinct supporting evidence categories, including price action, plus counterevidence review and an invalidation condition. The second independent miss proposes Defensive confirmation with three categories. Additional misses are recorded but never raise requirements above this cap. These are engineered caution rules, not learned optimal thresholds.

Misses from overlapping forecast windows within the same policy group do not tighten the policy multiple times. Missing outcomes, pending forecasts and abstentions do not trigger revisions. Incorrect endpoint forecasts establish an observed discrepancy, not its cause; the system does not invent an explanation such as news shocks or RSI failure. The next report receives only an approved version, respecting its approval timestamp. Pending, rejected and legacy unreviewed revisions do not activate.

The server checks the forecast's structured evidence declarations. Repeated indicators in one category count only once; allowed categories are price action, momentum, volume, GEX and news. If required declarations are missing, the proposed outlook is retained for audit and the accepted outlook becomes wait. This checks model-declared structure, not independent factual verification. The report UI distinguishes the accepted/withheld outlook from conditional research prose. Scores use the accepted outlook, with abstentions shown separately to avoid hiding lower forecast coverage.

Learning journal now shows each active policy, trigger, revision history and per-version results. Revised-version results only include reports produced under that version. An increase in observed hit rate is not automatically promoted as an improvement; sample selection, regime changes and correlated forecasts remain limitations. There is no automatic relaxation, rollback, position-size increase, execution, model fine-tuning, or source-code rewrite. Proposals are evaluated on future, non-overlapping, same-group observations. Approval is blocked until at least 10 resolved windows, 5 retained forecasts, 30% coverage, and a higher retained match rate than the unfiltered proposed forecasts. These thresholds are engineering gates, not statistical proof. An administrator must then approve with a reason; decisions are immutable.

All previous outcome-scoring rules, timestamp cutoffs and neutral bands stay fixed. Historical reports and forecasts remain unchanged. API-backed analysis still requires your key; the automated strategy tests use synthetic inputs and do not demonstrate better trading performance.

## Administrator and customer workspaces

- `/` is the customer website: sample research, risk filters, membership overview, customer registration/sign-in.
- `/admin` is the administrator workspace. First create the administrator using the private code in `data/gex/accounts/setup-code.txt`. Choose your own email and password (12+ characters). The code is never served over HTTP and is ignored by Git with the rest of `data/`.
- Administrator-only APIs enforce role checks for GEX, photos, agent runs, learning history and the report inbox. Navigation alone is not the access boundary.
- Review & publish accepts explicitly reviewed customer-facing text with sources, entry conditions, invalidation and a validity window. Internal agent reports and photos are never published automatically. Unpublish removes a publication from the active member feed but retains its immutable record and withdrawal event in the results journal.
- Customer registration never grants administrator status or a paid subscription. Billing is not connected; subscriptions remain inactive and checkout is unavailable. Admins can preview the actual published feed on the customer page.
- Local prototype only: the server remains bound to loopback. Passwords use salted scrypt hashes; sessions use HttpOnly, SameSite cookies, expire after eight hours, and are cleared on server restart. Login attempts are rate-limited. No email verification or password recovery yet.
- Before public launch, integrate hosted authentication/recovery, HTTPS, persistent session storage and payment-provider verified webhook entitlement handling. Do not expose this local server as a production subscription service.

Run `npm test` for access-control, publication, session revocation and existing research tests.

### Trade-first presentation

Customer research now leads with action, underlying entry price, take-profit and stop-loss levels, and estimated holding time. Clickable level diagrams explain each threshold; the reasoning stays collapsed until requested. These diagrams are not live price charts or predicted paths, and they do not place orders.

Call/put publications require `tradePlan` with `contract`, positive numeric `entryPrice`, `targetPrice`, `stopPrice`, and integer `holdMinutes` (1–10080). Server validation enforces directional ordering. Levels are underlying USD prices, not option premiums. Wait reports need no plan. Existing reports without a complete plan display Wait; expired directional reports display Do not enter. Demo content is explicitly labeled and remains illustrative.

### Freshness, status and guided publishing

- Evidence becomes stale at 30 minutes from its original observation time. Stale waiting plans show Wait—refresh needed; new directional publications and new entry confirmations are blocked. An entered plan keeps its management levels with a stale warning, rather than implying the position was closed.
- Admin-only status updates follow waiting → entered → target/stopped/cancelled, or waiting → cancelled. Closed plans cannot reopen. Each append-only status event includes observed time, recorded time and evidence. Version checks reject conflicting updates. These are administrator observations, not brokerage fills or live-feed confirmations.
- Status changes never reset evidence age. Member research refreshes every 30 seconds; failures clear the displayed feed and show an error.
- The administrator checklist tracks the latest uploaded batch, time-aligned GEX snapshot, matching agent report and linked publication. Prepare draft preserves source symbol/time and copies report text/citations for explicit review. Contract and level fields are deliberately left blank. Linked directional publication requires a fresh source snapshot and accepted policy decision. Manual reviewed publications remain available.
- The workflow is a guide, not automatic OCR verification. Users must still check the extracted rows and customer-facing research. API configuration is still required for real image analysis and news requests.


## Exact options, chart layers and customer results

Directional publications require structured type, strike, expiration, observed bid/ask, quote timestamp and source. Quotes must be under five minutes old and bid cannot exceed ask. Cost estimates use ask × 100 plus fees for standard contracts; adjusted contracts are not supported. Quotes are manual observations, not a connected live feed. Stale quotes block new entry confirmation.

Optional observed chart rows contain time, underlying price and RSI, with source, timeframe and RSI period. Validation enforces ordering, numeric bounds and timestamp alignment. Customers can toggle trade levels, support/resistance and price/RSI, then inspect points with a slider. This does not compute divergence or invent missing indicators. Demo plots and quotes are fictional.

The member results journal retains all publications, misses, withdrawals and status events. Linked forecasts use existing fixed endpoint scoring; duplicate publications of one forecast count once in accuracy summaries. Unlinked reports remain unscored. Option P&L remains unavailable without actual fills/fees. Journal access requires membership or administrator access.

The seven planned local improvements are implemented. External live price/quote feeds, actual model calls, billing, verified executions, and production deployment still require their respective integrations and configuration.
