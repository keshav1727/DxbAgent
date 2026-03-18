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
  'ghaziabad': 'HDO', 'hindon': 'HDO', 'hdo': 'HDO',
  'noida': 'DEL', 'gurugram': 'DEL', 'gurgaon': 'DEL',
  'faridabad': 'DEL', 'greater noida': 'DEL', 'ncr': 'DEL', 'delhi ncr': 'DEL',
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
  today.setHours(0, 0, 0, 0);

  const monthMap = {
    'jan': 0, 'january': 0,
    'feb': 1, 'february': 1,
    'mar': 2, 'march': 2,
    'apr': 3, 'april': 3,
    'may': 4,
    'jun': 5, 'june': 5,
    'jul': 6, 'july': 6,
    'aug': 7, 'august': 7,
    'sep': 8, 'september': 8,
    'oct': 9, 'october': 9,
    'nov': 10, 'november': 10,
    'dec': 11, 'december': 11,
  };

  const dayMap = {
    'sunday': 0, 'sun': 0,
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2, 'tues': 2,
    'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6,
  };

  let departureDate = null;

  // "20th feb", "15 march", "15th feb 2026", "feb 20", "march 15"
  const dateWithMonth = lower.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s*(\d{4}))?/i
  ) || lower.match(
    /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*(\d{4}))?/i
  );

  if (dateWithMonth) {
    let day, monthStr, yearStr;
    if (/^\d/.test(dateWithMonth[1])) {
      // "20 feb" format
      day = parseInt(dateWithMonth[1]);
      monthStr = dateWithMonth[2].toLowerCase().substring(0, 3);
      yearStr = dateWithMonth[3];
    } else {
      // "feb 20" format
      monthStr = dateWithMonth[1].toLowerCase().substring(0, 3);
      day = parseInt(dateWithMonth[2]);
      yearStr = dateWithMonth[3];
    }
    const month = monthMap[monthStr];
    const year = yearStr ? parseInt(yearStr) : today.getFullYear();
    departureDate = new Date(year, month, day);
    if (!yearStr && departureDate < today) {
      departureDate.setFullYear(today.getFullYear() + 1);
    }
  }

  // "on 21", "for 21", "on 5th" — just a day number, no month
  if (!departureDate) {
    const dayNumMatch = lower.match(/\b(?:on|for|date)?\s*(\d{1,2})(?:st|nd|rd|th)?\b/);
    if (dayNumMatch) {
      const day = parseInt(dayNumMatch[1]);
      if (day >= 1 && day <= 31) {
        const candidate = new Date(today.getFullYear(), today.getMonth(), day);
        if (candidate >= today) {
          departureDate = candidate;
        } else {
          // Same day number next month
          departureDate = new Date(today.getFullYear(), today.getMonth() + 1, day);
        }
      }
    }
  }

  // Day names: "saturday", "next monday", "this friday"
  if (!departureDate) {
    for (const [dayName, dayNum] of Object.entries(dayMap)) {
      if (lower.includes(dayName)) {
        const isNext = lower.includes('next ' + dayName);
        const todayDay = today.getDay();
        let diff = dayNum - todayDay;
        if (diff <= 0 || isNext) diff += 7; // always upcoming, "next X" skips to week after
        const candidate = new Date(today);
        candidate.setDate(today.getDate() + diff);
        departureDate = candidate;
        break;
      }
    }
  }

  // Relative words
  if (!departureDate) {
    if (lower.includes('day after tomorrow')) {
      departureDate = new Date(today);
      departureDate.setDate(today.getDate() + 2);
    } else if (lower.includes('tomorrow')) {
      departureDate = new Date(today);
      departureDate.setDate(today.getDate() + 1);
    } else if (lower.includes('today')) {
      departureDate = new Date(today);
    } else if (lower.includes('next week')) {
      departureDate = new Date(today);
      departureDate.setDate(today.getDate() + 7);
    } else if (lower.includes('next month')) {
      departureDate = new Date(today);
      departureDate.setMonth(today.getMonth() + 1);
    }
  }

  if (!departureDate) {
    departureDate = new Date(today);
    departureDate.setDate(today.getDate() + 1);
  }

  const yr = departureDate.getFullYear();
  const mo = String(departureDate.getMonth() + 1).padStart(2, '0');
  const dy = String(departureDate.getDate()).padStart(2, '0');
  const formattedDate = `${yr}-${mo}-${dy}`;

  const MONTHS_RE = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
  const DAYS_RE = 'next\\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat';

  // Strip all date expressions before extracting cities (order matters — month+day before bare number)
  const stripped = lower
    .replace(/\b(day after tomorrow|tomorrow|today|tonight|next week|next month)\b/gi, '')
    .replace(new RegExp(`\\b(?:${DAYS_RE})\\b`, 'gi'), '')
    .replace(new RegExp(`(?:on\\s+|for\\s+)?(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${MONTHS_RE})|(?:${MONTHS_RE})\\s+\\d{1,2}(?:st|nd|rd|th)?)(?:\\s*\\d{4})?`, 'gi'), '')
    .replace(/\b(?:on|for)?\s*\d{1,2}(?:st|nd|rd|th)?\b/gi, '')
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

