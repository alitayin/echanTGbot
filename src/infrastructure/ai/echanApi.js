// echanApi.js
const axios = require("axios");

class EchanApiClient {
  constructor(apiKey, apiEndpoint) {
    this.apiKey = apiKey;
    this.apiEndpoint = apiEndpoint;
    this.defaultHeaders = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async sendTextRequest(query, userId, conversationId = "") {
    const requestData = {
      inputs: {},
      query: query,
      response_mode: "blocking",
      conversation_id: conversationId,
      user: String(userId),
    };

    const response = await axios.post(this.apiEndpoint, requestData, {
      headers: this.defaultHeaders,
      timeout: 500 * 1000,
    });

    return response.data;
  }

  /** Download image bytes. */
  async _downloadImageToBuffer(imageUrl) {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30 * 1000,
    });
    return Buffer.from(response.data);
  }

  /** Infer filename from URL. */
  _inferFilenameFromUrl(imageUrl) {
    try {
      const urlObj = new URL(imageUrl);
      const pathname = urlObj.pathname || '';
      const last = pathname.split('/').pop() || '';
      if (last && /\.(png|jpe?g|webp|gif)$/i.test(last)) {
        return last;
      }
    } catch (_) {}
    return 'telegram_image.jpg';
  }

  /** Detect Telegram file URLs. */
  _isTelegramFileUrl(imageUrl) {
    return typeof imageUrl === 'string' && imageUrl.includes('api.telegram.org/file/bot');
  }

  /** Upload file buffer to service. */
  async _uploadFileToService(fileBuffer, fileName, userId) {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fileBuffer, { filename: fileName });
    form.append('user', String(userId));

    const uploadEndpoint = this.apiEndpoint.replace('/chat-messages', '/files/upload');

    const response = await axios.post(uploadEndpoint, form, {
      headers: {
        Authorization: this.defaultHeaders.Authorization,
        ...form.getHeaders(),
      },
      timeout: 60 * 1000,
    });
    return response.data;
  }

  async sendStreamingTextRequest(query, userId, conversationId = "") {
    const requestData = {
      inputs: {},
      query: query,
      response_mode: "streaming",
      conversation_id: conversationId,
      user: String(userId),
    };

    const response = await axios.post(this.apiEndpoint, requestData, {
      headers: this.defaultHeaders,
      timeout: 600 * 1000,
      responseType: 'stream'
    });

    let fullAnswer = '';
    let finalConversationId = conversationId;
    let buffer = '';
    
    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]' || jsonStr === '') {
                continue;
              }
              const data = JSON.parse(jsonStr);
              if (data.event === 'message' || data.event === 'agent_message') {
                if (data.answer) {
                  fullAnswer += data.answer;
                }
                if (data.conversation_id) {
                  finalConversationId = data.conversation_id;
                }
              } else if (data.event === 'message_end') {
                resolve({
                  answer: fullAnswer,
                  conversation_id: data.conversation_id || finalConversationId,
                  metadata: data.metadata
                });
                return;
              } else if (data.event === 'error') {
                reject(new Error(`Streaming error: ${data.message} (code: ${data.code})`));
                return;
              }
            } catch (e) {
              if (line.trim() !== 'data: ') {
                console.log('⚠️ JSON parse error:', line.slice(0, 100), '...', e.message);
              }
            }
          }
        }
      });

      response.data.on('end', () => {
        if (fullAnswer) {
          resolve({
            answer: fullAnswer,
            conversation_id: finalConversationId
          });
        } else {
          reject(new Error('No response received from streaming'));
        }
      });

      response.data.on('error', (err) => {
        console.error('❌ Streaming response error:', err);
        reject(err);
      });
    });
  }

  async sendImageRequest(imageUrl, query, userId, conversationId = "") {
    const inputUrls = Array.isArray(imageUrl) ? imageUrl : [imageUrl];

    // Build files payload: for Telegram URLs upload to service first, otherwise use remote_url directly
    const files = [];
    for (const url of inputUrls) {
      if (this._isTelegramFileUrl(url)) {
        const buffer = await this._downloadImageToBuffer(url);
        const fileName = this._inferFilenameFromUrl(url);
        const uploadRes = await this._uploadFileToService(buffer, fileName, userId);
        files.push({
          type: 'image',
          transfer_method: 'local_file',
          upload_file_id: uploadRes.id,
        });
      } else {
        files.push({
          type: 'image',
          transfer_method: 'remote_url',
          url,
        });
      }
    }

    const requestData = {
      inputs: {},
      files,
      query,
      response_mode: 'blocking',
      user: String(userId),
      conversation_id: conversationId,
    };

    const response = await axios.post(this.apiEndpoint, requestData, {
      headers: this.defaultHeaders,
      timeout: 500 * 1000,
    });
    return response.data;
  }
}

module.exports = EchanApiClient;
