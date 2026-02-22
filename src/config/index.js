require('dotenv').config({ path: '.env.local' });

module.exports = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4.1',
  },
  tavily: {
    apiKey: process.env.TAVILY_API_KEY,
  },
  serpapi: {
    apiKey: process.env.SERPAPI_API_KEY,
  },
  mongodb: {
    uri: process.env.MONGODB_URI,
  },
  server: {
    port: process.env.PORT || 3001,
  },
};
