const mongoose = require('mongoose');
const config = require('../config');

// Support Ticket schema
const ticketSchema = new mongoose.Schema({
  ticketId: { type: String, required: true, unique: true },
  chatId: { type: String, required: true },
  platform: { type: String, required: true, enum: ['whatsapp', 'telegram'] },
  userName: { type: String, default: 'Unknown' },
  issue: { type: String, required: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  createdAt: { type: Date, default: Date.now },
});

const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);

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

async function createTicket(chatId, platform, userName, issue) {
  if (!isConnected) return null;

  try {
    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`;
    const ticket = await Ticket.create({
      ticketId,
      chatId: String(chatId),
      platform,
      userName,
      issue,
      status: 'open',
      createdAt: new Date(),
    });
    return ticket.ticketId;
  } catch (error) {
    console.error('❌ Error creating ticket:', error.message);
    return null;
  }
}

module.exports = { connectDB, saveChatMessage, ChatMessage, createTicket, Ticket };
