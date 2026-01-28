const twilio = require('twilio');
const config = require('../config');
const { generateResponse } = require('./ai');
const { splitMessage } = require('../utils/helpers');
const { processAudioFromUrl } = require('./audio');

const client = twilio(config.twilio.accountSid, config.twilio.authToken);

async function handleWebhook(req, res) {
  const { Body: incomingMsg, From: from, To: to, MediaUrl0: mediaUrl, MediaContentType0: mediaType } = req.body;

  // Handle audio/voice messages
  if (mediaUrl && mediaType && mediaType.startsWith('audio/')) {
    console.log(`🎤 WhatsApp voice from ${from}`);

    try {
      const transcribedText = await processAudioFromUrl(mediaUrl, Date.now().toString());

      if (transcribedText) {
        // Send transcription
        await client.messages.create({
          body: `🎤 You said: "${transcribedText}"`,
          from: to,
          to: from,
        });

        // Generate and send AI response
        const response = await generateResponse(transcribedText);
        const chunks = splitMessage(response);

        for (const chunk of chunks) {
          await client.messages.create({
            body: chunk,
            from: to,
            to: from,
          });
        }
        console.log('✅ WhatsApp voice response sent');
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

  const response = await generateResponse(fullContext);
  const chunks = splitMessage(response);

  try {
    for (const chunk of chunks) {
      await client.messages.create({
        body: chunk,
        from: to,
        to: from,
      });
    }
    console.log(`✅ WhatsApp response sent (${chunks.length} message${chunks.length > 1 ? 's' : ''})`);
  } catch (error) {
    console.error('❌ WhatsApp Error:', error.message);
  }

  res.status(200).send('OK');
}

module.exports = { handleWebhook };
