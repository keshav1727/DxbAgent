const { getJson } = require('serpapi');
const config = require('../config');

// Airline name lookup from IATA carrier codes
const AIRLINE_NAMES = {
  '6E': 'IndiGo', 'AI': 'Air India', 'UK': 'Vistara', 'SG': 'SpiceJet',
  'G8': 'Go First', 'I5': 'AirAsia India', 'QP': 'Akasa Air',
  'EK': 'Emirates', 'EY': 'Etihad Airways', 'QR': 'Qatar Airways',
  'SV': 'Saudia', 'WY': 'Oman Air', 'GF': 'Gulf Air', 'KU': 'Kuwait Airways',
  'FZ': 'flydubai', 'G9': 'Air Arabia', 'WS': 'WestJet',
  'SQ': 'Singapore Airlines', 'TG': 'Thai Airways', 'MH': 'Malaysia Airlines',
  'CX': 'Cathay Pacific', 'NH': 'ANA', 'JL': 'Japan Airlines',
  'KE': 'Korean Air', 'OZ': 'Asiana Airlines', 'GA': 'Garuda Indonesia',
  'PR': 'Philippine Airlines', 'UL': 'SriLankan Airlines', 'BG': 'Biman Bangladesh',
  'BA': 'British Airways', 'LH': 'Lufthansa', 'AF': 'Air France',
  'KL': 'KLM', 'AZ': 'ITA Airways', 'IB': 'Iberia', 'LX': 'Swiss',
  'OS': 'Austrian Airlines', 'SN': 'Brussels Airlines', 'TK': 'Turkish Airlines',
  'SU': 'Aeroflot', 'LO': 'LOT Polish', 'SK': 'SAS',
  'AA': 'American Airlines', 'UA': 'United Airlines', 'DL': 'Delta Air Lines',
  'WN': 'Southwest Airlines', 'B6': 'JetBlue', 'AS': 'Alaska Airlines',
  'AC': 'Air Canada', 'QF': 'Qantas', 'VA': 'Virgin Australia',
  'SA': 'South African Airways', 'ET': 'Ethiopian Airlines', 'KQ': 'Kenya Airways',
  'MS': 'EgyptAir', 'MK': 'Air Mauritius', 'IX': 'Air India Express',
};

