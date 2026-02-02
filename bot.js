const express = require('express');
const config = require('./src/config');
const telegram = require('./src/services/telegram');
const whatsapp = require('./src/services/whatsapp');
const googleflights = require('./src/services/googleflights');
const googlehotels = require('./src/services/googlehotels');
const { connectDB } = require('./src/services/chatHistory');

console.log('🤖 Multi-Platform AI Agent starting...');

(async () => {
  // Initialize Express
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  // Connect to MongoDB for chat history (must complete before handling messages)
  await connectDB();

  // Initialize services
  telegram.init();
  const flightsEnabled = googleflights.init();
  const hotelsEnabled = googlehotels.init();

  // WhatsApp webhook
  app.post('/webhook/whatsapp', whatsapp.handleWebhook);

  // Health check
  app.get('/health', (req, res) => res.send('OK'));

  // Start server
  app.listen(config.server.port, () => {
    console.log(`🌐 Server running on port ${config.server.port}`);
  });

  // Status
  console.log('');
  console.log('✅ Agent is running!');
  console.log('📱 Telegram: Active');
  console.log('💬 WhatsApp: Active');
  console.log('🔍 Tavily: Real-time search');
  console.log(`✈️ Google Flights: ${flightsEnabled ? 'Real-time flights' : 'Not configured'}`);
  console.log(`🏨 Google Hotels: ${hotelsEnabled ? 'Real-time hotels' : 'Not configured'}`);
  console.log('🤖 GPT-4.1 AI');
  console.log('');
  console.log('🎯 Capabilities: Flights, Visa, Weather, News, Search');
  console.log('🛑 Press Ctrl+C to stop');

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping agent...');
    telegram.stop();
    process.exit(0);
  });
})();
