const { generateText } = require('ai');
const { openai } = require('@ai-sdk/openai');
const { tavily } = require('@tavily/core');
const config = require('../config');
const { needsSearch, isFlightQuery } = require('../utils/helpers');
const { searchFlights, formatFlightResults, buildAnalysisInput } = require('./serpflights');
const { searchHotels, formatHotelResults, getMissingHotelInfo, buildHotelPrompt } = require('./serphotels');
const { getTopic } = require('../utils/memory');
const { createTicket } = require('./chatHistory');

const tavilyClient = tavily({ apiKey: config.tavily.apiKey });

// Store last flight search results for follow-up queries
const lastFlightResults = new Map();

// Store pending booking context (waiting for passenger/class details)
const pendingBookings = new Map();

// Store pending hotel queries waiting for missing info
const pendingHotelQueries = new Map();

// Store last completed hotel query so follow-ups can build on it
const lastHotelQuery = new Map();

// Store pending ticket creation (waiting for issue description)
const pendingTickets = new Map();

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

// Build date context string from message timestamp
function buildDateContext(ts) {
  const now = new Date(ts);
  const tomorrow = new Date(ts);
  tomorrow.setDate(now.getDate() + 1);
  const dayAfter = new Date(ts);
  dayAfter.setDate(now.getDate() + 2);

  const fmt = (d) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtShort = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  return `[DATE CONTEXT] Today is ${fmt(now)} (${fmtShort(now)}). Tomorrow is ${fmt(tomorrow)} (${fmtShort(tomorrow)}). Day after tomorrow is ${fmt(dayAfter)} (${fmtShort(dayAfter)}). When the user says "today", "tomorrow", "this weekend" etc., always use these exact dates.\n\n`;
}

