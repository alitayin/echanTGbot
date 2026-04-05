# Changelog

All notable changes to this project will be documented in this file.

## [2.9.1] - 2026-04-05

### Added
- Axiom-only logging for user messages (privacy-preserving debugging)
- Comprehensive spam detection tests (26 tests covering all spam patterns)
- Detailed error logging for `hasMember` function failures
- Fallback mechanism when message forwarding fails
- `forwardMessage` method to MockTelegramBot for testing

### Fixed
- Fixed spam detection being skipped due to silent API failures
- Fixed "bot.forwardMessage is not a function" error in tests
- Fixed MESSAGE_ID_INVALID errors with better error handling
- Improved error messages for different Telegram API failures

### Improved
- Enhanced anti-spam system robustness with better error handling
- Better observability: now logs full message content to Axiom (not local console)
- Spam detection now sends message content as fallback when forwarding fails
- More detailed error logging for debugging spam detection issues

### Documentation
- Added SPAM_DETECTION_IMPROVEMENTS.md
- Added FORWARD_MESSAGE_FIX.md
- Added 工作总结.md (Chinese summary)

## [2.9.0] - Previous version
