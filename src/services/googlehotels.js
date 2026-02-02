const Amadeus = require('amadeus');
const config = require('../config');

let amadeus = null;

// Currency detection map
const CURRENCY_MAP = {
  '$': 'USD', 'usd': 'USD', 'dollar': 'USD', 'dollars': 'USD',
  '€': 'EUR', 'eur': 'EUR', 'euro': 'EUR', 'euros': 'EUR',
  '£': 'GBP', 'gbp': 'GBP', 'pound': 'GBP', 'pounds': 'GBP',
  '₹': 'INR', 'inr': 'INR', 'rs': 'INR', 'rupee': 'INR', 'rupees': 'INR',
};

const CURRENCY_SYMBOLS = {
  'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹',
};

// City code mapping for Amadeus hotel search (IATA city codes)
const CITY_CODES = {
  // India
  'delhi': 'DEL', 'new delhi': 'DEL', 'mumbai': 'BOM', 'bombay': 'BOM',
  'bangalore': 'BLR', 'bengaluru': 'BLR', 'chennai': 'MAA', 'madras': 'MAA',
  'hyderabad': 'HYD', 'kolkata': 'CCU', 'calcutta': 'CCU',
  'pune': 'PNQ', 'ahmedabad': 'AMD', 'goa': 'GOI', 'jaipur': 'JAI',
  'kochi': 'COK', 'cochin': 'COK', 'lucknow': 'LKO', 'varanasi': 'VNS',
  'amritsar': 'ATQ', 'udaipur': 'UDR', 'jodhpur': 'JDH',
  'shimla': 'SLV', 'manali': 'KUU', 'rishikesh': 'DED',
  'agra': 'AGR', 'srinagar': 'SXR',

  // Middle East
  'dubai': 'DXB', 'abu dhabi': 'AUH', 'doha': 'DOH', 'riyadh': 'RUH',
  'jeddah': 'JED', 'muscat': 'MCT', 'kuwait': 'KWI', 'bahrain': 'BAH',

  // Asia
  'singapore': 'SIN', 'bangkok': 'BKK', 'kuala lumpur': 'KUL',
  'hong kong': 'HKG', 'tokyo': 'TYO', 'seoul': 'SEL',
  'shanghai': 'SHA', 'beijing': 'BJS', 'jakarta': 'JKT',
  'bali': 'DPS', 'denpasar': 'DPS', 'phuket': 'HKT',
  'manila': 'MNL', 'kathmandu': 'KTM', 'colombo': 'CMB',
  'dhaka': 'DAC', 'maldives': 'MLE', 'male': 'MLE',

  // Europe
  'london': 'LON', 'paris': 'PAR', 'frankfurt': 'FRA', 'amsterdam': 'AMS',
  'rome': 'ROM', 'milan': 'MIL', 'zurich': 'ZRH', 'munich': 'MUC',
  'madrid': 'MAD', 'barcelona': 'BCN', 'vienna': 'VIE', 'brussels': 'BRU',
  'istanbul': 'IST', 'moscow': 'MOW', 'prague': 'PRG', 'lisbon': 'LIS',
  'athens': 'ATH', 'dublin': 'DUB', 'edinburgh': 'EDI',

  // Americas
  'new york': 'NYC', 'los angeles': 'LAX', 'san francisco': 'SFO',
  'chicago': 'CHI', 'miami': 'MIA', 'washington': 'WAS',
  'boston': 'BOS', 'seattle': 'SEA', 'dallas': 'DFW',
  'houston': 'IAH', 'atlanta': 'ATL', 'toronto': 'YTO',
  'vancouver': 'YVR', 'sydney': 'SYD', 'melbourne': 'MEL',

  // Africa
  'johannesburg': 'JNB', 'cape town': 'CPT', 'nairobi': 'NBO',
  'cairo': 'CAI', 'lagos': 'LOS', 'addis ababa': 'ADD', 'mauritius': 'MRU',
};

function getCityCode(location) {
  const normalized = location.toLowerCase().trim();
  return CITY_CODES[normalized] || normalized.toUpperCase().substring(0, 3);
}

