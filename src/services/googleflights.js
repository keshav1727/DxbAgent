const config = require('../config');

const SERPAPI_BASE = 'https://serpapi.com/search.json';

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

  // International - Middle East
  'dubai': 'DXB', 'dxb': 'DXB',
  'abu dhabi': 'AUH', 'auh': 'AUH',
  'doha': 'DOH', 'doh': 'DOH',
  'riyadh': 'RUH', 'ruh': 'RUH',
  'jeddah': 'JED', 'jed': 'JED',
  'muscat': 'MCT', 'mct': 'MCT',
  'kuwait': 'KWI', 'kwi': 'KWI',
  'bahrain': 'BAH', 'bah': 'BAH',

  // International - Asia
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

  // International - Europe
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

  // International - Americas
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

// Parse flight query
function parseFlightQuery(query) {
  const lower = query.toLowerCase();
  const today = new Date();

  let departureDate = null;

  const monthMap = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
  };

  // Check for "20th feb", "15 march", "15th feb 2026"
  const dateMatch = lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s*(\d{4}))?/i);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = monthMap[dateMatch[2].toLowerCase().substring(0, 3)];
    const year = dateMatch[3] ? parseInt(dateMatch[3]) : today.getFullYear();
    departureDate = new Date(year, month, day);
    if (!dateMatch[3] && departureDate < today) {
      departureDate.setFullYear(year + 1);
    }
  }

  // Relative dates
  if (lower.includes('today')) {
    departureDate = new Date(today);
  } else if (lower.includes('tomorrow')) {
    departureDate = new Date(today);
    departureDate.setDate(today.getDate() + 1);
  } else if (lower.includes('day after tomorrow')) {
    departureDate = new Date(today);
    departureDate.setDate(today.getDate() + 2);
  }

  // Default to tomorrow
  if (!departureDate) {
    departureDate = new Date(today);
    departureDate.setDate(today.getDate() + 1);
  }

  // Format as YYYY-MM-DD
  const year = departureDate.getFullYear();
  const month = String(departureDate.getMonth() + 1).padStart(2, '0');
  const day = String(departureDate.getDate()).padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;

  // Extract origin and destination
  let origin = null;
  let destination = null;

  const fromToMatch = lower.match(/(?:from\s+)?([a-z\s]+)\s+to\s+([a-z\s]+?)(?:\s+(?:on|for|tomorrow|today|next|\d))/i) ||
                      lower.match(/(?:from\s+)?([a-z\s]+)\s+to\s+([a-z\s]+)/i);

  if (fromToMatch) {
    origin = fromToMatch[1].trim();
    destination = fromToMatch[2].trim();
  }

  const cleanCity = (city) => {
    return city.replace(/\b(flight|flights|from|cheap|cheapest|book|booking|for|on|the|a)\b/gi, '').trim();
  };

  if (origin) origin = cleanCity(origin);
  if (destination) destination = cleanCity(destination);

  return {
    origin: origin ? getAirportCode(origin) : null,
    destination: destination ? getAirportCode(destination) : null,
    departureDate: formattedDate,
  };
}

// Fetch flights for a specific travel class
async function fetchFlightsByClass(parsed, adults, travelClass) {
  const params = new URLSearchParams({
    engine: 'google_flights',
    departure_id: parsed.origin,
    arrival_id: parsed.destination,
    outbound_date: parsed.departureDate,
    currency: 'INR',
    hl: 'en',
    adults: adults.toString(),
    type: '2', // One-way
    travel_class: travelClass.toString(), // 1=Economy, 2=Premium Economy, 3=Business, 4=First
    api_key: config.serpapi.apiKey,
  });

  const response = await fetch(`${SERPAPI_BASE}?${params}`);
  if (!response.ok) return null;

  const data = await response.json();
  if (data.error) return null;

  return data;
}

