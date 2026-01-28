# Multi-Platform AI Agent

A powerful **AI agent** built with **Vercel AI SDK** and **GPT-4o** that can answer questions via **Telegram** and **WhatsApp** prompts.

## Features

- 🤖 **GPT-4o Integration** via Vercel AI SDK
- 📱 **Telegram Bot** support with API key
- 💬 **WhatsApp Bot** support via Twilio API
- 🔄 **Real-time AI responses** on both platforms
- 🌐 **Webhook support** for WhatsApp + **Polling mode** for Telegram
- 🔐 **Secure environment configuration**

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your tokens:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token
   OPENAI_API_KEY=your_openai_api_key
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   PORT=3001
   ```

3. **Run the bot:**
   ```bash
   npm run bot
   ```

4. **Message your bots:**
   - **Telegram**: Open Telegram and find your bot
   - **WhatsApp**: Message your Twilio WhatsApp number
   - Start chatting with AI-powered responses on both platforms!

## Getting API Keys

### Telegram Bot Token
1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Use `/newbot` command
3. Copy the provided token

### OpenAI API Key
1. Visit [OpenAI Platform](https://platform.openai.com)
2. Go to API Keys section
3. Create and copy a new API key
4. Add credits if needed

### Twilio WhatsApp Setup
1. Create account at [Twilio Console](https://console.twilio.com)
2. Go to **Messaging > Try it out > Send a WhatsApp message**
3. Copy your **Account SID** and **Auth Token**
4. Get your Twilio WhatsApp number (sandbox: `whatsapp:+14155238886`)
5. Set webhook URL to `https://your-domain.com/webhook/whatsapp`

## Example Usage

Try these commands with your **Telegram or WhatsApp bot**:

- **"What is artificial intelligence?"**
- **"Write a Python function to calculate fibonacci"**
- **"Explain quantum computing"**
- **"What are the latest developments in AI?"**
- **"Help me plan a trip to Japan"**

## Platform Features

### Telegram
- **Direct messaging** with your bot
- **Instant responses** via polling
- **Clean API integration** with bot token

### WhatsApp
- **Direct messaging** via Twilio
- **Webhook-based responses**
- **Business messaging** support
- **No device linking required**

### Shared
- **GPT-4o powered** responses
- **Secure environment** configuration
- **Unified AI backend**

## Project Structure

```
├── bot.js              # Multi-platform AI agent (Telegram + WhatsApp)
├── src/app/page.tsx    # Web dashboard
├── .env.local          # Environment variables
├── .env.example        # Environment template
└── package.json        # Dependencies & scripts
```

## Technology Stack

- **[Vercel AI SDK](https://sdk.vercel.ai)** - AI integration
- **GPT-4o** - Language model
- **node-telegram-bot-api** - Telegram bot integration
- **Twilio** - WhatsApp messaging API
- **Express** - Webhook server
- **Next.js** - Web dashboard
- **dotenv** - Environment management

## Commands

- `npm run bot` - Start the Multi-Platform AI agent (Telegram + WhatsApp)
- `npm run dev` - Start web dashboard
- `npm run build` - Build for production

## Complete Setup

1. **Get your Telegram bot token** from [@BotFather](https://t.me/BotFather)
2. **Get your OpenAI API key** from [OpenAI Platform](https://platform.openai.com)
3. **Get your Twilio credentials** from [Twilio Console](https://console.twilio.com)
4. **Add all credentials to `.env.local`** as shown in the Quick Start section
5. **Set up Twilio webhook** pointing to your server
6. **Run `npm run bot`** and start chatting on both platforms!

## Important Notes

- **Multi-Platform**: Works on both Telegram and WhatsApp
- **No Device Linking**: WhatsApp via Twilio API (no WhatsApp Web)
- **Webhook Required**: WhatsApp needs public URL for webhooks
- **Secure**: Environment variables keep your API keys safe
- **Production Ready**: Built with Vercel AI SDK for reliable AI integration

## WhatsApp Webhook Setup

For WhatsApp to work, you need to:
1. Deploy your app to a public URL (Heroku, Vercel, etc.)
2. Set Twilio webhook URL to: `https://your-domain.com/webhook/whatsapp`
3. For local testing, use [ngrok](https://ngrok.com): `ngrok http 3001`

## License

MIT# DxbAgent
