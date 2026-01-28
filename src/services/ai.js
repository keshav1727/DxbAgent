const { generateText } = require('ai');
const { openai } = require('@ai-sdk/openai');
const { tavily } = require('@tavily/core');
const config = require('../config');
const { needsSearch } = require('../utils/helpers');

const tavilyClient = tavily({ apiKey: config.tavily.apiKey });

// Detect query type for specialized handling
function detectQueryType(text) {
  const lower = text.toLowerCase();

  if (lower.includes('flight') || lower.includes('fly to') || lower.includes('airplane')) {
    return 'flight';
  }
  if (lower.includes('hotel') || lower.includes('stay') || lower.includes('accommodation') || lower.includes('resort')) {
    return 'hotel';
  }
  if (lower.includes('visa') || lower.includes('passport') || lower.includes('travel requirement')) {
    return 'visa';
  }
  if (lower.includes('weather') || lower.includes('temperature') || lower.includes('forecast')) {
    return 'weather';
  }
  return 'general';
}

// Optimize search query based on type
function optimizeQuery(text, type) {
  const today = new Date().toISOString().split('T')[0];

  switch (type) {
    case 'flight':
      return `${text} all flights schedule departure time arrival time duration price airlines today ${today}`;
    case 'hotel':
      return `${text} hotel exact price per night rating location amenities ${today} site:booking.com OR site:makemytrip.com OR site:goibibo.com OR site:trivago.com`;
    case 'visa':
      return `${text} visa requirements documents process 2024`;
    case 'weather':
      return `${text} weather forecast today ${today}`;
    default:
      return text;
  }
}

async function searchWeb(query, type) {
  try {
    const optimizedQuery = optimizeQuery(query, type);
    console.log(`🔍 Searching (${type}): "${optimizedQuery}"`);

    // For flights, do multiple searches for better coverage
    if (type === 'flight') {
      const [mainResults, scheduleResults] = await Promise.all([
        tavilyClient.search(optimizedQuery, {
          searchDepth: 'advanced',
          maxResults: 10,
          includeAnswer: true,
        }),
        tavilyClient.search(`${query} flight schedule timetable all airlines`, {
          searchDepth: 'advanced',
          maxResults: 5,
          includeAnswer: true,
        }),
      ]);

      return {
        answer: mainResults.answer || scheduleResults.answer,
        results: [...(mainResults.results || []), ...(scheduleResults.results || [])],
      };
    }

    // For hotels, search multiple booking platforms
    if (type === 'hotel') {
      const [mainResults, priceResults] = await Promise.all([
        tavilyClient.search(optimizedQuery, {
          searchDepth: 'advanced',
          maxResults: 10,
          includeAnswer: true,
        }),
        tavilyClient.search(`${query} hotel room price per night booking`, {
          searchDepth: 'advanced',
          maxResults: 5,
          includeAnswer: true,
        }),
      ]);

      return {
        answer: mainResults.answer || priceResults.answer,
        results: [...(mainResults.results || []), ...(priceResults.results || [])],
      };
    }

    const response = await tavilyClient.search(optimizedQuery, {
      searchDepth: 'advanced',
      maxResults: 8,
      includeAnswer: true,
    });
    return response;
  } catch (error) {
    console.error('❌ Tavily Error:', error.message);
    return null;
  }
}

function buildSearchContext(results) {
  let context = '';

  if (results.answer) {
    context += `Quick Answer: ${results.answer}\n\n`;
  }

  if (results.results?.length > 0) {
    context += 'Search Results:\n';
    results.results.forEach((r, i) => {
      context += `${i + 1}. ${r.title}\n   ${r.content}\n   Source: ${r.url}\n\n`;
    });
  }

  return context;
}

