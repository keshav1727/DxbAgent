import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

const chatMessageSchema = new mongoose.Schema({
  chatId: String,
  platform: String,
  userName: String,
  userMessage: String,
  botResponse: String,
  topic: String,
  timestamp: Date,
});

function getModel() {
  return mongoose.models.ChatMessage || mongoose.model('ChatMessage', chatMessageSchema);
}

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  if (!MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(MONGODB_URI);
}

export async function GET() {
  try {
    await connectDB();
    const ChatMessage = getModel();

    const users = await ChatMessage.aggregate([
      {
        $group: {
          _id: '$chatId',
          platform: { $last: '$platform' },
          userName: { $last: '$userName' },
          messageCount: { $sum: 1 },
          lastMessageAt: { $max: '$timestamp' },
          lastMessage: { $last: '$userMessage' },
        },
      },
      { $sort: { lastMessageAt: -1 } },
    ]);

    const result = users.map((u) => ({
      chatId: u._id,
      platform: u.platform,
      userName: u.userName,
      messageCount: u.messageCount,
      lastMessageAt: u.lastMessageAt,
      lastMessage: u.lastMessage,
    }));

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