// Airport codes mapping
const airportCodes = {
  // India
  'bangalore': 'BLR', 'bengaluru': 'BLR', 'blr': 'BLR',
  'delhi': 'DEL', 'new delhi': 'DEL', 'del': 'DEL',
  'mumbai': 'BOM', 'bombay': 'BOM', 'bom': 'BOM',
  'chennai': 'MAA', 'madras': 'MAA', 'maa': 'MAA',
  'hyderabad': 'HYD', 'hyd': 'HYD',
  'kolkata': 'CCU', 'calcutta': 'CCU', 'ccu': 'CCU',
  'pune': 'PNQ', 'pnq': 'PNQ',
  'ahmedabad': 'AMD', 'amd': 'AMD',
  'goa': 'GOI', 'goi': 'GOI',
  'jaipur': 'JAI', 'jai': 'JAI',
  'kochi': 'COK', 'cochin': 'COK', 'cok': 'COK',
  'lucknow': 'LKO', 'lko': 'LKO',
  'guwahati': 'GAU', 'gau': 'GAU',
  'chandigarh': 'IXC', 'ixc': 'IXC',
  'indore': 'IDR', 'idr': 'IDR',
  'varanasi': 'VNS', 'vns': 'VNS',
  'amritsar': 'ATQ', 'atq': 'ATQ',
  'srinagar': 'SXR', 'sxr': 'SXR',
  'trivandrum': 'TRV', 'thiruvananthapuram': 'TRV', 'trv': 'TRV',
  'mangalore': 'IXE', 'ixe': 'IXE',
  'coimbatore': 'CJB', 'cjb': 'CJB',
  'nagpur': 'NAG', 'nag': 'NAG',
  'bhubaneswar': 'BBI', 'bbi': 'BBI',
  'patna': 'PAT', 'pat': 'PAT',
  'ranchi': 'IXR', 'ixr': 'IXR',
  'visakhapatnam': 'VTZ', 'vizag': 'VTZ', 'vtz': 'VTZ',

  // Middle East
  'dubai': 'DXB', 'dxb': 'DXB',
  'abu dhabi': 'AUH', 'auh': 'AUH',
  'doha': 'DOH', 'doh': 'DOH',
  'riyadh': 'RUH', 'ruh': 'RUH',
  'jeddah': 'JED', 'jed': 'JED',
  'muscat': 'MCT', 'mct': 'MCT',
  'kuwait': 'KWI', 'kwi': 'KWI',
  'bahrain': 'BAH', 'bah': 'BAH',

  // Asia
  'singapore': 'SIN', 'sin': 'SIN',
  'bangkok': 'BKK', 'bkk': 'BKK',
  'kuala lumpur': 'KUL', 'kl': 'KUL', 'kul': 'KUL',
  'hong kong': 'HKG', 'hkg': 'HKG',
  'tokyo': 'NRT', 'narita': 'NRT', 'nrt': 'NRT', 'haneda': 'HND', 'hnd': 'HND',
  'seoul': 'ICN', 'incheon': 'ICN', 'icn': 'ICN',
  'shanghai': 'PVG', 'pvg': 'PVG',
  'beijing': 'PEK', 'pek': 'PEK',
  'jakarta': 'CGK', 'cgk': 'CGK',
  'bali': 'DPS', 'denpasar': 'DPS', 'dps': 'DPS',
  'phuket': 'HKT', 'hkt': 'HKT',
  'manila': 'MNL', 'mnl': 'MNL',
  'kathmandu': 'KTM', 'ktm': 'KTM',
  'colombo': 'CMB', 'cmb': 'CMB',
  'dhaka': 'DAC', 'dac': 'DAC',
  'male': 'MLE', 'maldives': 'MLE', 'mle': 'MLE',

  // Europe
  'london': 'LHR', 'heathrow': 'LHR', 'lhr': 'LHR', 'gatwick': 'LGW', 'lgw': 'LGW',
  'paris': 'CDG', 'cdg': 'CDG',
  'frankfurt': 'FRA', 'fra': 'FRA',
  'amsterdam': 'AMS', 'ams': 'AMS',
  'rome': 'FCO', 'fco': 'FCO',
  'milan': 'MXP', 'mxp': 'MXP',
  'zurich': 'ZRH', 'zrh': 'ZRH',
  'munich': 'MUC', 'muc': 'MUC',
  'madrid': 'MAD', 'mad': 'MAD',
  'barcelona': 'BCN', 'bcn': 'BCN',
  'vienna': 'VIE', 'vie': 'VIE',
  'brussels': 'BRU', 'bru': 'BRU',
  'istanbul': 'IST', 'ist': 'IST',
  'moscow': 'SVO', 'svo': 'SVO',

  // Americas
  'new york': 'JFK', 'nyc': 'JFK', 'jfk': 'JFK', 'newark': 'EWR', 'ewr': 'EWR',
  'los angeles': 'LAX', 'la': 'LAX', 'lax': 'LAX',
  'san francisco': 'SFO', 'sf': 'SFO', 'sfo': 'SFO',
  'chicago': 'ORD', 'ord': 'ORD',
  'miami': 'MIA', 'mia': 'MIA',
  'washington': 'IAD', 'dc': 'IAD', 'iad': 'IAD',
  'boston': 'BOS', 'bos': 'BOS',
  'seattle': 'SEA', 'sea': 'SEA',
  'dallas': 'DFW', 'dfw': 'DFW',
  'houston': 'IAH', 'iah': 'IAH',
  'atlanta': 'ATL', 'atl': 'ATL',
  'toronto': 'YYZ', 'yyz': 'YYZ',
  'vancouver': 'YVR', 'yvr': 'YVR',
  'sydney': 'SYD', 'syd': 'SYD',
  'melbourne': 'MEL', 'mel': 'MEL',

  // Africa
  'johannesburg': 'JNB', 'jnb': 'JNB',
  'cape town': 'CPT', 'cpt': 'CPT',
  'nairobi': 'NBO', 'nbo': 'NBO',
  'cairo': 'CAI', 'cai': 'CAI',
  'lagos': 'LOS', 'los': 'LOS',
  'addis ababa': 'ADD', 'add': 'ADD',
  'mauritius': 'MRU', 'mru': 'MRU',
};

