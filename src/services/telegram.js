const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const { generateResponse } = require('./ai');
const { processAudioFromUrl } = require('./audio');

let bot = null;

// Split message for Telegram (max 4096 chars)
function splitTelegramMessage(text, maxLength = 4000) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks;
}

// Send long message in chunks
async function sendLongMessage(chatId, text) {
  const chunks = splitTelegramMessage(text);
  for (const chunk of chunks) {
    await bot.sendMessage(chatId, chunk);
  }
}

function init() {
  bot = new TelegramBot(config.telegram.token, { polling: true });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || 'User';

    // Handle voice messages
    if (msg.voice) {
      console.log(`🎤 Voice message from ${userName}`);
      await bot.sendChatAction(chatId, 'typing');

      try {
        const fileId = msg.voice.file_id;
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;

        const transcribedText = await processAudioFromUrl(fileUrl, fileId);

        if (transcribedText) {
          await bot.sendMessage(chatId, `🎤 *You said:* "${transcribedText}"`, { parse_mode: 'Markdown' });

          await bot.sendChatAction(chatId, 'typing');
          const response = await generateResponse(transcribedText);
          await sendLongMessage(chatId, response);
          console.log('✅ Voice response sent');
        } else {
          await bot.sendMessage(chatId, '❌ Sorry, I couldn\'t understand the audio. Please try again.');
        }
      } catch (error) {
        console.error('❌ Voice Error:', error.message);
        await bot.sendMessage(chatId, '❌ Error processing voice message.');
      }
      return;
    }

    // Handle audio files
    if (msg.audio) {
      console.log(`🎵 Audio file from ${userName}`);
      await bot.sendChatAction(chatId, 'typing');

      try {
        const fileId = msg.audio.file_id;
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;

        const transcribedText = await processAudioFromUrl(fileUrl, fileId);

        if (transcribedText) {
          await bot.sendMessage(chatId, `🎤 *Transcription:* "${transcribedText}"`, { parse_mode: 'Markdown' });

          await bot.sendChatAction(chatId, 'typing');
          const response = await generateResponse(transcribedText);
          await sendLongMessage(chatId, response);
          console.log('✅ Audio response sent');
        } else {
          await bot.sendMessage(chatId, '❌ Sorry, I couldn\'t transcribe the audio.');
        }
      } catch (error) {
        console.error('❌ Audio Error:', error.message);
        await bot.sendMessage(chatId, '❌ Error processing audio file.');
      }
      return;
    }

    // Handle text messages
    const messageText = msg.text;
    if (!messageText) return;

    // Check if this is a reply to another message
    let fullContext = messageText;
    if (msg.reply_to_message) {
      const originalMsg = msg.reply_to_message.text || msg.reply_to_message.caption || '';
      if (originalMsg) {
        fullContext = `[Previous message: "${originalMsg}"]\n\n[User's reply: "${messageText}"]`;
        console.log(`📱 Telegram reply from ${userName}`);
        console.log(`   Original: "${originalMsg.substring(0, 50)}..."`);
        console.log(`   Reply: "${messageText}"`);
      }
    } else {
      console.log(`📱 Telegram from ${userName}: "${messageText}"`);
    }

    await bot.sendChatAction(chatId, 'typing');
    const response = await generateResponse(fullContext);
    await sendLongMessage(chatId, response);
    console.log('✅ Telegram response sent');
  });

  bot.on('polling_error', (error) => {
    console.error('❌ Telegram Polling error:', error.message);
  });

  console.log('📱 Telegram: Polling mode active (Voice enabled)');
  return bot;
}

function stop() {
  if (bot) {
    bot.stopPolling();
  }
}

module.exports = { init, stop };