// Parse hotel query to extract location, check-in, check-out, budget, star rating, and currency
function parseHotelQuery(query) {
  const lower = query.toLowerCase();
  const today = new Date();

  // --- Extract currency ---
  let currency = 'INR'; // default
  const currencySymbolMatch = lower.match(/([$€£₹])\s*\d/);
  if (currencySymbolMatch) {
    currency = CURRENCY_MAP[currencySymbolMatch[1]] || 'INR';
  } else {
    for (const [key, val] of Object.entries(CURRENCY_MAP)) {
      if (key.length >= 3 && lower.includes(key)) {
        currency = val;
        break;
      }
    }
  }

  // --- Extract star rating ---
  let starRating = null;
  const starMatch = lower.match(/(\d)\s*[-\s]?\s*star/i);
  if (starMatch) {
    const s = parseInt(starMatch[1]);
    if (s >= 1 && s <= 5) starRating = s;
  }
  if (!starRating && lower.includes('luxury')) starRating = 5;
  if (!starRating && /\bbudget\b/.test(lower) && !lower.match(/budget\s*(?:₹|rs|inr|\$|€|£|\d)/i)) {
    starRating = 3;
  }

  // --- Extract budget/price range ---
  let maxPrice = null;
  let minPrice = null;

  const underMatch = lower.match(/(?:under|below|less than|max|upto|up to)\s*(?:[$€£₹]|rs\.?|inr|usd|eur|gbp)?\s*(\d+)\s*(k)?/i);
  if (underMatch) {
    maxPrice = parseInt(underMatch[1]);
    if (underMatch[2]) maxPrice *= 1000;
    if (currency === 'INR' && maxPrice < 500) maxPrice *= 1000;
  }

  const rangeMatch = lower.match(/(\d+)\s*(k)?\s*(?:-|to)\s*(\d+)\s*(k)?/i);
  if (rangeMatch && !underMatch) {
    minPrice = parseInt(rangeMatch[1]);
    maxPrice = parseInt(rangeMatch[3]);
    if (rangeMatch[2]) minPrice *= 1000;
    if (rangeMatch[4]) maxPrice *= 1000;
    if (currency === 'INR' && minPrice < 500) minPrice *= 1000;
    if (currency === 'INR' && maxPrice < 500) maxPrice *= 1000;
  }

  // --- Extract location ---
  let location = null;

  const locationPatterns = [
    /(?:hotels?\s+(?:in|at|near|around|for|of)\s+)([a-z\s]+?)(?:\s+(?:under|below|from|budget|price|near|airport|\d))/i,
    /(?:hotels?\s+(?:in|at|near|around|for|of)\s+)([a-z\s]+)/i,
    /(?:(?:in|at|near|for)\s+)([a-z\s]+?)(?:\s+(?:hotel|under|below|from|budget|\d))/i,
    /([a-z\s]+?)\s+hotels?/i,
  ];

  for (const pattern of locationPatterns) {
    const match = lower.match(pattern);
    if (match) {
      location = match[1].trim();
      break;
    }
  }

  const nearAirport = lower.includes('near airport') || lower.includes('airport area');

  if (location) {
    location = location.replace(/\b(hotel|hotels|in|at|near|around|the|for|of|under|below|budget|from|to|per|day|night|star|luxury|\d)\b/gi, '').trim();
    if (nearAirport) {
      location += ' airport';
    }
  }

  // --- Extract dates ---
  let checkIn = new Date(today);
  checkIn.setDate(today.getDate() + 1);

  let checkOut = new Date(checkIn);
  checkOut.setDate(checkIn.getDate() + 1);

  const monthMap = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
  };

  const dateRangeMatch = lower.match(/(?:from\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s*(\d{4}))?\s+(?:to|till|until|-)\s*(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s*(\d{4}))?/i);

  if (dateRangeMatch) {
    const inDay = parseInt(dateRangeMatch[1]);
    const inMonth = monthMap[dateRangeMatch[2].toLowerCase().substring(0, 3)];
    const inYear = dateRangeMatch[3] ? parseInt(dateRangeMatch[3]) : today.getFullYear();
    checkIn = new Date(inYear, inMonth, inDay);
    if (!dateRangeMatch[3] && checkIn < today) checkIn.setFullYear(inYear + 1);

    const outDay = parseInt(dateRangeMatch[4]);
    const outMonth = monthMap[dateRangeMatch[5].toLowerCase().substring(0, 3)];
    const outYear = dateRangeMatch[6] ? parseInt(dateRangeMatch[6]) : checkIn.getFullYear();
    checkOut = new Date(outYear, outMonth, outDay);
    if (checkOut <= checkIn) checkOut.setFullYear(outYear + 1);
  } else {
    const dateMatch = lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s*(\d{4}))?/i);
    if (dateMatch) {
      const day = parseInt(dateMatch[1]);
      const month = monthMap[dateMatch[2].toLowerCase().substring(0, 3)];
      const year = dateMatch[3] ? parseInt(dateMatch[3]) : today.getFullYear();
      checkIn = new Date(year, month, day);
      if (!dateMatch[3] && checkIn < today) checkIn.setFullYear(year + 1);
      checkOut = new Date(checkIn);
      checkOut.setDate(checkIn.getDate() + 1);
    }
  }

  if (lower.includes('today') || lower.includes('tonight')) {
    checkIn = new Date(today);
    checkOut = new Date(today);
    checkOut.setDate(today.getDate() + 1);
  } else if (lower.includes('tomorrow')) {
    checkIn = new Date(today);
    checkIn.setDate(today.getDate() + 1);
    checkOut = new Date(checkIn);
    checkOut.setDate(checkIn.getDate() + 1);
  }

  const nightsMatch = lower.match(/(\d+)\s*(?:night|nights|day|days)/i);
  if (nightsMatch && !dateRangeMatch) {
    checkOut = new Date(checkIn);
    checkOut.setDate(checkIn.getDate() + parseInt(nightsMatch[1]));
  }

  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    location,
    checkIn: formatDate(checkIn),
    checkOut: formatDate(checkOut),
    minPrice,
    maxPrice,
    nearAirport,
    starRating,
    currency,
  };
}