// Search flights using SerpApi Google Flights
async function searchFlights(query, adults = 1) {
  if (!config.serpapi?.apiKey) {
    return { error: 'SerpApi not configured. Add SERPAPI_KEY to .env.local' };
  }

  const parsed = parseFlightQuery(query);

  if (!parsed.origin || !parsed.destination) {
    return { error: 'Could not parse origin and destination. Use format: "flights from [city] to [city]"' };
  }

  console.log(`✈️ Google Flights: ${parsed.origin} → ${parsed.destination} on ${parsed.departureDate}`);

  try {
    // Fetch Economy and Premium Economy in parallel
    const [economyData, premiumData] = await Promise.all([
      fetchFlightsByClass(parsed, adults, 1),  // Economy
      fetchFlightsByClass(parsed, adults, 2),  // Premium Economy
    ]);

    if (!economyData) {
      return { error: `No flights found from ${parsed.origin} to ${parsed.destination} on ${parsed.departureDate}` };
    }

    // Build premium economy price map (by flight number)
    const premiumPrices = {};
    if (premiumData) {
      const premiumFlights = [...(premiumData.best_flights || []), ...(premiumData.other_flights || [])];
      premiumFlights.forEach(flight => {
        const legs = flight.flights || [];
        const firstLeg = legs[0] || {};
        const key = `${firstLeg.airline}-${firstLeg.flight_number}-${firstLeg.departure_airport?.time}`;
        premiumPrices[key] = flight.price || null;
      });
    }

    // Get best flights and other flights from economy
    const bestFlights = economyData.best_flights || [];
    const otherFlights = economyData.other_flights || [];
    const allFlights = [...bestFlights, ...otherFlights].slice(0, 15);

    if (allFlights.length === 0) {
      return { error: `No flights found from ${parsed.origin} to ${parsed.destination} on ${parsed.departureDate}` };
    }

    const flights = allFlights.map((flight, index) => {
      const legs = flight.flights || [];
      const firstLeg = legs[0] || {};
      const lastLeg = legs[legs.length - 1] || firstLeg;

      // Key for matching premium price
      const priceKey = `${firstLeg.airline}-${firstLeg.flight_number}-${firstLeg.departure_airport?.time}`;
      const premiumEconomyPrice = premiumPrices[priceKey] || null;

      // Calculate total duration
      const totalDuration = flight.total_duration || 0;
      const hours = Math.floor(totalDuration / 60);
      const mins = totalDuration % 60;
      const duration = `${hours}h ${mins}m`;

      // Stops
      const stops = legs.length - 1;
      const stopAirports = legs.slice(0, -1).map(l => l.arrival_airport?.id || '').filter(Boolean);

      // Get layover info
      const layovers = flight.layovers || [];
      const layoverInfo = layovers.map(l => `${l.name} (${Math.floor(l.duration / 60)}h ${l.duration % 60}m)`);

      return {
        rank: index + 1,
        airline: firstLeg.airline || 'Unknown',
        airlineLogo: firstLeg.airline_logo || null,
        flightNumber: firstLeg.flight_number || 'N/A',
        departure: {
          airport: firstLeg.departure_airport?.id || parsed.origin,
          airportName: firstLeg.departure_airport?.name || '',
          time: firstLeg.departure_airport?.time || 'N/A',
          date: parsed.departureDate,
        },
        arrival: {
          airport: lastLeg.arrival_airport?.id || parsed.destination,
          airportName: lastLeg.arrival_airport?.name || '',
          time: lastLeg.arrival_airport?.time || 'N/A',
          date: parsed.departureDate,
        },
        duration: duration,
        stops: stops,
        stopDetails: stopAirports,
        layoverInfo: layoverInfo,
        airplane: firstLeg.airplane || 'N/A',
        travelClass: firstLeg.travel_class || 'Economy',
        legroom: firstLeg.legroom || 'N/A',
        extensions: firstLeg.extensions || [],
        price: {
          economy: flight.price || 0,
          premiumEconomy: premiumEconomyPrice,
          currency: 'INR',
        },
        bookingToken: flight.booking_token || null,
        carbonEmissions: flight.carbon_emissions?.this_flight ?
          `${Math.round(flight.carbon_emissions.this_flight / 1000)} kg CO2` : null,
      };
    });

    return {
      success: true,
      route: {
        origin: parsed.origin,
        destination: parsed.destination,
        date: parsed.departureDate,
        originName: economyData.airports?.[0]?.departure?.[0]?.airport?.name || parsed.origin,
        destinationName: economyData.airports?.[0]?.arrival?.[0]?.airport?.name || parsed.destination,
      },
      flights: flights,
      totalFound: flights.length,
      priceInsights: economyData.price_insights || null,
    };

  } catch (error) {
    console.error('❌ SerpApi Error:', error.message);
    return { error: `Flight search failed: ${error.message}` };
  }
}

