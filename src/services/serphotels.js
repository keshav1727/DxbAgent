const axios = require('axios');
const config = require('../config');

const RAPIDAPI_HOST = 'booking-com15.p.rapidapi.com';

const CURRENCY_MAP = {
  '$': 'USD', 'usd': 'USD', 'dollar': 'USD', 'dollars': 'USD',
  '€': 'EUR', 'eur': 'EUR', 'euro': 'EUR', 'euros': 'EUR',
  '£': 'GBP', 'gbp': 'GBP', 'pound': 'GBP', 'pounds': 'GBP',
  '₹': 'INR', 'inr': 'INR', 'rs': 'INR', 'rupee': 'INR', 'rupees': 'INR',
};

const CURRENCY_SYMBOLS = {
  'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹',
};

function parseHotelQuery(query, messageTimestamp = Date.now()) {
  const lower = query.toLowerCase();
  const today = new Date(messageTimestamp);

  // Currency
  let currency = 'INR';
  const currencySymbolMatch = lower.match(/([$€£₹])\s*\d/);
  if (currencySymbolMatch) {
    currency = CURRENCY_MAP[currencySymbolMatch[1]] || 'INR';
  } else {
    for (const [key, val] of Object.entries(CURRENCY_MAP)) {
      if (key.length >= 3 && lower.includes(key)) { currency = val; break; }
    }
  }

  // Star rating
  let starRating = null;
  const starMatch = lower.match(/(\d)\s*[-\s]?\s*star/i);
  if (starMatch) { const s = parseInt(starMatch[1]); if (s >= 1 && s <= 5) starRating = s; }
  if (!starRating && lower.includes('luxury')) starRating = 5;
  if (!starRating && /\bbudget\b/.test(lower) && !lower.match(/budget\s*(?:₹|rs|inr|\$|€|£|\d)/i)) starRating = 3;

  // Budget
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

  // Location
  let location = null;
  const locationPatterns = [
    /(?:hotels?\s+(?:in|at|near|around|for|of)\s+)([a-z\s]+?)(?:\s+(?:under|below|from|budget|price|near|airport|\d))/i,
    /(?:hotels?\s+(?:in|at|near|around|for|of)\s+)([a-z\s]+)/i,
    /(?:(?:in|at|near|for)\s+)([a-z\s]+?)(?:\s+(?:hotel|under|below|from|budget|\d))/i,
    /([a-z\s]+?)\s+hotels?/i,
  ];
  for (const pattern of locationPatterns) {
    const match = lower.match(pattern);
    if (match) { location = match[1].trim(); break; }
  }

  const nearAirport = lower.includes('near airport') || lower.includes('airport area');
  if (location) {
    location = location.replace(/\b(hotel|hotels|in|at|near|around|the|for|of|under|below|budget|from|to|per|day|night|star|luxury|today|tonight|tomorrow|\d)\b/gi, '').trim();
    if (nearAirport) location += ' airport';
  }

  // Dates
  const monthMap = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
  };

  let checkIn = new Date(today);
  checkIn.setDate(today.getDate() + 1);
  let checkOut = new Date(checkIn);
  checkOut.setDate(checkIn.getDate() + 1);

  const dateRangeMatch = lower.match(
    /(?:from\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s*(\d{4}))?\s+(?:to|till|until|-)\s*(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s*(\d{4}))?/i
  );
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
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return { location, checkIn: formatDate(checkIn), checkOut: formatDate(checkOut), minPrice, maxPrice, nearAirport, starRating, currency };
}

function getMissingHotelInfo(query) {
  const lower = query.toLowerCase();
  const missing = [];
  const parsed = parseHotelQuery(query);

  if (!parsed.location) missing.push('location');

  const hasDate =
    lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) ||
    lower.includes('today') || lower.includes('tonight') || lower.includes('tomorrow');
  if (!hasDate) missing.push('dates');

  const hasBudget =
    lower.match(/(?:under|below|less than|max|upto|up to)\s*(?:[$€£₹]|rs\.?|inr|usd|eur|gbp)?\s*\d/i) ||
    lower.match(/\d+\s*k?\s*(?:-|to)\s*\d+/i);
  if (!hasBudget) missing.push('budget');

  return { parsed, missing };
}

function buildHotelPrompt(missing) {
  let prompt = `🏨 I'll help you find hotels on Booking.com! Please share:\n\n`;
  if (missing.includes('location')) prompt += `📍 **Location:** Which city or area?\n`;
  if (missing.includes('dates')) prompt += `📅 **Dates:** Check-in and check-out dates?\n`;
  if (missing.includes('budget')) prompt += `💰 **Budget:** Max price per night? (e.g., under 5k, under $150)\n`;
  prompt += `\nExample: "hotels in paris from 5th feb to 8th feb under $200"`;
  return prompt;
}