// Specialized prompts for better output
function getSystemPrompt(type, searchContext, flightData = null, dateContext = '') {
  const baseContext = (dateContext || '') + (searchContext ? `Use these search results:\n\n${searchContext}\n\n` : '');

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
      ? `${flightContext}\nYou are a flight assistant. Answer the user's question using ONLY the flight data above. Be specific with flight numbers, times, and prices. Do not make up any information.\n\nCRITICAL: NEVER ask for personal details (name, DOB, gender, contact, passport, payment). NEVER handle booking yourself. If the user wants to book, just tell them: reply with "book [flight number]" e.g. book 6E 6788.`
      : `${baseContext}You are a flight search assistant. If you don't have real flight data, ask the user to search for flights with origin, destination and date. NEVER ask for personal details or handle bookings.`,

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

const FLIGHT_ANALYSIS_PROMPT = `You are a Flight Data Analysis AI.

You will receive structured flight search results from an external API.
Your job is to:

1. Normalize flight data.
2. Identify:
   - Cheapest flight
   - Fastest flight
   - Best value flight (balanced price vs duration)
3. Categorize flights by time of day.
4. Provide price intelligence vs average price.
5. Return structured JSON output.
6. DO NOT fabricate or hallucinate missing values.
7. Use only the provided input data.

YOUR TASK:

1️⃣ FLIGHT OVERVIEW
Return all flight details exactly as provided.

2️⃣ SORTING METRICS
- Cheapest flight = lowest price
- Fastest flight = lowest duration_minutes
- Best value flight = lowest (price / duration_minutes ratio)

3️⃣ PRICE INTELLIGENCE
Compare each flight price to average_price:
- If > 10% above average → "High"
- If within ±10% → "Normal"
- If > 10% below average → "Good deal"

Also generate:
"Prices are X% above/below the route average."

4️⃣ TIME CATEGORIZATION
Based on departure_time:
- Morning: 05:00–11:59
- Afternoon: 12:00–16:59
- Evening: 17:00–20:59
- Night: 21:00–04:59

Group flights into: { "morning": [], "afternoon": [], "evening": [], "night": [] }

5️⃣ RETURN ONLY VALID JSON. NO explanation text before or after. This exact format:

{
  "summary": {
    "total_flights": number,
    "cheapest_flight_number": "",
    "fastest_flight_number": "",
    "best_value_flight_number": "",
    "price_insight": ""
  },
  "categorized_flights": {
    "morning": [],
    "afternoon": [],
    "evening": [],
    "night": []
  },
  "flights": [
    {
      "airline": "",
      "flight_number": "",
      "departure_time": "",
      "arrival_time": "",
      "duration_minutes": number,
      "stops": number,
      "layover_city": "",
      "aircraft_type": "",
      "price": number,
      "currency": "",
      "fare_type": "",
      "baggage": { "cabin": "", "checkin": "" },
      "policies": { "cancellation": "", "reschedule": "" },
      "price_vs_average_percent": number,
      "price_category": "High / Normal / Good deal"
    }
  ]
}

STRICT RULES:
- Never invent flights.
- Never modify numeric values.
- Do not assume missing baggage.
- If aircraft_type missing → return null.
- Only analyze provided data.
- Return ONLY the JSON object, nothing else.`;

// Call GPT-4o with the flight analysis prompt and return structured JSON
async function analyzeFlights(analysisInput) {
  try {
    console.log('🧠 Analyzing flights with GPT...');
    const { text } = await generateText({
      model: openai(config.openai.model),
      messages: [
        { role: 'system', content: FLIGHT_ANALYSIS_PROMPT },
        { role: 'user', content: JSON.stringify(analysisInput, null, 2) },
      ],
      temperature: 0.1,
      maxTokens: 3000,
    });

    // Extract JSON — strip any markdown fences if present
    const clean = text.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('❌ Flight analysis failed:', err.message);
    return null;
  }
}

// Parse passenger details from text like "2 adults 1 child business" or "2, economy"
function parsePassengerDetails(text) {
  const lower = text.toLowerCase();

  // Try explicit "N adult(s)" first, then fall back to first bare number
  const adultMatch = lower.match(/(\d+)\s*adult/);
  const bareNum = lower.match(/^(\d+)/);
  const adults = parseInt(adultMatch?.[1] || bareNum?.[1] || '1');

  const children = parseInt(lower.match(/(\d+)\s*child/)?.[1] || '0');
  const infants  = parseInt(lower.match(/(\d+)\s*infant/)?.[1] || '0');

  let cabin = 'economy';
  if (/business/i.test(text)) cabin = 'business';
  else if (/premium/i.test(text)) cabin = 'premium_economy';

  return { adults, children, infants, cabin };
}


// Format flight list — clean numbered format
function formatAnalyzedFlights(analysis, originalFlights, route) {
  const { summary, flights } = analysis;

  // Build lookup from original flight data
  const originalMap = {};
  for (const f of (originalFlights || [])) {
    originalMap[f.flightNumber] = f;
  }

  const routeLabel = route ? `${route.origin} → ${route.destination}` : '';
  const date = route?.date || '';

  let out = `✈️ **${routeLabel}**\n`;
  if (date) out += `📅 ${date}\n`;
  out += `🔍 ${summary.total_flights} flights found\n\n`;

  flights.forEach((f, i) => {
    const orig = originalMap[f.flight_number];
    const stopsText = f.stops === 0 ? 'Non-stop' : `${f.stops} stop${f.stops > 1 ? 's' : ''} via ${f.layover_city || ''}`;
    const badge = f.price_category === 'Good deal' ? '🟢' : f.price_category === 'High' ? '🔴' : '';

    out += `*${i + 1}. ${f.airline} · ${f.flight_number}*\n`;
    out += `🕐 ${f.departure_time} → ${f.arrival_time} · ${Math.floor(f.duration_minutes / 60)}h ${f.duration_minutes % 60}m · ${stopsText}\n`;

    // Prices
    const premiumPrice = orig?.price?.premiumEconomy || 0;
    const bizPrice = orig?.price?.business || 0;
    out += `💺 Economy ₹${f.price.toLocaleString('en-IN')}${badge ? ' ' + badge : ''}`;
    if (premiumPrice > 0) out += ` · Premium ₹${premiumPrice.toLocaleString('en-IN')}`;
    if (bizPrice > 0) out += ` · Business ₹${bizPrice.toLocaleString('en-IN')}`;
    out += '\n\n';
  });

  out += `💰 Cheapest: **${summary.cheapest_flight_number}** · ⚡ Fastest: **${summary.fastest_flight_number}**\n`;
  out += `📌 To book, reply: *"book [flight number]"* e.g. book ${flights[0]?.flight_number || ''}`;

  return out.trim();
}

// Detect booking intent — must refer to selecting an existing flight, not a new search
function isBookFlightIntent(text) {
  // Exclude new flight search queries
  if (/\bfrom\b.+\bto\b/i.test(text) && /\b(flight|fly)\b/i.test(text)) return false;
  if (/\bflight(s)?\s+from\b/i.test(text)) return false;

  return /\bbook\s+(\d{1,2}(st|nd|rd|th)?|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/i.test(text) ||
    /\bbook\s+[A-Z]{2}\s*\d{3,4}\b/i.test(text) ||
    /\bbook\s+(it|this|now|the flight|indigo|spicejet|air india|akasa|star air)\b/i.test(text) ||
    /\bbook\s+(cheapest|fastest|best|best value|non.?stop|direct)\b/i.test(text) ||
    /\bbook\b/i.test(text) && /\b(cheapest|fastest|best value|non.?stop|direct flight)\b/i.test(text) ||
    /\bi('ll| will) book\b/i.test(text) ||
    /\bproceed\s*(with|to book)?\b/i.test(text) ||
    /\bconfirm\s*(booking|flight|this)\b/i.test(text);
}

// Extract flight number or rank index from text
// Returns { flightNumber, rankIndex }
function extractFlightRef(text, flights = []) {
  const lower = text.toLowerCase().trim();

  // 1. Explicit flight code e.g. "6E 6813"
  const codeMatch = text.match(/\b([A-Z]{2})\s*(\d{3,4})\b/i);
  if (codeMatch) {
    return { flightNumber: `${codeMatch[1].toUpperCase()} ${codeMatch[2]}`, rankIndex: null };
  }

  // 2. Superlatives — find by sorting cached flights
  if (/\bcheapest\b/i.test(text) && flights.length) {
    const idx = flights.reduce((best, f, i) =>
      (f.price.economy || Infinity) < (flights[best].price.economy || Infinity) ? i : best, 0);
    return { flightNumber: null, rankIndex: idx };
  }
  if (/\bfastest\b/i.test(text) && flights.length) {
    const toMins = d => { const m = d.match(/(\d+)h\s*(\d+)?m?/); return m ? +m[1]*60+(+m[2]||0) : 9999; };
    const idx = flights.reduce((best, f, i) =>
      toMins(f.duration) < toMins(flights[best].duration) ? i : best, 0);
    return { flightNumber: null, rankIndex: idx };
  }
  if (/\b(best|best value)\b/i.test(text) && flights.length) {
    // best value = lowest price/duration ratio
    const toMins = d => { const m = d.match(/(\d+)h\s*(\d+)?m?/); return m ? +m[1]*60+(+m[2]||0) : 9999; };
    const idx = flights.reduce((best, f, i) => {
      const ratio = (f.price.economy || Infinity) / (toMins(f.duration) || 1);
      const bestRatio = (flights[best].price.economy || Infinity) / (toMins(flights[best].duration) || 1);
      return ratio < bestRatio ? i : best;
    }, 0);
    return { flightNumber: null, rankIndex: idx };
  }
  if (/\b(non.?stop|direct)\b/i.test(text) && flights.length) {
    const idx = flights.findIndex(f => f.stops === 0);
    if (idx >= 0) return { flightNumber: null, rankIndex: idx };
  }

  // 3. Word ordinals
  const wordOrdinals = {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
    sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  };
  for (const [word, rank] of Object.entries(wordOrdinals)) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) {
      return { flightNumber: null, rankIndex: rank - 1 };
    }
  }

  // 4. Numeric ordinals: "5th", "3rd", "2nd", "1st", or bare number
  const ordinalMatch = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (ordinalMatch) {
    const n = parseInt(ordinalMatch[1]);
    if (n >= 1 && n <= 20) return { flightNumber: null, rankIndex: n - 1 };
  }

  // 5. Airline name match
  const byAirline = flights.findIndex(f => lower.includes(f.airline.toLowerCase().split(' ')[0]));
  if (byAirline >= 0) return { flightNumber: null, rankIndex: byAirline };

  return { flightNumber: null, rankIndex: null };
}

// Build booking confirmation card with pre-filled URL shown directly in chat
function buildBookingCard(flight, route, passengerDetails) {
  const { cabin } = passengerDetails;
  const stops = flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop via ${flight.stopDetails.join(', ')}`;

  const priceKey = cabin === 'business' ? 'business' : cabin === 'premium_economy' ? 'premiumEconomy' : 'economy';
  const price = flight.price[priceKey] || flight.price.economy;

  let out = `✈️ *${flight.airline} · ${flight.flightNumber}*\n`;
  out += `📅 ${route.date}\n`;
  out += `🛫 ${flight.departure.time} ${flight.departure.airport} → ${flight.arrival.time} ${flight.arrival.airport}\n`;
  out += `⏱ ${flight.duration} · ${stops}\n`;
  out += `💰 ₹${price.toLocaleString('en-IN')}\n\n`;
  out += `👉 Book on Google Flights (cheapest platform):\n`;
  out += flight.bookingUrl;
  return out;
}

// Detect if user wants to raise a support ticket
function isTicketIntent(text) {
  return /\b(raise\s+a?\s*ticket|create\s+a?\s*ticket|submit\s+a?\s*(ticket|complaint|issue)|report\s+(an?\s+)?(issue|problem|bug)|i\s+have\s+an?\s+(issue|problem|complaint)|need\s+support|contact\s+support|raise\s+issue|log\s+a?\s*complaint)\b/i.test(text);
}

// Handle ticket creation flow — returns response string or null if not a ticket flow
async function handleTicketFlow(text, chatId, platform, userName) {
  if (isTicketIntent(text)) {
    pendingTickets.set(chatId, { platform, userName });
    return '🎫 Sure! Please describe your issue in detail and I\'ll raise a support ticket for you.';
  }

  if (pendingTickets.has(chatId)) {
    const { platform: ticketPlatform, userName: ticketUser } = pendingTickets.get(chatId);
    pendingTickets.delete(chatId);

    const ticketId = await createTicket(chatId, ticketPlatform, ticketUser, text);
    if (ticketId) {
      return `✅ Your support ticket has been raised!\n\n🎫 *Ticket ID:* ${ticketId}\n📝 *Issue:* ${text}\n\nOur team will review it shortly. Thank you!`;
    }
    return '❌ Failed to raise the ticket. Please try again later.';
  }

  return null;
}

// user says "book ..." — immediately return booking link
function handleBookFlight(text, cachedResults) {
  if (!cachedResults) return '⚠️ I don\'t have your flight search cached. Please search again (e.g. "flights from Bangalore to Ghaziabad tomorrow") and then say book.';

  const flights = cachedResults.flights || [];
  const { flightNumber, rankIndex } = extractFlightRef(text, flights);

  let flight;
  if (flightNumber) {
    flight = flights.find((f) =>
      f.flightNumber.replace(' ', '').toLowerCase() === flightNumber.replace(' ', '').toLowerCase());
  } else if (rankIndex !== null && rankIndex >= 0) {
    flight = flights[rankIndex];
  } else {
    flight = flights[0]; // default to first
  }

  if (!flight) return `❌ Could not find that flight. Please say "book [flight number]" e.g. book 6E 6813`;

  return buildBookingCard(flight, cachedResults.route, { adults: 1, children: 0, infants: 0, cabin: 'economy' });
}

async function generateResponse(messageText, conversationHistory = [], chatId = 'default', messageTimestamp = Date.now(), platform = 'telegram', userName = 'Unknown') {
  try {
    const queryType = detectQueryType(messageText);
    const dateContext = buildDateContext(messageTimestamp);
    let searchContext = '';
    let flightData = null;

    // Support ticket flow
    const ticketResponse = await handleTicketFlow(messageText, chatId, platform, userName);
    if (ticketResponse !== null) return ticketResponse;

    // user says "book [flight number]" — immediately return booking link
    if (isBookFlightIntent(messageText)) {
      return handleBookFlight(messageText, lastFlightResults.get(chatId));
    }

    // Use Google Flights for flight searches
    if (isFlightQuery(messageText) && needsSearch(messageText)) {
      console.log(`✈️ Searching flights via Google Flights...`);
      const flightResults = await searchFlights(messageText, 1, messageTimestamp);

      if (flightResults.success) {
        // Store results for follow-up queries
        lastFlightResults.set(chatId, flightResults);

        // Run GPT-4o analysis on the raw data
        const analysisInput = buildAnalysisInput(flightResults);
        const analysis = await analyzeFlights(analysisInput);
        if (analysis) {
          return formatAnalyzedFlights(analysis, flightResults.flights, flightResults.route);
        }
        // Fallback to plain format if analysis fails
        return formatFlightResults(flightResults);
      } else if (flightResults.error) {
        console.log(`⚠️ Google Flights: ${flightResults.error}`);
        return `❌ ${flightResults.error}\n\nPlease check the route or date and try again.`;
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
      const hotelResults = await searchHotels(fullQuery, 2, messageTimestamp);

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

    let systemPrompt = getSystemPrompt(queryType, searchContext, flightData, dateContext);

    // Add context instruction for follow-up questions
    systemPrompt += `\n\nIMPORTANT: Maintain conversation continuity. If the user asks follow-up questions like "which is cheapest?", "tell me more", "what about budget options?", etc., refer to the previous context. Do not switch topics unless the user explicitly asks about something completely different.`;
    systemPrompt += `\n\nNEVER ask for personal details (name, date of birth, gender, passport, phone, email, payment details). NEVER simulate a booking form. Booking is handled externally — just tell the user to reply "book [flight number]".`;

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
