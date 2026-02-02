const Amadeus = require('amadeus');
const config = require('../config');

let amadeus = null;

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
  'MS': 'EgyptAir', 'W3': 'Arik Air', 'MK': 'Air Mauritius',
  '9W': 'Jet Airways', 'IX': 'Air India Express', 'S5': 'Star Air',
};

function getAirlineName(carrierCode) {
  return AIRLINE_NAMES[carrierCode] || carrierCode;
}

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

// Parse ISO 8601 duration (e.g., "PT2H30M") to minutes
function parseISO8601Duration(duration) {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || 0);
  const mins = parseInt(match[2] || 0);
  return hours * 60 + mins;
}

// Format minutes to "Xh Ym"
function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}h ${mins}m`;
}

// Search flights using Amadeus Flight Offers Search
async function searchFlights(query, adults = 1) {
  if (!amadeus) {
    return { error: 'Amadeus not configured. Add AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET to .env.local' };
  }

  const parsed = parseFlightQuery(query);

  if (!parsed.origin || !parsed.destination) {
    return { error: 'Could not parse origin and destination. Use format: "flights from [city] to [city]"' };
  }

  console.log(`\u2708\uFE0F Amadeus Flights: ${parsed.origin} \u2192 ${parsed.destination} on ${parsed.departureDate}`);

  try {
    const response = await amadeus.shopping.flightOffersSearch.get({
      originLocationCode: parsed.origin,
      destinationLocationCode: parsed.destination,
      departureDate: parsed.departureDate,
      adults: adults,
      currencyCode: 'INR',
      nonStop: false,
      max: 15,
    });

    const offers = response.data || [];

    if (offers.length === 0) {
      return { error: `No flights found from ${parsed.origin} to ${parsed.destination} on ${parsed.departureDate}` };
    }

    // Extract carrier names from dictionaries
    const carrierDict = response.result?.dictionaries?.carriers || {};

    const flights = offers.map((offer, index) => {
      const itinerary = offer.itineraries[0]; // One-way: first itinerary
      const segments = itinerary.segments || [];
      const firstSeg = segments[0] || {};
      const lastSeg = segments[segments.length - 1] || firstSeg;

      // Total duration from itinerary
      const totalMinutes = parseISO8601Duration(itinerary.duration);

      // Stops
      const stops = segments.length - 1;
      const stopAirports = segments.slice(0, -1).map(s => s.arrival.iataCode);

      // Layover durations between segments
      const layoverInfo = [];
      for (let i = 0; i < segments.length - 1; i++) {
        const arrivalTime = new Date(segments[i].arrival.at);
        const departureTime = new Date(segments[i + 1].departure.at);
        const layoverMins = Math.round((departureTime - arrivalTime) / 60000);
        layoverInfo.push(`${segments[i].arrival.iataCode} (${formatDuration(layoverMins)})`);
      }

      // Carrier name
      const carrierCode = firstSeg.carrierCode || '';
      const airlineName = carrierDict[carrierCode] || getAirlineName(carrierCode);

      // Price
      const price = parseFloat(offer.price?.grandTotal || offer.price?.total || 0);

      // Departure and arrival times
      const depTime = firstSeg.departure?.at || '';
      const arrTime = lastSeg.arrival?.at || '';

      // Aircraft type
      const aircraft = firstSeg.aircraft?.code || 'N/A';

      // Cabin class from traveler pricing
      const travelerPricing = offer.travelerPricings?.[0];
      const cabin = travelerPricing?.fareDetailsBySegment?.[0]?.cabin || 'ECONOMY';
      const travelClass = cabin.charAt(0) + cabin.slice(1).toLowerCase();

      return {
        rank: index + 1,
        airline: airlineName,
        airlineLogo: null,
        flightNumber: `${carrierCode}${firstSeg.number || ''}`,
        departure: {
          airport: firstSeg.departure?.iataCode || parsed.origin,
          airportName: firstSeg.departure?.iataCode || '',
          time: depTime ? new Date(depTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A',
          date: parsed.departureDate,
        },
        arrival: {
          airport: lastSeg.arrival?.iataCode || parsed.destination,
          airportName: lastSeg.arrival?.iataCode || '',
          time: arrTime ? new Date(arrTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'N/A',
          date: parsed.departureDate,
        },
        duration: formatDuration(totalMinutes),
        stops: stops,
        stopDetails: stopAirports,
        layoverInfo: layoverInfo,
        airplane: aircraft,
        travelClass: travelClass,
        legroom: 'N/A',
        extensions: [],
        price: {
          economy: price,
          premiumEconomy: null,
          currency: 'INR',
        },
        bookingToken: null,
        carbonEmissions: null,
      };
    });

    return {
      success: true,
      route: {
        origin: parsed.origin,
        destination: parsed.destination,
        date: parsed.departureDate,
        originName: parsed.origin,
        destinationName: parsed.destination,
      },
      flights: flights,
      totalFound: flights.length,
      priceInsights: null,
    };

  } catch (error) {
    console.error('\u274C Amadeus Flights Error:', error.description || error.message);
    return { error: `Flight search failed: ${error.description?.[0]?.detail || error.message}` };
  }
}

// Format results for display
function formatFlightResults(results) {
  if (results.error) {
    return `\u274C ${results.error}`;
  }

  const { route, flights, totalFound } = results;

  let output = `\u2708\uFE0F **${route.originName || route.origin} \u2192 ${route.destinationName || route.destination}**\n`;
  output += `\uD83D\uDCC5 ${route.date}\n`;
  output += `\uD83D\uDD0D ${totalFound} flights found (Amadeus)\n`;
  output += `\n`;

  flights.forEach((f) => {
    const stopsText = f.stops === 0 ? 'Non-stop' : `${f.stops} stop${f.stops > 1 ? 's' : ''}`;

    output += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;
    output += `**${f.rank}. ${f.airline}** - ${f.flightNumber}\n`;
    output += `\uD83D\uDEEB Departure: ${f.departure.time} (${f.departure.airport})\n`;
    output += `\uD83D\uDEEC Arrival: ${f.arrival.time} (${f.arrival.airport})\n`;
    output += `\u23F1\uFE0F Duration: ${f.duration}\n`;
    output += `\uD83D\uDD04 Type: ${stopsText}\n`;
    if (f.stopDetails.length > 0) {
      output += `\uD83D\uDCCD Via: ${f.stopDetails.join(', ')}\n`;
    }
    if (f.layoverInfo.length > 0) {
      output += `\u23F3 Layover: ${f.layoverInfo.join(', ')}\n`;
    }
    if (f.price.economy > 0) {
      output += `\uD83D\uDCB0 Economy: **\u20B9${f.price.economy.toLocaleString('en-IN')}**\n`;
    } else {
      output += `\uD83D\uDCB0 Economy: Price not available\n`;
    }
    if (f.price.premiumEconomy && f.price.premiumEconomy > 0) {
      output += `\uD83D\uDC8E Premium Economy: **\u20B9${f.price.premiumEconomy.toLocaleString('en-IN')}**\n`;
    }
    output += `\u2708\uFE0F Aircraft: ${f.airplane}\n`;
    output += `\n`;
  });

  // Summary
  if (flights.length > 0) {
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

    output += `\uD83D\uDCCA **Summary:**\n`;
    if (cheapest) {
      output += `\u2022 \uD83D\uDCB0 Cheapest: ${cheapest.airline} ${cheapest.flightNumber} at \u20B9${cheapest.price.economy.toLocaleString('en-IN')}\n`;
    }
    output += `\u2022 \u26A1 Fastest: ${fastest.airline} ${fastest.flightNumber} (${fastest.duration})\n`;
    if (nonStop.length > 0) {
      output += `\u2022 \u2705 Non-stop: ${nonStop.length} available\n`;
    }
  }

  output += `\n\uD83D\uDD17 **Book on:**\n`;
  output += `\u2022 [Google Flights](https://www.google.com/travel/flights)\n`;
  output += `\u2022 [MakeMyTrip](https://www.makemytrip.com/flights/)\n`;
  output += `\u2022 [Cleartrip](https://www.cleartrip.com/flights/)\n`;

  return output;
}

function init() {
  if (config.amadeus?.clientId && config.amadeus?.clientSecret) {
    amadeus = new Amadeus({
      clientId: config.amadeus.clientId,
      clientSecret: config.amadeus.clientSecret,
    });
    console.log('\u2708\uFE0F Amadeus: Flight search enabled');
    return true;
  }
  console.log('\u26A0\uFE0F Amadeus: Not configured (add AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET)');
  return false;
}

module.exports = {
  init,
  searchFlights,
  formatFlightResults,
  parseFlightQuery,
};