// Check what info is missing from hotel query
function getMissingHotelInfo(query) {
  const lower = query.toLowerCase();
  const missing = [];

  const parsed = parseHotelQuery(query);
  if (!parsed.location) missing.push('location');

  const hasDate = lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) ||
    lower.includes('today') || lower.includes('tonight') || lower.includes('tomorrow');
  if (!hasDate) missing.push('dates');

  const hasBudget = lower.match(/(?:under|below|less than|max|upto|up to)\s*(?:[$€£₹]|rs\.?|inr|usd|eur|gbp)?\s*\d/i) ||
    lower.match(/\d+\s*k?\s*(?:-|to)\s*\d+/i);
  if (!hasBudget) missing.push('budget');

  return { parsed, missing };
}

// Build prompt asking for missing info
function buildHotelPrompt(missing) {
  let prompt = `🏨 I'll help you find hotels! Please share:\n\n`;

  if (missing.includes('location')) {
    prompt += `📍 **Location:** Which city or area?\n`;
  }
  if (missing.includes('dates')) {
    prompt += `📅 **Dates:** Check-in and check-out dates?\n`;
  }
  if (missing.includes('budget')) {
    prompt += `💰 **Budget:** Max price per night? (e.g., under 5k, under $150)\n`;
  }

  prompt += `\nExample: "hotels in paris from 5th feb to 8th feb under $200"`;
  return prompt;
}