// Specialized prompts for better output
function getSystemPrompt(type, searchContext) {
  const baseContext = searchContext
    ? `Use these search results:\n\n${searchContext}\n\n`
    : '';

  const prompts = {
    flight: `${baseContext}You are a flight search assistant. Show ALL available flights in a detailed table format.

**✈️ Available Flights:**

List EVERY flight found in this format:

┌─────────────────────────────────────────────┐
│ 1. [Airline Name] - [Flight Number]         │
├─────────────────────────────────────────────┤
│ 🛫 Departure: [Time] from [City/Airport]    │
│ 🛬 Arrival: [Time] at [City/Airport]        │
│ ⏱️ Duration: [X hr Y min]                   │
│ 💰 Price: ₹[Amount] / $[Amount]             │
│ ✈️ Type: Non-stop / 1 Stop / 2 Stops        │
│ 📅 Date: [Travel Date]                      │
└─────────────────────────────────────────────┘

Repeat this format for EACH flight option (show at least 5-10 flights if available).

**📊 Summary:**
• Cheapest: [Airline] at [Price]
• Fastest: [Airline] at [Duration]
• Best Value: [Recommendation]

**💡 Booking Tips:**
• Where to book for best price
• Best time to fly

IMPORTANT: Show ALL flights with exact times, don't summarize. Users need complete flight schedules.`,

    hotel: `${baseContext}You are a hotel search assistant. Show hotels with EXACT prices from booking platforms.

**🏨 Hotels Found:**

List each hotel in this clean format:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**1. [Hotel Name]** ⭐⭐⭐⭐ (4-star)
📍 Location: [Area, City]
💰 Price: ₹[EXACT PRICE]/night (from [Booking.com/MakeMyTrip])
⭐ Rating: [X.X]/10 or [X.X]/5
🏷️ Amenities: WiFi, Pool, Breakfast, AC, Parking
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Show 5-8 hotels with this format.

**📊 Quick Comparison:**
| Hotel | Rating | Price/Night |
|-------|--------|-------------|
| [Name] | ⭐X.X | ₹X,XXX |

**💡 Best Picks:**
• Budget: [Hotel] at ₹[Price]
• Mid-range: [Hotel] at ₹[Price]
• Luxury: [Hotel] at ₹[Price]

IMPORTANT:
- Show EXACT prices as listed on booking sites (not ranges)
- Include the source platform for each price
- Mention if taxes are included or extra`,

    visa: `${baseContext}You are a visa assistant. Keep it simple and clear.

**🛂 Visa Requirements:**

**Visa Type:** [Tourist Visa / Business Visa / e-Visa / etc.]

**📄 Required Documents:**
1. [Document 1]
2. [Document 2]
3. [Document 3]
(list all required documents)

**⏳ Validity:** [X days/months] from date of issue

That's it. Keep it short and to the point. No extra information unless asked.`,

    weather: `${baseContext}You are a weather assistant. Format weather information clearly:

**🌤️ Weather Update:**
• Current temperature
• Conditions (sunny, cloudy, rain, etc.)
• Humidity & Wind
• Today's high/low

**📅 Forecast:**
• Next few days outlook
• What to wear/pack

Keep it brief and useful.`,

    general: `${baseContext}You are a helpful AI assistant with real-time information. Provide accurate, up-to-date answers with relevant details. Use formatting and emojis to make responses clear and readable.`
  };

  return prompts[type] || prompts.general;
}

async function generateResponse(messageText) {
  try {
    const queryType = detectQueryType(messageText);
    let searchContext = '';

    if (needsSearch(messageText)) {
      console.log(`🌐 Real-time search needed (${queryType})...`);
      const results = await searchWeb(messageText, queryType);
      if (results) {
        searchContext = buildSearchContext(results);
      }
    }

    const systemPrompt = getSystemPrompt(queryType, searchContext);

    const { text } = await generateText({
      model: openai(config.openai.model),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: messageText },
      ],
      temperature: 0.7,
      maxTokens: 2500,
    });

    return text;
  } catch (error) {
    console.error('❌ AI Error:', error.message);

    if (error.message?.includes('quota')) {
      return '💳 OpenAI quota exceeded.';
    }
    if (error.message?.includes('API key')) {
      return '🔑 API key issue.';
    }
    if (error.message?.includes('rate limit')) {
      return '⏱️ Rate limit hit. Please wait.';
    }
    return 'Sorry, an error occurred. Please try again.';
  }
}

module.exports = { generateResponse };
