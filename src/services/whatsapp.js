const twilio = require('twilio');
const fs = require('fs');
const config = require('../config');
const { generateResponse, translateText } = require('./ai');
const { splitMessage } = require('../utils/helpers');
const { processAudioFromUrl, textToSpeech, isTranslationRequest, extractTargetLanguage } = require('./audio');
const { addMessage, getMessages, handleTopicChange, detectTopic } = require('../utils/memory');
const { saveChatMessage } = require('./chatHistory');

const client = twilio(config.twilio.accountSid, config.twilio.authToken);

// Upload audio to a public URL for Twilio (using file hosting)
async function sendWhatsAppAudio(to, from, audioPath, caption) {
  try {
    // For WhatsApp, we need a publicly accessible URL
    // Since we can't host files easily, we'll send the transcription text instead
    // In production, you'd upload to S3/Cloudinary and use that URL
    console.log('⚠️ WhatsApp audio requires public URL hosting (skipping audio)');
    return false;
  } catch (error) {
    console.error('❌ WhatsApp Audio Error:', error.message);
    return false;
  }
}

async function handleWebhook(req, res) {
  const { Body: incomingMsg, From: from, To: to, MediaUrl0: mediaUrl, MediaContentType0: mediaType } = req.body;

  // Handle audio/voice messages
  if (mediaUrl && mediaType && mediaType.startsWith('audio/')) {
    console.log(`🎤 WhatsApp voice from ${from}`);

    try {
      const transcribedText = await processAudioFromUrl(mediaUrl, Date.now().toString());

      if (transcribedText) {
        // Check if it's a translation request
        if (isTranslationRequest(transcribedText)) {
          const targetLang = extractTargetLanguage(transcribedText) || 'English';
          const textToTranslate = transcribedText.replace(/translate|translation|convert|say|speak|to \w+|in \w+/gi, '').trim();
          console.log(`🌐 Translating to ${targetLang}: "${textToTranslate}"`);

          // 1. Show what user said
          await client.messages.create({
            body: `🎤 You said: "${textToTranslate}"`,
            from: to,
            to: from,
          });

          // 2. Get translation
          const response = await translateText(textToTranslate, targetLang);
          if (!response) {
            await client.messages.create({
              body: '❌ Translation failed.',
              from: to,
              to: from,
            });
            res.status(200).send('OK');
            return;
          }
          const chunks = splitMessage(response);

          for (const chunk of chunks) {
            await client.messages.create({
              body: chunk,
              from: to,
              to: from,
            });
          }

          // Generate audio (cleanup only - WhatsApp needs file hosting for media)
          const audioPath = `/tmp/tts_wa_${Date.now()}.mp3`;
          const audioFile = await textToSpeech(response, audioPath);
          if (audioFile) {
            fs.unlink(audioFile, () => {});
          }

          saveChatMessage(from, 'whatsapp', from, textToTranslate, response, 'translation');
          console.log('✅ WhatsApp translation sent');
        } else {
          // Regular voice message - show transcription + response with context
          await client.messages.create({
            body: `🎤 You said: "${transcribedText}"`,
            from: to,
            to: from,
          });

          // Check for topic change and clear history if needed
          handleTopicChange(from, transcribedText);

          const history = getMessages(from);
          const response = await generateResponse(transcribedText, history, from, Date.now(), 'whatsapp', from);

          // Save to memory
          addMessage(from, 'user', transcribedText);
          addMessage(from, 'assistant', response);

          const chunks = splitMessage(response);

          for (const chunk of chunks) {
            await client.messages.create({
              body: chunk,
              from: to,
              to: from,
            });
          }
          saveChatMessage(from, 'whatsapp', from, transcribedText, response, detectTopic(transcribedText) || 'general');
          console.log('✅ WhatsApp voice response sent');
        }
      } else {
        await client.messages.create({
          body: '❌ Sorry, I couldn\'t understand the audio. Please try again.',
          from: to,
          to: from,
        });
      }
    } catch (error) {
      console.error('❌ WhatsApp Voice Error:', error.message);
    }

    res.status(200).send('OK');
    return;
  }

  // Handle text messages
  if (!incomingMsg) {
    res.status(200).send('OK');
    return;
  }

  // Check if this is a reply to another message
  const originalMessage = req.body.OriginalRepliedMessageBody;
  let fullContext = incomingMsg;

  if (originalMessage) {
    fullContext = `[Previous message: "${originalMessage}"]\n\n[User's reply: "${incomingMsg}"]`;
    console.log(`💬 WhatsApp reply from ${from}`);
    console.log(`   Original: "${originalMessage.substring(0, 50)}..."`);
    console.log(`   Reply: "${incomingMsg}"`);
  } else {
    console.log(`💬 WhatsApp from ${from}: "${incomingMsg}"`);
  }

  // Check if it's a translation request
  if (isTranslationRequest(incomingMsg)) {
    const targetLang = extractTargetLanguage(incomingMsg) || 'English';
    const textToTranslate = incomingMsg.replace(/translate|translation|convert|say|speak|to \w+|in \w+/gi, '').trim();
    console.log(`🌐 Translating to ${targetLang}: "${textToTranslate}"`);

    const response = await translateText(textToTranslate, targetLang);
    if (!response) {
      await client.messages.create({
        body: '❌ Translation failed.',
        from: to,
        to: from,
      });
      res.status(200).send('OK');
      return;
    }
    const chunks = splitMessage(response);

    try {
      for (const chunk of chunks) {
        await client.messages.create({
          body: chunk,
          from: to,
          to: from,
        });
      }

      // Generate audio (cleanup only - WhatsApp needs file hosting for media)
      const audioPath = `/tmp/tts_wa_${Date.now()}.mp3`;
      const audioFile = await textToSpeech(response, audioPath);
      if (audioFile) {
        fs.unlink(audioFile, () => {});
      }

      saveChatMessage(from, 'whatsapp', from, incomingMsg, response, 'translation');
      console.log('✅ WhatsApp translation sent');
    } catch (error) {
      console.error('❌ WhatsApp Error:', error.message);
    }
  } else {
    // Check for topic change and clear history if needed
    handleTopicChange(from, incomingMsg);

    // Get conversation history and generate response with context
    const history = getMessages(from);
    const response = await generateResponse(fullContext, history, from, Date.now(), 'whatsapp', from);

    // Save to memory
    addMessage(from, 'user', fullContext);
    addMessage(from, 'assistant', response);

    const chunks = splitMessage(response);

    try {
      for (const chunk of chunks) {
        await client.messages.create({
          body: chunk,
          from: to,
          to: from,
        });
      }
      saveChatMessage(from, 'whatsapp', from, incomingMsg, response, detectTopic(incomingMsg) || 'general');
      console.log(`✅ WhatsApp response sent (${chunks.length} message${chunks.length > 1 ? 's' : ''})`);
    } catch (error) {
      console.error('❌ WhatsApp Error:', error.message);
    }
  }

  res.status(200).send('OK');
}

module.exports = { handleWebhook };