// Search hotels using Amadeus: 2-step flow
async function searchHotels(query, adults = 2) {
  if (!amadeus) {
    return { error: 'Amadeus not configured. Add AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET to .env.local' };
  }

  const parsed = parseHotelQuery(query);

  if (!parsed.location) {
    return { error: 'Could not find location. Use format: "hotels in [city]" or "[city] hotels"' };
  }

  const sym = CURRENCY_SYMBOLS[parsed.currency] || parsed.currency;
  const cityCode = getCityCode(parsed.location);

  console.log(`🏨 Amadeus Hotels: ${parsed.location} (${cityCode}) ${parsed.checkIn} to ${parsed.checkOut} [${parsed.currency}]`);
  if (parsed.maxPrice) {
    console.log(`   Budget: ${parsed.minPrice ? sym + parsed.minPrice + ' - ' : 'Under '}${sym}${parsed.maxPrice}`);
  }

  try {
    // Step 1: Get hotel IDs by city
    console.log(`🏨 Step 1: Fetching hotel list for city ${cityCode}...`);
    const hotelListParams = { cityCode };
    if (parsed.starRating) {
      hotelListParams.ratings = [parsed.starRating].join(',');
    }

    const hotelListResponse = await amadeus.referenceData.locations.hotels.byCity.get(hotelListParams);
    let hotelList = hotelListResponse.data || [];

    if (hotelList.length === 0) {
      return { error: `No hotels found in ${parsed.location}` };
    }

    console.log(`🏨 Found ${hotelList.length} hotels in ${cityCode}`);

    // Limit to first 40 hotels (we'll batch in groups of 20)
    hotelList = hotelList.slice(0, 40);

    // Step 2: Get offers for hotels in batches
    const BATCH_SIZE = 20;
    const batches = [];
    for (let i = 0; i < hotelList.length; i += BATCH_SIZE) {
      batches.push(hotelList.slice(i, i + BATCH_SIZE));
    }

    console.log(`🏨 Step 2: Fetching offers in ${batches.length} batches...`);

    let allOffers = [];

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      const hotelIds = batch.map(h => h.hotelId).join(',');

      console.log(`🏨 Batch ${b + 1}/${batches.length} (${batch.length} hotels)...`);

      try {
        const offersResponse = await amadeus.shopping.hotelOffersSearch.get({
          hotelIds: hotelIds,
          checkInDate: parsed.checkIn,
          checkOutDate: parsed.checkOut,
          adults: adults,
          currency: parsed.currency,
        });

        const offers = offersResponse.data || [];
        allOffers = [...allOffers, ...offers];
      } catch (batchError) {
        // Log but continue with other batches
        console.log(`🏨 Batch ${b + 1} error: ${batchError.description?.[0]?.detail || batchError.message || 'unknown'}`);
      }
    }

    console.log(`🏨 Total hotel offers: ${allOffers.length}`);

    if (allOffers.length === 0) {
      return { error: `No available hotels found in ${parsed.location} for ${parsed.checkIn} to ${parsed.checkOut}` };
    }

    // Filter by price if budget specified
    if (parsed.maxPrice || parsed.minPrice) {
      allOffers = allOffers.filter(hotel => {
        const offer = hotel.offers?.[0];
        if (!offer) return false;
        const price = parseFloat(offer.price?.total || 0);
        // Price from Amadeus is total for the stay, calculate per-night
        const nights = Math.max(1, Math.round((new Date(parsed.checkOut) - new Date(parsed.checkIn)) / 86400000));
        const perNight = price / nights;
        if (parsed.maxPrice && perNight > parsed.maxPrice) return false;
        if (parsed.minPrice && perNight < parsed.minPrice) return false;
        return true;
      });
      console.log(`🏨 Hotels in budget: ${allOffers.length}`);
    }

    if (allOffers.length === 0) {
      let filterDesc = '';
      if (parsed.starRating) filterDesc += `${parsed.starRating}-star `;
      if (parsed.maxPrice) filterDesc += `under ${sym}${parsed.maxPrice}/night `;
      return { error: `No ${filterDesc}hotels found in ${parsed.location}` };
    }

    // Calculate number of nights
    const nights = Math.max(1, Math.round((new Date(parsed.checkOut) - new Date(parsed.checkIn)) / 86400000));

    // Process hotel data
    const hotels = allOffers.map((hotel, index) => {
      const offer = hotel.offers?.[0] || {};
      const totalPrice = parseFloat(offer.price?.total || 0);
      const perNight = Math.round(totalPrice / nights);
      const currencyCode = offer.price?.currency || parsed.currency;

      // Room info
      const room = offer.room || {};
      const roomType = room.typeEstimated?.category || room.description?.text || 'Standard Room';
      const bedType = room.typeEstimated?.bedType || null;
      const beds = room.typeEstimated?.beds || null;

      // Rating from hotel list lookup
      const hotelInfo = hotelList.find(h => h.hotelId === hotel.hotel?.hotelId);
      const rating = hotel.hotel?.rating || hotelInfo?.rating || null;

      // Cancellation policy
      const cancellation = offer.policies?.cancellations?.[0];
      let cancellationPolicy = null;
      if (cancellation) {
        if (cancellation.type === 'FULL_STAY') {
          cancellationPolicy = 'Non-refundable';
        } else if (cancellation.deadline) {
          cancellationPolicy = `Free cancellation before ${new Date(cancellation.deadline).toLocaleDateString('en-IN')}`;
        }
      }

      return {
        rank: index + 1,
        name: hotel.hotel?.name || 'Unknown Hotel',
        type: 'Hotel',
        stars: rating ? `${'⭐'.repeat(parseInt(rating))}` : null,
        starsNum: rating ? parseInt(rating) : null,
        rating: rating ? parseFloat(rating) : null,
        reviews: null,
        location: hotel.hotel?.cityCode || parsed.location,
        description: null,
        checkInTime: offer.checkInDate || null,
        checkOutTime: offer.checkOutDate || null,
        price: {
          perNight: perNight,
          perNightBeforeTax: 0,
          total: totalPrice,
          totalBeforeTax: parseFloat(offer.price?.base || 0),
          currency: currencyCode,
        },
        bookingSources: [],
        amenities: [],
        nearbyPlaces: [],
        roomType: roomType,
        bedType: bedType ? `${beds || ''} ${bedType}`.trim() : null,
        cancellationPolicy: cancellationPolicy,
        link: null,
      };
    });

    // Sort by price per night
    hotels.sort((a, b) => a.price.perNight - b.price.perNight);

    // Re-rank after sorting
    hotels.forEach((h, i) => { h.rank = i + 1; });

    return {
      success: true,
      search: {
        location: parsed.location,
        checkIn: parsed.checkIn,
        checkOut: parsed.checkOut,
        minPrice: parsed.minPrice,
        maxPrice: parsed.maxPrice,
        starRating: parsed.starRating,
        currency: parsed.currency,
      },
      hotels: hotels,
      totalFound: hotels.length,
    };

  } catch (error) {
    console.error('❌ Amadeus Hotels Error:', error.description || error.message);
    return { error: `Hotel search failed: ${error.description?.[0]?.detail || error.message}` };
  }
}

