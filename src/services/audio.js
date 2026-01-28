const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const config = require('../config');

const openai = new OpenAI({ apiKey: config.openai.apiKey });

// Download file from URL
async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// Transcribe audio using Whisper
async function transcribeAudio(filePath) {
  try {
    console.log('🎤 Transcribing audio with Whisper...');

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
      language: 'en', // Auto-detect if removed
    });

    console.log(`✅ Transcribed: "${transcription.text}"`);
    return transcription.text;
  } catch (error) {
    console.error('❌ Whisper Error:', error.message);
    return null;
  }
}

// Process audio from URL
async function processAudioFromUrl(url, fileId) {
  const tempDir = '/tmp';
  const tempFile = path.join(tempDir, `audio_${fileId}.ogg`);

  try {
    await downloadFile(url, tempFile);
    const text = await transcribeAudio(tempFile);

    // Cleanup
    fs.unlink(tempFile, () => {});

    return text;
  } catch (error) {
    console.error('❌ Audio Processing Error:', error.message);
    fs.unlink(tempFile, () => {});
    return null;
  }
}

module.exports = { transcribeAudio, processAudioFromUrl, downloadFile };