function getAirportCode(city) {
  const normalized = city.toLowerCase().trim();
  return airportCodes[normalized] || normalized.toUpperCase();
}

// Format minutes to "Xh Ym"
function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
}

// Parse natural language flight query
function parseFlightQuery(query, messageTimestamp = Date.now()) {
  const lower = query.toLowerCase();
  const today = new Date(messageTimestamp);

  const monthMap = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
  };

  let departureDate = null;

  // "20th feb", "15 march", "15th feb 2026"
  const dateMatch = lower.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s*(\d{4}))?/i
  );
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = monthMap[dateMatch[2].toLowerCase().substring(0, 3)];
    const year = dateMatch[3] ? parseInt(dateMatch[3]) : today.getFullYear();
    departureDate = new Date(year, month, day);
    if (!dateMatch[3] && departureDate < today) {
      departureDate.setFullYear(today.getFullYear() + 1);
    }
  }

  if (lower.includes('day after tomorrow')) {
    departureDate = new Date(today);
    departureDate.setDate(today.getDate() + 2);
  } else if (lower.includes('tomorrow')) {
    departureDate = new Date(today);
    departureDate.setDate(today.getDate() + 1);
  } else if (lower.includes('today')) {
    departureDate = new Date(today);
  }

  if (!departureDate) {
    departureDate = new Date(today);
    departureDate.setDate(today.getDate() + 1);
  }

  const year = departureDate.getFullYear();
  const month = String(departureDate.getMonth() + 1).padStart(2, '0');
  const day = String(departureDate.getDate()).padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;

  // Strip date/noise words before extracting cities
  const stripped = lower
    .replace(/\b(day after tomorrow|tomorrow|today|tonight|next week|next month)\b/gi, '')
    .replace(/(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/gi, '')
    .replace(/\s+/g, ' ').trim();

  // Extract origin and destination
  let origin = null;
  let destination = null;

  // Prefer explicit "from X to Y" with lazy match
  const fromToMatch =
    stripped.match(/from\s+([a-z\s]+?)\s+to\s+([a-z\s]+?)(?:\s+(?:on|for|next|\d)|$)/i) ||
    stripped.match(/from\s+([a-z\s]+?)\s+to\s+([a-z\s]+)/i) ||
    stripped.match(/([a-z\s]+?)\s+to\s+([a-z\s]+?)(?:\s+(?:on|for|next|\d)|$)/i) ||
    stripped.match(/([a-z\s]+?)\s+to\s+([a-z\s]+)/i);

  if (fromToMatch) {
    origin = fromToMatch[1].trim();
    destination = fromToMatch[2].trim();
  }

  const cleanCity = (city) =>
    city.replace(/\b(flight|flights|from|cheap|cheapest|book|booking|for|on|the|a|tomorrow|today|tonight)\b/gi, '').trim();

  if (origin) origin = cleanCity(origin);
  if (destination) destination = cleanCity(destination);

  return {
    origin: origin ? getAirportCode(origin) : null,
    destination: destination ? getAirportCode(destination) : null,
    departureDate: formattedDate,
  };
}