// Format a single hotel in detailed view
function formatHotelDetailed(h, sym) {
  const fmtPrice = (val) => {
    if (sym === '₹') return `${sym}${val.toLocaleString('en-IN')}`;
    return `${sym}${val.toLocaleString()}`;
  };

  let output = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `**${h.rank}. ${h.name}**`;
  if (h.stars) output += ` (${h.stars})`;
  output += `\n`;

  if (h.rating) {
    output += `⭐ ${h.rating}/5\n`;
  }

  if (h.location) {
    output += `📍 ${h.location}\n`;
  }

  // Price details
  if (h.price.perNight > 0) {
    output += `💰 **${fmtPrice(h.price.perNight)}**/night`;
    if (h.price.total > 0) {
      output += ` (Total: ${fmtPrice(h.price.total)})`;
    }
    output += `\n`;
  } else {
    output += `💰 Price not available\n`;
  }

  // Room info
  if (h.roomType) {
    output += `🛏️ Room: ${h.roomType}`;
    if (h.bedType) output += ` — ${h.bedType}`;
    output += `\n`;
  }

  // Cancellation policy
  if (h.cancellationPolicy) {
    output += `📋 ${h.cancellationPolicy}\n`;
  }

  output += `\n`;
  return output;
}

// Format a single hotel in compact view
function formatHotelCompact(h, sym) {
  const fmtPrice = (val) => {
    if (sym === '₹') return `${sym}${val.toLocaleString('en-IN')}`;
    return `${sym}${val.toLocaleString()}`;
  };

  let price = 'N/A';
  if (h.price.perNight > 0) {
    price = fmtPrice(h.price.perNight);
  }

  const rating = h.rating ? `⭐${h.rating}` : '';
  const stars = h.starsNum ? `${h.starsNum}-star` : '';
  const info = [stars, rating].filter(Boolean).join(' ');
  return `${h.rank}. **${h.name}** — ${price}/night ${info}\n`;
}