// Resolve destination to Booking.com dest_id + dest_type
async function resolveDestination(location, apiKey) {
  const res = await axios.get(`https://${RAPIDAPI_HOST}/api/v1/hotels/searchDestination`, {
    params: { query: location },
    headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': RAPIDAPI_HOST },
  });
  const results = res.data?.data || [];
  // Prefer city, then district, then any
  const city = results.find(r => r.search_type === 'city')
    || results.find(r => r.search_type === 'district')
    || results[0];
  return city ? { dest_id: city.dest_id, dest_type: city.search_type || 'city', label: city.city_name || city.label || location } : null;
}

// Build Booking.com direct URL for a hotel
function buildHotelUrl(hotelId, checkIn, checkOut, adults) {
  return `https://www.booking.com/hotel/in/id${hotelId}.html?checkin=${checkIn}&checkout=${checkOut}&group_adults=${adults}&no_rooms=1&lang=en-gb&currency_code=INR`;
}

// Search hotels using Booking.com API via RapidAPI
async function searchHotels(query, adults = 2, messageTimestamp = Date.now()) {
  const apiKey = config.rapidapi?.apiKey;
  if (!apiKey) {
    return { error: 'Booking.com API not configured. Add RAPIDAPI_KEY to .env.local' };
  }

  const parsed = parseHotelQuery(query, messageTimestamp);

  if (!parsed.location) {
    return { error: 'Could not find location. Use format: "hotels in [city]"' };
  }

  const sym = CURRENCY_SYMBOLS[parsed.currency] || parsed.currency;
  console.log(`🏨 Booking.com: ${parsed.location} | ${parsed.checkIn} → ${parsed.checkOut} | ${parsed.currency}`);

  try {
    // Step 1: resolve destination
    const dest = await resolveDestination(parsed.location, apiKey);
    if (!dest) {
      return { error: `Could not find "${parsed.location}" on Booking.com` };
    }
    console.log(`🏨 Destination: ${dest.label} (id: ${dest.dest_id}, type: ${dest.dest_type})`);

    // Step 2: search hotels
    const params = {
      dest_id: dest.dest_id,
      search_type: dest.dest_type,
      arrival_date: parsed.checkIn,
      departure_date: parsed.checkOut,
      adults: String(adults),
      room_qty: '1',
      languagecode: 'en-us',
      currency_code: parsed.currency,
      page_number: '1',
    };

    if (parsed.starRating) {
      params.categories_filter = `class::${parsed.starRating}`;
    }

    if (parsed.maxPrice) {
      params.price_filter_currency = parsed.currency;
      params.price_max = String(parsed.maxPrice);
      if (parsed.minPrice) params.price_min = String(parsed.minPrice);
    }

    const res = await axios.get(`https://${RAPIDAPI_HOST}/api/v1/hotels/searchHotels`, {
      params,
      headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': RAPIDAPI_HOST },
    });

    let properties = res.data?.data?.hotels || [];
    console.log(`🏨 Booking.com results: ${properties.length} hotels`);

    if (properties.length === 0) {
      return { error: `No hotels found in ${parsed.location} for ${parsed.checkIn} to ${parsed.checkOut}` };
    }

    // Filter by budget if not sent as API param (fallback)
    if (parsed.maxPrice) {
      properties = properties.filter(p => {
        const price = p.min_total_price || p.price_breakdown?.gross_price;
        if (!price) return true;
        return price <= parsed.maxPrice;
      });
    }

    if (properties.length === 0) {
      return { error: `No hotels found in ${parsed.location} within budget ${sym}${parsed.maxPrice}/night` };
    }

    const nights = Math.max(1, Math.round(
      (new Date(parsed.checkOut) - new Date(parsed.checkIn)) / 86400000
    ));

    const hotels = properties.slice(0, 15).map((p, index) => {
      const property = p.property || p;
      const priceInfo = p.priceBreakdown || {};
      const grossPrice = priceInfo.grossPrice?.value || property.priceBreakdown?.grossPrice?.value || 0;
      const totalPrice = Math.round(grossPrice);
      const perNight = nights > 0 ? Math.round(totalPrice / nights) : totalPrice;
      const hotelId = property.id || p.hotel_id;
      const bookingLink = property.wishlistName
        ? `https://www.booking.com/hotel/${hotelId}.html?checkin=${parsed.checkIn}&checkout=${parsed.checkOut}&group_adults=${adults}&no_rooms=1&currency_code=INR`
        : buildHotelUrl(hotelId, parsed.checkIn, parsed.checkOut, adults);

      const reviewScore = property.reviewScore?.score || property.review_score;
      const reviewCount = property.reviewScore?.reviewCount || property.review_nr;

      return {
        rank: index + 1,
        name: property.name || p.hotel_name || 'Unknown Hotel',
        hotelClass: property.propertyClass ? `${property.propertyClass}-star hotel` : (p.class ? `${p.class}-star hotel` : null),
        starsNum: property.propertyClass || p.class || null,
        rating: reviewScore ? parseFloat(reviewScore).toFixed(1) : null,
        ratingWord: property.reviewScore?.translateScore || p.review_score_word || null,
        reviews: reviewCount || null,
        location: property.wishlistName || p.address || parsed.location,
        city: parsed.location,
        freeCancellation: priceInfo.excludedPrice != null || p.is_free_cancellable === 1,
        breakfastIncluded: p.has_free_breakfast === 1,
        price: {
          perNight,
          total: totalPrice,
          currency: parsed.currency,
        },
        bookingLink: buildHotelUrl(hotelId, parsed.checkIn, parsed.checkOut, adults),
        amenities: [],
      };
    });

    return {
      success: true,
      search: {
        location: dest.label || parsed.location,
        checkIn: parsed.checkIn,
        checkOut: parsed.checkOut,
        nights,
        minPrice: parsed.minPrice,
        maxPrice: parsed.maxPrice,
        starRating: parsed.starRating,
        currency: parsed.currency,
      },
      hotels,
      totalFound: hotels.length,
    };
  } catch (error) {
    console.error('❌ Booking.com API Error:', error.response?.data || error.message);
    const msg = error.response?.data?.message || error.message;
    return { error: `Booking.com search failed: ${msg}` };
  }
}