// Fallback URL when we can't get a direct booking link
function fallbackBookingUrl(origin, destination, date) {
  return `https://www.google.com/travel/flights/search?q=flights+from+${origin}+to+${destination}+on+${date}&hl=en&curr=INR`;
}

// Call SerpAPI google_flights_booking engine to get a direct booking page URL
// Returns a URL that lands on the booking page with the flight pre-selected
async function fetchDirectBookingUrl(bookingToken, origin, destination, date) {
  if (!bookingToken) return fallbackBookingUrl(origin, destination, date);
  try {
    const data = await getJson({
      engine: 'google_flights_booking',
      api_key: config.serpapi.apiKey,
      booking_token: bookingToken,
    });
    if (data.error) return fallbackBookingUrl(origin, destination, date);
    return data.booking_link || fallbackBookingUrl(origin, destination, date);
  } catch {
    return fallbackBookingUrl(origin, destination, date);
  }
}

// Fetch flights for a single cabin class (1=Economy, 2=PremiumEconomy, 3=Business)
async function fetchByClass(params, travelClass) {
  const classNames = { 1: 'Economy', 2: 'Premium Economy', 3: 'Business' };
  try {
    const data = await getJson({ ...params, travel_class: travelClass });
    if (data.error) {
      console.error(`❌ SerpAPI [${classNames[travelClass]}]:`, data.error);
      return [];
    }
    return [...(data.best_flights || []), ...(data.other_flights || [])];
  } catch (err) {
    console.error(`❌ SerpAPI [${classNames[travelClass]}]:`, err.message);
    return [];
  }
}

// Build a unique key for a flight offer to match across class calls
function flightKey(offer) {
  const segs = offer.flights || [];
  return segs.map((s) => s.flight_number || '').join('|');
}

