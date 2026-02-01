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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    await connectDB();
    const ChatMessage = getModel();
    const { chatId } = await params;

    const messages = await ChatMessage.find({ chatId })
      .sort({ timestamp: 1 })
      .lean();

    return NextResponse.json(messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
