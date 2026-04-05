# Forward Message 错误修复

## 问题描述

在日志中发现两类错误：

1. **MESSAGE_ID_INVALID** - Telegram API 返回消息ID无效
2. **bot.forwardMessage is not a function** - 在测试环境中 mock bot 缺少此方法

```
Failed to forward message: TelegramError: 400 Bad Request: MESSAGE_ID_INVALID
Failed to forward message: TypeError: bot.forwardMessage is not a function
```

## 根本原因

### 1. MESSAGE_ID_INVALID 错误
当尝试转发一个已经被删除或不存在的消息时，Telegram API 会返回此错误。这可能发生在：
- 消息在转发前被用户删除
- 消息ID不正确
- 消息来自不同的聊天

### 2. bot.forwardMessage is not a function
在测试环境中，`MockTelegramBot` 类没有实现 `forwardMessage` 方法，导致测试失败。

## 解决方案

### 1. 增强错误处理 (`src/infrastructure/telegram/adminActions.js`)

```javascript
async function forwardMessage(bot, targetChatId, fromChatId, messageId) {
  try {
    // Check if bot has forwardMessage method
    if (typeof bot.forwardMessage !== 'function') {
      console.error('Failed to forward message: bot.forwardMessage is not a function');
      return false;
    }

    await bot.forwardMessage(targetChatId, fromChatId, messageId);
    return true;
  } catch (error) {
    // Handle specific Telegram errors
    if (error.message.includes('MESSAGE_ID_INVALID')) {
      console.error(`Failed to forward message: Message ID ${messageId} is invalid or has been deleted`);
    } else if (error.message.includes('MESSAGE_TO_FORWARD_NOT_FOUND')) {
      console.error(`Failed to forward message: Message ${messageId} not found in chat ${fromChatId}`);
    } else {
      console.error('Failed to forward message:', error.message || error);
    }
    return false;
  }
}
```

**改进点**：
- ✅ 检查 bot 对象是否有 `forwardMessage` 方法
- ✅ 针对不同的 Telegram 错误提供更详细的日志
- ✅ 返回 boolean 表示成功/失败

### 2. 添加 Fallback 机制 (`src/application/usecases/spamHandler.js`)

```javascript
// Try to forward the message for evidence, but don't fail if it doesn't work
const forwardSuccess = await forwardMessage(bot, NOTIFICATION_GROUP_ID, msg.chat.id, msg.message_id);
if (!forwardSuccess) {
    // If forward fails, send the message content as text instead
    const messageContent = query || buildCombinedAnalysisQuery(msg);
    const fallbackInfo = `⚠️ Could not forward message (ID: ${msg.message_id})\n\nContent:\n${messageContent.substring(0, 500)}${messageContent.length > 500 ? '...' : ''}`;
    await bot.sendMessage(NOTIFICATION_GROUP_ID, fallbackInfo);
}
```

**改进点**：
- ✅ 转发失败时不会中断 spam 处理流程
- ✅ 提供 fallback：发送消息内容的文本版本
- ✅ 限制文本长度为 500 字符，避免超长消息

### 3. 修复 MockTelegramBot (`tests/helpers/MockTelegramBot.js`)

```javascript
async forwardMessage(toChatId, fromChatId, messageId) {
    // Mock forwarding - just record the action
    if (!this.forwardedMessages) {
        this.forwardedMessages = [];
    }
    this.forwardedMessages.push({ toChatId, fromChatId, messageId });
    return {
        message_id: Date.now() + Math.random(),
        chat: { id: toChatId },
        forward_from_chat: { id: fromChatId },
    };
}
```

**改进点**：
- ✅ 添加了 `forwardMessage` 方法到 mock bot
- ✅ 记录所有转发操作用于测试验证
- ✅ 返回符合 Telegram API 格式的响应

## 测试结果

```
✅ Test Files: 23 passed (23)
✅ Tests: 304 passed | 4 skipped (308)
✅ Duration: 1.34s
```

所有测试通过，没有破坏现有功能。

## 影响

### 正面影响
1. **更好的错误处理** - 现在可以看到具体的失败原因
2. **更强的容错性** - 转发失败不会影响 spam 删除
3. **更好的可观测性** - 即使转发失败，也能看到消息内容
4. **测试稳定性** - 修复了测试环境中的错误

### 行为变化
- **之前**：转发失败时只记录错误，但不提供消息内容
- **现在**：转发失败时会发送消息内容的文本版本作为 fallback

## 文件修改

1. ✅ `src/infrastructure/telegram/adminActions.js` - 增强错误处理
2. ✅ `src/application/usecases/spamHandler.js` - 添加 fallback 机制
3. ✅ `tests/helpers/MockTelegramBot.js` - 添加 forwardMessage 方法

## 未来建议

如果继续遇到 MESSAGE_ID_INVALID 错误，可以考虑：

1. **添加重试机制** - 对于临时性错误进行重试
2. **使用 copyMessage** - 作为 forwardMessage 的替代方案
3. **截图功能** - 对于重要的 spam 消息，可以考虑截图保存
4. **消息缓存** - 在删除前先缓存消息内容

## 总结

✅ 修复了 forwardMessage 相关的两个错误
✅ 添加了详细的错误日志
✅ 实现了 fallback 机制，确保即使转发失败也能保留证据
✅ 所有测试通过
✅ 提高了系统的容错性和可观测性