// Search flights — parallel calls for Economy, Premium Economy, Business
async function searchFlights(query, adults = 1, messageTimestamp = Date.now()) {
  if (!config.serpapi?.apiKey) {
    return { error: 'SerpAPI not configured. Add SERPAPI_API_KEY to .env.local' };
  }

  const parsed = parseFlightQuery(query, messageTimestamp);

  if (!parsed.origin || !parsed.destination) {
    return { error: 'Could not parse origin and destination. Use: "flights from [city] to [city]"' };
  }

  console.log(`✈️ SerpAPI Flights: ${parsed.origin} → ${parsed.destination} on ${parsed.departureDate}`);

  const baseParams = {
    engine: 'google_flights',
    api_key: config.serpapi.apiKey,
    departure_id: parsed.origin,
    arrival_id: parsed.destination,
    outbound_date: parsed.departureDate,
    currency: 'INR',
    hl: 'en',
    type: '2', // one-way
  };

  try {
    // Parallel calls for all three cabin classes
    const [economyOffers, premiumOffers, businessOffers] = await Promise.all([
      fetchByClass(baseParams, 1),
      fetchByClass(baseParams, 2),
      fetchByClass(baseParams, 3),
    ]);

    if (economyOffers.length === 0) {
      return { error: `No flights found from ${parsed.origin} to ${parsed.destination} on ${parsed.departureDate}` };
    }

    // Build price lookup maps keyed by flight number combo
    const premiumPriceMap = new Map();
    const businessPriceMap = new Map();
    const premiumTokenMap = new Map();
    const businessTokenMap = new Map();

    for (const offer of premiumOffers) {
      const key = flightKey(offer);
      if (key) {
        premiumPriceMap.set(key, offer.price || 0);
        if (offer.booking_token) premiumTokenMap.set(key, offer.booking_token);
      }
    }
    for (const offer of businessOffers) {
      const key = flightKey(offer);
      if (key) {
        businessPriceMap.set(key, offer.price || 0);
        if (offer.booking_token) businessTokenMap.set(key, offer.booking_token);
      }
    }

    const topOffers = economyOffers.slice(0, 10);

    // Collect all booking tokens we need to resolve (economy + premium + business per flight)
    const tokenRequests = [];
    for (const offer of topOffers) {
      const key = flightKey(offer);
      const ecoToken = offer.booking_token || null;
      const preToken = premiumTokenMap.get(key) || null;
      const bizToken = businessTokenMap.get(key) || null;
      tokenRequests.push({ ecoToken, preToken, bizToken });
    }

    // Fetch all direct booking URLs in parallel (3 per flight max)
    console.log(`🔗 Fetching direct booking URLs for ${topOffers.length} flights...`);
    const resolvedUrls = await Promise.all(
      tokenRequests.map(({ ecoToken, preToken, bizToken }) =>
        Promise.all([
          fetchDirectBookingUrl(ecoToken, parsed.origin, parsed.destination, parsed.departureDate),
          preToken ? fetchDirectBookingUrl(preToken, parsed.origin, parsed.destination, parsed.departureDate) : Promise.resolve(null),
          bizToken ? fetchDirectBookingUrl(bizToken, parsed.origin, parsed.destination, parsed.departureDate) : Promise.resolve(null),
        ])
      )
    );

    const flights = topOffers.map((offer, index) => {
      const segs = offer.flights || [];
      const firstSeg = segs[0] || {};
      const lastSeg = segs[segs.length - 1] || firstSeg;
      const key = flightKey(offer);

      const airlineCode = firstSeg.flight_number?.match(/^([A-Z0-9]{2})/)?.[1] || '';
      const airlineName = firstSeg.airline || AIRLINE_NAMES[airlineCode] || airlineCode || 'Unknown';

      const economyPrice = offer.price || 0;
      const premiumPrice = premiumPriceMap.get(key) || 0;
      const businessPrice = businessPriceMap.get(key) || 0;

      const [ecoUrl, preUrl, bizUrl] = resolvedUrls[index];

      const stops = segs.length - 1;
      const stopAirports = segs.slice(0, -1).map((s) => s.arrival_airport?.id || '');
      const layoverInfo = (offer.layovers || []).map(
        (l) => `${l.id || l.name} (${formatDuration(l.duration)})`
      );

      return {
        rank: index + 1,
        airline: airlineName,
        flightNumber: firstSeg.flight_number || '',
        departure: {
          airport: firstSeg.departure_airport?.id || parsed.origin,
          time: firstSeg.departure_airport?.time?.split(' ')[1] || 'N/A',
        },
        arrival: {
          airport: lastSeg.arrival_airport?.id || parsed.destination,
          time: lastSeg.arrival_airport?.time?.split(' ')[1] || 'N/A',
        },
        duration: formatDuration(offer.total_duration || 0),
        stops,
        stopDetails: stopAirports,
        layoverInfo,
        price: {
          economy: economyPrice,
          premiumEconomy: premiumPrice,
          business: businessPrice,
        },
        bookingUrl: {
          economy: ecoUrl,
          premiumEconomy: preUrl || ecoUrl,
          business: bizUrl || ecoUrl,
        },
      };
    });

    return {
      success: true,
      route: {
        origin: parsed.origin,
        destination: parsed.destination,
        date: parsed.departureDate,
      },
      flights,
      totalFound: flights.length,
    };
  } catch (error) {
    console.error('❌ SerpAPI Flights Error:', error.message);
    return { error: `Flight search failed: ${error.message}` };
  }
}

