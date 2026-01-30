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
    });

    console.log(`✅ Transcribed: "${transcription.text}"`);
    return transcription.text;
  } catch (error) {
    console.error('❌ Whisper Error:', error.message);
    return null;
  }
}

// Text-to-Speech using OpenAI TTS
async function textToSpeech(text, outputPath) {
  try {
    console.log('🔊 Converting text to speech...');

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy', // Options: alloy, echo, fable, onyx, nova, shimmer
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    await fs.promises.writeFile(outputPath, buffer);

    console.log('✅ Audio generated');
    return outputPath;
  } catch (error) {
    console.error('❌ TTS Error:', error.message);
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

    fs.unlink(tempFile, () => {});
    return text;
  } catch (error) {
    console.error('❌ Audio Processing Error:', error.message);
    fs.unlink(tempFile, () => {});
    return null;
  }
}

// Check if message is a translation request
function isTranslationRequest(text) {
  const lower = text.toLowerCase();
  const keywords = ['translate', 'translation', 'convert to', 'say in', 'speak in', 'in hindi', 'in english', 'in spanish', 'in french', 'in german', 'in japanese', 'in chinese', 'in korean', 'in arabic', 'in tamil', 'in telugu', 'in bengali', 'in marathi', 'in gujarati', 'in punjabi'];
  return keywords.some(k => lower.includes(k));
}

// Extract target language from text
function extractTargetLanguage(text) {
  const lower = text.toLowerCase();
  const languages = {
    'hindi': 'Hindi',
    'english': 'English',
    'spanish': 'Spanish',
    'french': 'French',
    'german': 'German',
    'japanese': 'Japanese',
    'chinese': 'Chinese',
    'korean': 'Korean',
    'arabic': 'Arabic',
    'tamil': 'Tamil',
    'telugu': 'Telugu',
    'bengali': 'Bengali',
    'marathi': 'Marathi',
    'gujarati': 'Gujarati',
    'punjabi': 'Punjabi',
    'italian': 'Italian',
    'portuguese': 'Portuguese',
    'russian': 'Russian',
  };

  for (const [key, value] of Object.entries(languages)) {
    if (lower.includes(key)) {
      return value;
    }
  }
  return null;
}

module.exports = {
  transcribeAudio,
  processAudioFromUrl,
  downloadFile,
  textToSpeech,
  isTranslationRequest,
  extractTargetLanguage
};