function formatHotelResults(results) {
  if (results.error) return `❌ ${results.error}`;

  const { search, hotels, totalFound } = results;
  const sym = CURRENCY_SYMBOLS[search.currency] || search.currency;
  const fmt = (val) => sym === '₹' ? `${sym}${val.toLocaleString('en-IN')}` : `${sym}${val.toLocaleString()}`;

  let output = `🏨 **Hotels in ${search.location}**\n`;
  output += `📅 ${search.checkIn} → ${search.checkOut} (${search.nights} night${search.nights > 1 ? 's' : ''})\n`;
  if (search.starRating) output += `⭐ Filter: ${search.starRating}-star\n`;
  if (search.maxPrice) {
    output += `💰 Budget: ${search.minPrice ? fmt(search.minPrice) + ' – ' : 'Under '}${fmt(search.maxPrice)}/night\n`;
  }
  output += `🔍 **${totalFound} hotels found on Booking.com**\n\n`;

  hotels.forEach(h => {
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    output += `**${h.rank}. ${h.name}**`;
    if (h.hotelClass) output += ` (${h.hotelClass})`;
    output += `\n`;

    if (h.rating) {
      output += `⭐ ${h.rating}/10`;
      if (h.ratingWord) output += ` · ${h.ratingWord}`;
      if (h.reviews) output += ` (${h.reviews.toLocaleString()} reviews)`;
      output += `\n`;
    }

    if (h.location) output += `📍 ${h.location}\n`;

    if (h.price.perNight > 0) {
      output += `💰 **${fmt(h.price.perNight)}/night**`;
      if (h.price.total > 0 && search.nights > 1) output += ` · Total: ${fmt(h.price.total)}`;
      output += `\n`;
    } else {
      output += `💰 Price not available\n`;
    }

    const badges = [];
    if (h.freeCancellation) badges.push('✅ Free cancellation');
    if (h.breakfastIncluded) badges.push('🍳 Breakfast included');
    if (badges.length) output += `${badges.join(' · ')}\n`;

    output += `🔗 [Book on Booking.com](${h.bookingLink})\n\n`;
  });

  const withPrice = hotels.filter(h => h.price.perNight > 0);
  if (withPrice.length > 0) {
    const cheapest = withPrice.reduce((a, b) => a.price.perNight < b.price.perNight ? a : b);
    const topRated = hotels.filter(h => h.rating).reduce((a, b) => parseFloat(a.rating) > parseFloat(b.rating) ? a : b, hotels[0]);
    output += `📊 **Quick Summary:**\n`;
    output += `• 💰 Cheapest: ${cheapest.name} — ${fmt(cheapest.price.perNight)}/night\n`;
    if (topRated?.rating) output += `• 🏆 Top rated: ${topRated.name} — ${topRated.rating}/10\n`;
  }

  return output;
}

function init() {
  if (config.rapidapi?.apiKey) {
    console.log('🏨 Booking.com: Hotel search enabled (RapidAPI)');
    return true;
  }
  console.log('⚠️ Booking.com: Not configured (add RAPIDAPI_KEY to .env.local)');
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