// Format results for display
function formatFlightResults(results) {
  if (results.error) {
    return `❌ ${results.error}`;
  }

  const { route, flights, totalFound, priceInsights } = results;

  let output = `✈️ **${route.originName || route.origin} → ${route.destinationName || route.destination}**\n`;
  output += `📅 ${route.date}\n`;
  output += `🔍 ${totalFound} flights found (Google Flights)\n`;

  // Price insights
  if (priceInsights) {
    output += `💡 Prices are ${priceInsights.price_level || 'typical'} right now\n`;
  }
  output += `\n`;

  flights.forEach((f) => {
    const stopsText = f.stops === 0 ? 'Non-stop' : `${f.stops} stop${f.stops > 1 ? 's' : ''}`;

    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    output += `**${f.rank}. ${f.airline}** - ${f.flightNumber}\n`;
    output += `🛫 Departure: ${f.departure.time} (${f.departure.airport})\n`;
    output += `🛬 Arrival: ${f.arrival.time} (${f.arrival.airport})\n`;
    output += `⏱️ Duration: ${f.duration}\n`;
    output += `🔄 Type: ${stopsText}\n`;
    if (f.stopDetails.length > 0) {
      output += `📍 Via: ${f.stopDetails.join(', ')}\n`;
    }
    if (f.layoverInfo.length > 0) {
      output += `⏳ Layover: ${f.layoverInfo.join(', ')}\n`;
    }
    if (f.price.economy > 0) {
      output += `💰 Economy: **₹${f.price.economy.toLocaleString('en-IN')}**\n`;
    } else {
      output += `💰 Economy: Price not available\n`;
    }
    if (f.price.premiumEconomy && f.price.premiumEconomy > 0) {
      output += `💎 Premium Economy: **₹${f.price.premiumEconomy.toLocaleString('en-IN')}**\n`;
    }
    output += `✈️ Aircraft: ${f.airplane}\n`;
    if (f.legroom !== 'N/A') {
      output += `🦵 Legroom: ${f.legroom}\n`;
    }
    if (f.carbonEmissions) {
      output += `🌱 Emissions: ${f.carbonEmissions}\n`;
    }
    if (f.extensions.length > 0) {
      output += `ℹ️ ${f.extensions.join(' • ')}\n`;
    }
    output += `\n`;
  });

  // Summary
  if (flights.length > 0) {
    // Only consider flights with valid prices for cheapest
    const flightsWithPrice = flights.filter(f => f.price.economy > 0);
    const cheapest = flightsWithPrice.length > 0
      ? flightsWithPrice.reduce((min, f) => f.price.economy < min.price.economy ? f : min, flightsWithPrice[0])
      : null;
    const fastest = flights.reduce((min, f) => {
      const getDuration = (d) => {
        const match = d.match(/(\d+)h\s*(\d+)?m?/);
        return match ? parseInt(match[1]) * 60 + (parseInt(match[2]) || 0) : 9999;
      };
      return getDuration(f.duration) < getDuration(min.duration) ? f : min;
    }, flights[0]);
    const nonStop = flights.filter(f => f.stops === 0);

    output += `📊 **Summary:**\n`;
    if (cheapest) {
      output += `• 💰 Cheapest: ${cheapest.airline} ${cheapest.flightNumber} at ₹${cheapest.price.economy.toLocaleString('en-IN')}\n`;
    }
    output += `• ⚡ Fastest: ${fastest.airline} ${fastest.flightNumber} (${fastest.duration})\n`;
    if (nonStop.length > 0) {
      output += `• ✅ Non-stop: ${nonStop.length} available\n`;
    }
  }

  output += `\n🔗 **Book on:**\n`;
  output += `• [Google Flights](https://www.google.com/travel/flights/search?tfs=CBwQAhooEgoyMDI2LTAyLTEwagwIAhIIL20vMDljMTdyDAgCEggvbS8wZGxjdkABSAFwAYIBCwj___________8BmAEB)\n`;
  output += `• [MakeMyTrip](https://www.makemytrip.com/flights/)\n`;
  output += `• [Cleartrip](https://www.cleartrip.com/flights/)\n`;

  return output;
}

function init() {
  if (config.serpapi?.apiKey) {
    console.log('✈️ SerpApi: Google Flights enabled');
    return true;
  }
  console.log('⚠️ SerpApi: Not configured (add SERPAPI_KEY)');
  return false;
}

module.exports = {
  init,
  searchFlights,
  formatFlightResults,
  parseFlightQuery,
};
