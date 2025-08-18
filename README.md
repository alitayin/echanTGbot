## XEC Telegram Bot

eChan Telegram bot for group management and data queries.

## Features
- Conversational Q&A: mention `@alitayinGPTbot` or the keyword `echan`; DM supported.
- Group management: spam detection and simple anti-impersonation.
- Price: `/price` returns the latest XEC price.
- Avalanche: `/ava` returns the latest network summary.
- Explorer: `/explorer <address> [page]` to query address info by page.
- Report: `/report` (reporters only).
- Admin: `/addmod`, `/removemod`, `/send`, `/usecli`.

> ⚠️ Note: All unfinished features have been temporarily removed.  
> This includes: community member registration (robot migration), XEC/SLP/ALP sending, token ID queries, LangChain integration, image generation, etc.

## Quick Start
1) Install dependencies
```bash
npm install