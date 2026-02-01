const mongoose = require('mongoose');
const config = require('../config');

// ChatMessage schema
const chatMessageSchema = new mongoose.Schema({
  chatId: { type: String, required: true, index: true },
  platform: { type: String, required: true, enum: ['whatsapp', 'telegram'] },
  userName: { type: String, default: 'Unknown' },
  userMessage: { type: String, required: true },
  botResponse: { type: String, required: true },
  topic: { type: String, default: 'general' },
  timestamp: { type: Date, default: Date.now },
});

chatMessageSchema.index({ chatId: 1, timestamp: -1 });

const ChatMessage = mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = config.mongodb.uri;
  if (!uri) {
    console.log('⚠️  MONGODB_URI not set — chat history will not be saved');
    return;
  }

  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
  }
}

async function saveChatMessage(chatId, platform, userName, userMessage, botResponse, topic) {
  if (!isConnected) return;

  try {
    await ChatMessage.create({
      chatId: String(chatId),
      platform,
      userName,
      userMessage,
      botResponse,
      topic: topic || 'general',
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('❌ Error saving chat message:', error.message);
  }
}

module.exports = { connectDB, saveChatMessage, ChatMessage };
