# Changelog

## [2.9.0] - 2026-04-03

### Added
- **Router Refactoring**: Complete rewrite of command routing system
  - New middleware-based architecture
  - Command router with pattern matching (string, regex, wildcard)
  - Reusable authorization middleware
  - Separated command handlers into individual functions
  - Central command registry for easy management
- **Testing Infrastructure**:
  - MockTelegramBot helper for unit testing
  - Integration tests for command router
  - Testing guide with best practices
  - Command integration test examples

### Changed
- **router.js**: Reduced from 1276 lines to ~550 lines (57% reduction)
- **Code Organization**: 
  - Extracted command handlers to `routes/commandHandlers.js`
  - Created middleware system in `middleware/` directory
  - Centralized command registration in `routes/commandRegistry.js`

### Improved
- **Maintainability**: Much easier to add/modify commands
- **Testability**: All components now easily testable in isolation
- **Code Quality**: Eliminated repetitive authorization checks
- **Separation of Concerns**: Clear boundaries between routing, auth, and business logic

### Documentation
- Added `REFACTORING.md` - Summary of architectural changes
- Added `TESTING_GUIDE.md` - Comprehensive testing best practices

## [2.8.4] - Previous Release
- Various bug fixes and improvements