// Format results — clean, minimal output: airline, flight no, timing, prices per class
function formatFlightResults(results) {
  if (results.error) return `❌ ${results.error}`;

  const { route, flights, totalFound } = results;

  let output = `✈️ **${route.origin} → ${route.destination}**\n`;
  output += `📅 ${route.date} · ${totalFound} flights found\n\n`;

  flights.forEach((f) => {
    const stopsText = f.stops === 0 ? 'Non-stop' : `${f.stops} stop${f.stops > 1 ? 's' : ''} via ${f.stopDetails.join(', ')}`;

    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    output += `**${f.airline}** · ${f.flightNumber}\n`;
    output += `🕐 ${f.departure.time} (${f.departure.airport}) → ${f.arrival.time} (${f.arrival.airport}) · ${f.duration} · ${stopsText}\n`;

    if (f.price.economy > 0) {
      output += `💺 Economy: **₹${f.price.economy.toLocaleString('en-IN')}** — [Book](${f.bookingUrl.economy})\n`;
    }
    if (f.price.premiumEconomy > 0) {
      output += `💺 Premium Economy: **₹${f.price.premiumEconomy.toLocaleString('en-IN')}** — [Book](${f.bookingUrl.premiumEconomy})\n`;
    }
    if (f.price.business > 0) {
      output += `💼 Business: **₹${f.price.business.toLocaleString('en-IN')}** — [Book](${f.bookingUrl.business})\n`;
    }
    output += '\n';
  });

  // Quick summary
  const withEconomy = flights.filter((f) => f.price.economy > 0);
  if (withEconomy.length > 0) {
    const cheapest = withEconomy.reduce((a, b) => a.price.economy < b.price.economy ? a : b);
    const fastest = flights.reduce((a, b) => {
      const mins = (d) => { const m = d.match(/(\d+)h\s*(\d+)?m?/); return m ? +m[1] * 60 + (+m[2] || 0) : 9999; };
      return mins(a.duration) < mins(b.duration) ? a : b;
    });
    output += `📊 Cheapest: **${cheapest.airline} ${cheapest.flightNumber}** at ₹${cheapest.price.economy.toLocaleString('en-IN')} · Fastest: **${fastest.airline} ${fastest.flightNumber}** (${fastest.duration})\n`;
  }

  return output;
}

// Convert duration string "2h 45m" → minutes
function durationToMinutes(d) {
  const m = d.match(/(\d+)h\s*(\d+)?m?/);
  return m ? parseInt(m[1]) * 60 + (parseInt(m[2]) || 0) : 0;
}

// Build the structured INPUT for the GPT-4o flight analysis prompt
function buildAnalysisInput(results) {
  const { route, flights } = results;

  const withPrice = flights.filter((f) => f.price.economy > 0);
  const avgPrice = withPrice.length
    ? Math.round(withPrice.reduce((s, f) => s + f.price.economy, 0) / withPrice.length)
    : 0;

  return {
    route: { origin: route.origin, destination: route.destination, date: route.date },
    currency: 'INR',
    average_price: avgPrice,
    flights: withPrice.map((f) => ({
      airline: f.airline,
      flight_number: f.flightNumber,
      departure_airport: f.departure.airport,
      arrival_airport: f.arrival.airport,
      departure_time: f.departure.time,
      arrival_time: f.arrival.time,
      duration_minutes: durationToMinutes(f.duration),
      stops: f.stops,
      layover_city: f.stopDetails.length ? f.stopDetails.join(', ') : null,
      aircraft_type: f.airplane !== 'N/A' ? f.airplane : null,
      price: f.price.economy,
      fare_type: 'Economy',
      cabin_baggage: null,
      checkin_baggage: null,
      cancellation_policy: null,
      reschedule_charges: null,
      // Extra: carry multi-cabin prices through for display
      _premiumEconomyPrice: f.price.premiumEconomy || 0,
      _businessPrice: f.price.business || 0,
      _bookingUrl: f.bookingUrl,
    })),
  };
}

function init() {
  if (config.serpapi?.apiKey) {
    console.log('✈️ SerpAPI: Flight search enabled (Google Flights)');
    return true;
  }
  console.log('⚠️ SerpAPI: Not configured (add SERPAPI_API_KEY to .env.local)');
  return false;
}

module.exports = {
  init,
  searchFlights,
  formatFlightResults,
  parseFlightQuery,
  buildAnalysisInput,
};