// Fetch flights for a single cabin class (1=Economy, 2=PremiumEconomy, 3=Business)
// Returns { bestFlights, allFlights, googleFlightsUrl }
async function fetchByClass(params, travelClass) {
  const classNames = { 1: 'Economy', 2: 'Premium Economy', 3: 'Business' };
  try {
    const data = await getJson({ ...params, travel_class: travelClass });
    if (data.error) {
      console.error(`❌ SerpAPI [${classNames[travelClass]}]:`, data.error);
      return { bestFlights: [], allFlights: [], googleFlightsUrl: null };
    }
    const bestFlights = data.best_flights || [];
    const otherFlights = data.other_flights || [];
    return {
      bestFlights,
      allFlights: [...bestFlights, ...otherFlights],
      googleFlightsUrl: data.search_metadata?.google_flights_url || null,
    };
  } catch (err) {
    console.error(`❌ SerpAPI [${classNames[travelClass]}]:`, err.message);
    return { bestFlights: [], allFlights: [], googleFlightsUrl: null };
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
    gl: 'in',   // India locale — gives India-market prices
    type: '2',  // one-way
  };

  try {
    // Single economy search — use best_flights only (Google's top picks for Indian market)
    // best_flights = options available on Indian platforms like MakeMyTrip/Goibibo
    // other_flights = obscure/connecting options often not available on Indian OTAs
    const economyResult = await fetchByClass(baseParams, 1);

    const bookingUrl = economyResult.googleFlightsUrl
      || `https://www.google.com/travel/flights?hl=en&curr=INR`;

    const validOffers = economyResult.allFlights;

    if (validOffers.length === 0) {
      return { error: `No flights found from ${parsed.origin} to ${parsed.destination} on ${parsed.departureDate}` };
    }

    const premiumPriceMap = new Map();
    const businessPriceMap = new Map();

    const topOffers = validOffers.slice(0, 20);

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

      const stops = segs.length - 1;
      const stopAirports = segs.slice(0, -1).map((s) => s.arrival_airport?.id || '');
      const layoverInfo = (offer.layovers || []).map(
        (l) => `${l.id || l.name} (${formatDuration(l.duration)})`
      );

      return {
        rank: index + 1,
        airline: airlineName,
        airlineCode,
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
        bookingUrl,
        bookingToken: offer.booking_token || null,
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
      output += `💺 Economy: **₹${f.price.economy.toLocaleString('en-IN')}**`;
      if (f.price.premiumEconomy > 0) output += ` · Premium: **₹${f.price.premiumEconomy.toLocaleString('en-IN')}**`;
      if (f.price.business > 0) output += ` · Business: **₹${f.price.business.toLocaleString('en-IN')}**`;
      output += ` — [Book](${f.bookingUrl})\n`;
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
      _bookingUrl: f.bookingUrl || null,
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
