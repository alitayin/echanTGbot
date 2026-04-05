# Anti-Spam Detection Improvements

## Summary

Enhanced the anti-spam detection system to be more robust and comprehensive, with strong test coverage for various spam patterns.

## Key Improvements

### 1. Enhanced Error Logging

**File**: `src/presentation/portsFactory.js`

Added detailed error logging in the `hasMember` function to diagnose why spam detection might be skipped:

```javascript
} catch (error) {
    console.error(`[hasMember] Failed to check member status: chatId=${chatId}, userId=${userId}, error=${error?.message || String(error)}`);
    // ...
}
```

**Benefit**: Now you can see in logs if API calls fail due to rate limiting, network issues, or permission problems.

### 2. Axiom-Only Logging for User Messages

**Files**: 
- `src/utils/logger.js` - Added `logger.axiomOnly()` method
- `src/application/usecases/spamHandler.js` - Log full message content to Axiom

**Implementation**:
```javascript
// Log full message content to Axiom only (not to local console)
logger.axiomOnly('info', 'Group message received', {
    chatId: msg.chat.id,
    fromId: msg?.from?.id ?? msg?.sender_chat?.id,
    messageId: msg.message_id,
    query: query,  // Full message content
    hasImage: hasImageMedia(msg),
    timestamp: new Date().toISOString()
});
```

**Benefit**: User message content is sent to Axiom for analysis but not printed to local logs, maintaining privacy while enabling debugging.

### 3. Comprehensive Test Coverage

**File**: `tests/application/usecases/spamDetection.comprehensive.test.js`

Created 26 comprehensive tests covering:

#### Forwarded Message Spam Patterns
- Spam forwarded from user
- Spam forwarded from channel
- Spam forwarded from hidden user (privacy settings)
- Forwarded messages with captions

#### Channel Sender Spam Patterns
- Spam from channels posted to groups
- Channels with username only (no title)

#### External Reply Spam Patterns (Quoting from other channels)
- User quotes external channel message containing spam
- External reply with caption instead of text
- External reply with only channel name (no text)
- External reply from user (not channel)

#### Reply to Message Spam Patterns
- Spam in replied message
- Spam in replied message with caption
- Reply to forwarded message

#### Combined Spam Patterns
- Both reply_to_message and external_reply
- Forwarded message with external reply
- Channel sender with external reply

#### Long Username Spam Patterns
- Users with very long names (often spam indicators)
- Combined first + last name spam

#### Other Spam Vectors
- Contact sharing spam
- Poll spam
- Location spam
- Venue spam

#### Real-World Examples
- SOL SPIN bot spam pattern
- Airdrop scam pattern
- Pump and dump signal pattern
- Investment scam with testimonial

## Current Spam Detection Coverage

The `buildCombinedAnalysisQuery` function now extracts and analyzes:

1. **Message text/caption** - Primary content
2. **Forwarded messages** - Including source (user/channel/hidden)
3. **Channel senders** - Channel name and username
4. **External replies** - Cross-chat/channel quoted messages
5. **Reply to message** - In-chat replies
6. **Long usernames** - Spam indicator (>30 chars)
7. **Reply markup** - Inline buttons (often used in spam)
8. **Polls** - Question and options
9. **Contacts** - Name, phone, user ID
10. **Locations** - Coordinates
11. **Venues** - Name and address
12. **Games** - Game title
13. **Dice** - Emoji and value
14. **Documents** - File name/type
15. **Images** - Marked as containing image

## Test Results

All 26 comprehensive tests pass:

```
✓ Spam Detection - Forwarded Messages (4 tests)
✓ Spam Detection - Channel Senders (2 tests)
✓ Spam Detection - External Replies (4 tests)
✓ Spam Detection - Reply to Message (3 tests)
✓ Spam Detection - Combined Patterns (3 tests)
✓ Spam Detection - Long Usernames (2 tests)
✓ Spam Detection - Other Vectors (4 tests)
✓ Spam Detection - Real World Examples (4 tests)
```

## How It Works

### Detection Flow

1. **Message arrives** → `processGroupMessage()`
2. **Build query** → `buildCombinedAnalysisQuery()` extracts all spam vectors
3. **Log to Axiom** → Full content sent to Axiom (not local logs)
4. **Check prerequisites**:
   - Is bot admin?
   - Is ALITAYIN in group?
   - Is user trusted?
   - Contains whitelist keyword?
5. **Cache check** → Similar spam seen before?
6. **API analysis** → Send to AI for spam detection
7. **Secondary check** → If borderline, run secondary analysis
8. **Take action** → Delete, ban, notify

### Example: SOL SPIN Bot Detection

**Input message**:
```
User quotes external channel "SOL Promotions":
"🔥SOL SPIN is here!
🤯First Spin free!
⚡️You can win:
⚫️ SOL tokens
⚫️ Exclusive rewards
⚫️ Special bonuses
🔗@getsolspinbot"
```

**Query sent to API**:
```
[External quote from "SOL Promotions"]: 🔥SOL SPIN is here!

🤯First Spin free!

⚡️You can win:
⚫️ SOL tokens
⚫️ Exclusive rewards
⚫️ Special bonuses

🔗@getsolspinbot
```

**Result**: API detects high spam score → Message deleted → User kicked/banned → Forwarded to notification group

## Debugging

### If spam is not detected:

1. **Check logs for**:
   - `Has target member: false` → ALITAYIN not in group
   - `[hasMember] Failed to check member status` → API error
   - `Bot is not admin` → Bot lacks permissions
   - `Target member not in group, skipping spam detection` → ALITAYIN check failed

2. **Check Axiom logs**:
   - Search for `message: "Group message received"`
   - Check the `query` field to see what was sent to API
   - Verify all spam vectors are included

3. **Verify configuration**:
   - `ALITAYIN_USER_ID` is correct
   - Bot has admin permissions in the group
   - ALITAYIN is actually in the group

## Future Enhancements

Potential improvements:
1. Add ML-based spam pattern recognition
2. Implement reputation scoring for users
3. Add configurable spam thresholds per group
4. Create spam pattern database for faster detection
5. Add support for video/audio spam detection
6. Implement rate limiting for suspicious users

## Running Tests

```bash
# Run comprehensive spam detection tests
npm test -- spamDetection.comprehensive.test.js

# Run all spam-related tests
npm test -- spam
```

## Files Modified

1. `src/presentation/portsFactory.js` - Added error logging
2. `src/utils/logger.js` - Added axiomOnly method
3. `src/application/usecases/spamHandler.js` - Added Axiom logging
4. `tests/application/usecases/spamDetection.comprehensive.test.js` - New comprehensive tests
5. `tests/application/usecases/spamDetection.integration.test.js` - New integration tests (WIP)
