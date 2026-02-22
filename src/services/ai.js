const { generateText } = require('ai');
const { openai } = require('@ai-sdk/openai');
const { tavily } = require('@tavily/core');
const config = require('../config');
const { needsSearch, isFlightQuery } = require('../utils/helpers');
const { searchFlights, formatFlightResults } = require('./serpflights');
const { searchHotels, formatHotelResults, getMissingHotelInfo, buildHotelPrompt } = require('./serphotels');
const { getTopic } = require('../utils/memory');

const tavilyClient = tavily({ apiKey: config.tavily.apiKey });

// Store last flight search results for follow-up queries
const lastFlightResults = new Map();

// Store pending hotel queries waiting for missing info
const pendingHotelQueries = new Map();

// Store last completed hotel query so follow-ups can build on it
const lastHotelQuery = new Map();

// Direct translation function - returns ONLY the translated text
async function translateText(text, targetLanguage) {
  try {
    const { text: translation } = await generateText({
      model: openai(config.openai.model),
      messages: [
        {
          role: 'system',
          content: `You are a translator. Output ONLY the translated text. No explanations. No pronunciation. No alternatives. No quotes. No extra words. Just the direct translation.`
        },
        {
          role: 'user',
          content: `Translate to ${targetLanguage}: ${text}`
        }
      ],
      temperature: 0.3,
      maxTokens: 500,
    });
    return translation.trim();
  } catch (error) {
    console.error('❌ Translation Error:', error.message);
    return null;
  }
}

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
function getSystemPrompt(type, searchContext, flightData = null) {
  const baseContext = searchContext
    ? `Use these search results:\n\n${searchContext}\n\n`
    : '';

  // Build flight context from Google Flights data for follow-up queries
  let flightContext = '';
  if (flightData && flightData.flights) {
    flightContext = `Here is the REAL flight data from Google Flights. Use ONLY this data to answer:\n\n`;
    flightContext += `Route: ${flightData.route.origin} → ${flightData.route.destination}\n`;
    flightContext += `Date: ${flightData.route.date}\n\n`;
    flightContext += `Available Flights:\n`;
    flightData.flights.forEach((f) => {
      flightContext += `${f.rank}. ${f.airline} ${f.flightNumber}\n`;
      flightContext += `   Departure: ${f.departure.time} from ${f.departure.airport}\n`;
      flightContext += `   Arrival: ${f.arrival.time} at ${f.arrival.airport}\n`;
      flightContext += `   Duration: ${f.duration}\n`;
      flightContext += `   Stops: ${f.stops === 0 ? 'Non-stop' : f.stops + ' stop(s) via ' + f.stopDetails.join(', ')}\n`;
      if (f.price.economy > 0) {
        flightContext += `   Economy Price: ₹${f.price.economy.toLocaleString('en-IN')}\n`;
      } else {
        flightContext += `   Economy Price: Not available\n`;
      }
      if (f.price.premiumEconomy && f.price.premiumEconomy > 0) {
        flightContext += `   Premium Economy: ₹${f.price.premiumEconomy.toLocaleString('en-IN')}\n`;
      }
      flightContext += `   Aircraft: ${f.airplane}\n`;
      if (f.legroom && f.legroom !== 'N/A') {
        flightContext += `   Legroom: ${f.legroom}\n`;
      }
      flightContext += `\n`;
    });
  }

  const prompts = {
    flight: flightData
      ? `${flightContext}\nYou are a flight assistant. Answer the user's question using ONLY the flight data above. Be specific with flight numbers, times, and prices. Do not make up any information.`
      : `${baseContext}You are a flight search assistant. If you don't have real flight data, ask the user to search for flights with origin, destination and date.`,

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

async function generateResponse(messageText, conversationHistory = [], chatId = 'default') {
  try {
    const queryType = detectQueryType(messageText);
    let searchContext = '';
    let flightData = null;

    // Use Google Flights for flight searches
    if (isFlightQuery(messageText) && needsSearch(messageText)) {
      console.log(`✈️ Searching flights via Google Flights...`);
      const flightResults = await searchFlights(messageText);

      if (flightResults.success) {
        // Store results for follow-up queries
        lastFlightResults.set(chatId, flightResults);

        // Return formatted flight data directly
        return formatFlightResults(flightResults);
      } else if (flightResults.error) {
        // If Google Flights fails, fall back to web search
        console.log(`⚠️ Google Flights: ${flightResults.error}, falling back to web search`);
        const results = await searchWeb(messageText, queryType);
        if (results) {
          searchContext = buildSearchContext(results);
        }
      }
    } else if (queryType === 'flight' && lastFlightResults.has(chatId)) {
      // Follow-up query about flights - use stored results
      flightData = lastFlightResults.get(chatId);
      console.log(`✈️ Using cached flight data for follow-up`);
    } else if (
      queryType === 'hotel' ||
      pendingHotelQueries.has(chatId) ||
      (getTopic(chatId) === 'hotel' && queryType === 'general')
    ) {
      // Hotel conversation — continues as long as topic is 'hotel'
      let fullQuery = messageText;

      if (pendingHotelQueries.has(chatId) && queryType !== 'hotel') {
        // User is providing missing info (e.g., "under 10k", "tomorrow")
        const previousQuery = pendingHotelQueries.get(chatId);
        fullQuery = `${previousQuery} ${messageText}`;
        console.log(`🏨 Combined query: "${fullQuery}"`);
      } else if (getTopic(chatId) === 'hotel' && queryType === 'general' && lastHotelQuery.has(chatId)) {
        // Follow-up on completed hotel search (e.g., "for 1st feb", "show 3 star")
        const previousQuery = lastHotelQuery.get(chatId);
        fullQuery = `${previousQuery} ${messageText}`;
        console.log(`🏨 Follow-up query: "${fullQuery}"`);
      }

      // Check if hotel query has all required info
      const { missing } = getMissingHotelInfo(fullQuery);

      if (missing.length > 0) {
        // Store partial query and ask for missing info
        pendingHotelQueries.set(chatId, fullQuery);
        console.log(`🏨 Hotel query missing: ${missing.join(', ')}`);
        return buildHotelPrompt(missing);
      }

      // All info available — clear pending, save query, and search
      pendingHotelQueries.delete(chatId);
      lastHotelQuery.set(chatId, fullQuery);
      console.log(`🏨 Searching hotels via Google Hotels...`);
      const hotelResults = await searchHotels(fullQuery);

      if (hotelResults.success) {
        return formatHotelResults(hotelResults);
      } else if (hotelResults.error) {
        console.log(`⚠️ Google Hotels: ${hotelResults.error}, falling back to web search`);
        const results = await searchWeb(messageText, queryType);
        if (results) {
          searchContext = buildSearchContext(results);
        }
      }
    } else if (needsSearch(messageText)) {
      console.log(`🌐 Real-time search needed (${queryType})...`);
      const results = await searchWeb(messageText, queryType);
      if (results) {
        searchContext = buildSearchContext(results);
      }
    }

    let systemPrompt = getSystemPrompt(queryType, searchContext, flightData);

    // Add context instruction for follow-up questions
    systemPrompt += `\n\nIMPORTANT: Maintain conversation continuity. If the user asks follow-up questions like "which is cheapest?", "tell me more", "what about budget options?", etc., refer to the previous context. Do not switch topics unless the user explicitly asks about something completely different.`;

    // Build messages array with history
    const messages = [{ role: 'system', content: systemPrompt }];

    // Add conversation history
    for (const msg of conversationHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }

    // Add current message
    messages.push({ role: 'user', content: messageText });

    const { text } = await generateText({
      model: openai(config.openai.model),
      messages,
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

module.exports = { generateResponse, translateText };
