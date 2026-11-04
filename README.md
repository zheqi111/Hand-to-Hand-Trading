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