// Format results for display
function formatHotelResults(results) {
  if (results.error) {
    return `❌ ${results.error}`;
  }

  const { search, hotels, totalFound } = results;
  const sym = CURRENCY_SYMBOLS[search.currency] || search.currency;

  const fmtPrice = (val) => {
    if (sym === '₹') return `${sym}${val.toLocaleString('en-IN')}`;
    return `${sym}${val.toLocaleString()}`;
  };

  let output = `🏨 **Hotels in ${search.location}**\n`;
  output += `📅 ${search.checkIn} → ${search.checkOut}\n`;
  if (search.starRating) {
    output += `⭐ Filter: ${search.starRating}-star\n`;
  }
  if (search.maxPrice) {
    output += `💰 Budget: ${search.minPrice ? fmtPrice(search.minPrice) + ' - ' : 'Under '}${fmtPrice(search.maxPrice)}\n`;
  }
  output += `🔍 **${totalFound} hotels found** (Amadeus)\n\n`;

  // Show first 15 in detailed format
  const detailedCount = Math.min(15, hotels.length);
  for (let i = 0; i < detailedCount; i++) {
    output += formatHotelDetailed(hotels[i], sym);
  }

  // Show remaining hotels in compact format
  if (hotels.length > detailedCount) {
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    output += `📋 **More Hotels (${hotels.length - detailedCount} more):**\n\n`;
    for (let i = detailedCount; i < hotels.length; i++) {
      output += formatHotelCompact(hotels[i], sym);
    }
    output += `\n`;
  }

  // Summary
  const hotelsWithPrice = hotels.filter(h => h.price.perNight > 0);
  if (hotelsWithPrice.length > 0) {
    const sorted = [...hotelsWithPrice].sort((a, b) => a.price.perNight - b.price.perNight);
    const cheapest = sorted[0];
    const mostExpensive = sorted[sorted.length - 1];

    output += `📊 **Summary:**\n`;
    output += `• Total: ${totalFound} hotels\n`;
    output += `• Price range: ${fmtPrice(cheapest.price.perNight)} — ${fmtPrice(mostExpensive.price.perNight)}/night\n`;
    output += `• 💰 Cheapest: ${cheapest.name} at ${fmtPrice(cheapest.price.perNight)}/night\n`;
  }

  output += `\n🔗 **Book on:**\n`;
  output += `• [Google Hotels](https://www.google.com/travel/hotels/${encodeURIComponent(search.location)})\n`;
  output += `• [Booking.com](https://www.booking.com/searchresults.html?ss=${encodeURIComponent(search.location)})\n`;

  return output;
}

function init() {
  if (config.amadeus?.clientId && config.amadeus?.clientSecret) {
    amadeus = new Amadeus({
      clientId: config.amadeus.clientId,
      clientSecret: config.amadeus.clientSecret,
    });
    console.log('🏨 Amadeus: Hotel search enabled');
    return true;
  }
  console.log('⚠️ Amadeus: Hotel search not configured');
  return false;
}

module.exports = {
  init,
  searchHotels,
  formatHotelResults,
  parseHotelQuery,
  getMissingHotelInfo,
  buildHotelPrompt,
};
