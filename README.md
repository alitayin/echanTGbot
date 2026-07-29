## XEC Telegram Bot

eChan Telegram bot for group management and data queries. 

## Features
- Conversational Q&A: mention `@alitayinGPTbot` or the keyword `echan`; DM supported.
- Optional group protection: spam detection, newcomer restrictions, flood protection, and anti-impersonation. Protection is disabled by default.
- Trusted-user translation: trusted users and allowlisted admins are translated in configured target groups.
- Whitelist Keywords: `/whitelisting <keyword>` to request whitelisting (bypasses spam detection, requires admin approval); `/listwhitelist` and `/removewhitelist` for admins.
- Price: `/price` returns the latest XEC price.
- Avalanche: `/ava` returns the latest network summary.
- Explorer: `/explorer <address> [page]` to query address info by page.
- Report: `/report` (reporters only).
- User Registration: `/signup <address>` to register your address and get a deposit address.
- Token Sending: `/send <amount>` for XEC or `/send <tokenId|alias> <amount>` for SLP/ALP tokens (admin only, reply to user message, supports aliases like `oorah`, auto-detects token type).
- Admin Commands: `/addlicense`, `/removelicense`, `/listlicenses`, `/getaddress`, `/listaddresses`.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Create a `.env` file in the project root:

```bash
# Telegram Bot
TELEGRAM_TOKEN=your_telegram_bot_token
BOT_USERNAME=your_bot_username

# Bot Wallet (for token sending)
MNEMONIC="your twelve word mnemonic phrase"

# Admin Users (comma-separated usernames)
ALLOWED_USERS=username1,username2

# Groups where trusted-user auto-translation is enabled
TARGET_GROUP_IDS=-1001234567890

# Protection is disabled on a fresh installation. These values are only
# required when an admin enables protection.
NOTIFICATION_GROUP_ID=-1001234567890
SPAM_THRESHOLD=5
ADDITIONAL_API_KEY=your_analysis_api_key
SECONDARY_SPAM_API_KEY=your_secondary_spam_api_key
ALITAYIN_USER_ID=your_target_user_id

# Dify timeouts (optional)
AI_REQUEST_TIMEOUT_MS=120000
AI_UPLOAD_TIMEOUT_MS=60000

# Storage root (optional, defaults to ./data). Individual *_DB_PATH variables
# can override one store when needed.
DATA_DIR=data

# Logging
LOG_LEVEL=info              # optional, defaults to info
LOCAL_LOG_ENABLED=true      # optional, defaults to true
LOG_DIR=logs                # optional, defaults to ./logs

# Axiom logging is off by default. Only set this block if you want remote logs.
AXIOM_ENABLED=false
AXIOM_TOKEN=your_axiom_token
AXIOM_DATASET=       # your dataset name
AXIOM_ORG_ID=        # optional, if your org requires it

# Other configurations...
```

Local file logs are written to:
- `logs/combined.log` for all console-backed logs
- `logs/error.log` for error-level logs
- `logs/private.log` for detailed message records that are intentionally kept out of the console
- `logs/exceptions.log` and `logs/rejections.log` for uncaught failures

### 3. Start the bot
```bash
npm start
```

Protection starts disabled when no local protection state exists. An allowlisted
admin can manage the global state in a private chat with the bot:

```text
/protectionstatus
/enableprotection
/disableprotection
```

Trusted translation users can also be managed by an allowlisted admin in a
private chat:

```text
/trustuser <telegram_user_id>
/untrustuser <telegram_user_id>
/truststatus <telegram_user_id>
```

The manual state is stored under `data/` and survives restarts. It is not part of
Git, so a fresh checkout starts with protection disabled. Translation and LLM
replies remain available while protection is disabled.

When eChan deletes an original message, it also deletes translations linked to
that message. Telegram does not notify regular bots when a user or another admin
manually deletes a message, so external manual deletions cannot be cascaded.

## Documentation

- [Token Send Feature](docs/TOKEN_SEND_FEATURE.md) - Detailed guide for sending XEC and SLP tokens
- [User Address Registration](docs/USER_ADDRESS_REGISTRATION.md) - User signup and address management
- [License Management](docs/LICENSE_MANAGEMENT.md) - Reporter permissions management
- [Whitelist Keywords](docs/WHITELIST_FEATURE.md) - Keyword whitelist management for spam detection bypass

## License

MIT
