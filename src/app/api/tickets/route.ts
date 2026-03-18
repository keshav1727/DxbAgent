import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

const ticketSchema = new mongoose.Schema({
  ticketId: String,
  chatId: String,
  platform: String,
  userName: String,
  issue: String,
  status: String,
  createdAt: Date,
});

function getModel() {
  return mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);
}

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  if (!MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(MONGODB_URI);
}

export async function GET() {
  try {
    await connectDB();
    const Ticket = getModel();
    const tickets = await Ticket.find({}).sort({ createdAt: -1 }).limit(100);
    return NextResponse.json(tickets);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await connectDB();
    const Ticket = getModel();
    const { ticketId, status } = await req.json();
    await Ticket.updateOne({ ticketId }, { status });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
