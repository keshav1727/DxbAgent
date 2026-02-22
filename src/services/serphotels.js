const { getJson } = require('serpapi');
const config = require('../config');

const CURRENCY_MAP = {
  '$': 'USD', 'usd': 'USD', 'dollar': 'USD', 'dollars': 'USD',
  '€': 'EUR', 'eur': 'EUR', 'euro': 'EUR', 'euros': 'EUR',
  '£': 'GBP', 'gbp': 'GBP', 'pound': 'GBP', 'pounds': 'GBP',
  '₹': 'INR', 'inr': 'INR', 'rs': 'INR', 'rupee': 'INR', 'rupees': 'INR',
};

const CURRENCY_SYMBOLS = {
  'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹',
};

// Parse hotel query — same logic as before so ai.js flow is unchanged
function parseHotelQuery(query) {
  const lower = query.toLowerCase();
  const today = new Date();

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
    location = location.replace(/\b(hotel|hotels|in|at|near|around|the|for|of|under|below|budget|from|to|per|day|night|star|luxury|\d)\b/gi, '').trim();
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

// Check what info is missing before we can search
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

// Prompt asking for missing details
function buildHotelPrompt(missing) {
  let prompt = `🏨 I'll help you find hotels! Please share:\n\n`;
  if (missing.includes('location')) prompt += `📍 **Location:** Which city or area?\n`;
  if (missing.includes('dates')) prompt += `📅 **Dates:** Check-in and check-out dates?\n`;
  if (missing.includes('budget')) prompt += `💰 **Budget:** Max price per night? (e.g., under 5k, under $150)\n`;
  prompt += `\nExample: "hotels in paris from 5th feb to 8th feb under $200"`;
  return prompt;
}

// Search hotels using SerpAPI Google Hotels engine
async function searchHotels(query, adults = 2) {
  if (!config.serpapi?.apiKey) {
    return { error: 'SerpAPI not configured. Add SERPAPI_API_KEY to .env.local' };
  }

  const parsed = parseHotelQuery(query);

  if (!parsed.location) {
    return { error: 'Could not find location. Use format: "hotels in [city]"' };
  }

  const sym = CURRENCY_SYMBOLS[parsed.currency] || parsed.currency;
  console.log(`🏨 SerpAPI Hotels: ${parsed.location} | ${parsed.checkIn} → ${parsed.checkOut} | ${parsed.currency}`);
  if (parsed.maxPrice) {
    console.log(`   Budget: ${parsed.minPrice ? sym + parsed.minPrice + ' – ' : 'Under '}${sym}${parsed.maxPrice}`);
  }

  try {
    const params = {
      engine: 'google_hotels',
      api_key: config.serpapi.apiKey,
      q: `Hotels in ${parsed.location}`,
      check_in_date: parsed.checkIn,
      check_out_date: parsed.checkOut,
      adults: String(adults),
      currency: parsed.currency,
      hl: 'en',
      gl: 'us',
    };

    if (parsed.starRating) {
      // SerpAPI hotel_class filter: 2=2-star, 3=3-star, 4=4-star, 5=5-star
      params.hotel_class = String(parsed.starRating);
    }

    const data = await getJson(params);
    let properties = data.properties || [];

    if (properties.length === 0) {
      return { error: `No hotels found in ${parsed.location} for ${parsed.checkIn} to ${parsed.checkOut}` };
    }

    console.log(`🏨 Raw results: ${properties.length} hotels`);

    // Filter by budget (using lowest per-night rate)
    if (parsed.maxPrice || parsed.minPrice) {
      properties = properties.filter((p) => {
        const rate = p.prices?.[0]?.rate_per_night?.extracted_lowest;
        if (!rate) return true; // keep if no price info
        if (parsed.maxPrice && rate > parsed.maxPrice) return false;
        if (parsed.minPrice && rate < parsed.minPrice) return false;
        return true;
      });
      console.log(`🏨 After budget filter: ${properties.length} hotels`);
    }

    if (properties.length === 0) {
      return { error: `No hotels found in ${parsed.location} within budget ${parsed.maxPrice ? sym + parsed.maxPrice + '/night' : ''}` };
    }

    // Sort by price (cheapest first), then by rating for same price
    properties.sort((a, b) => {
      const priceA = a.prices?.[0]?.rate_per_night?.extracted_lowest || 999999;
      const priceB = b.prices?.[0]?.rate_per_night?.extracted_lowest || 999999;
      if (priceA !== priceB) return priceA - priceB;
      return (b.overall_rating || 0) - (a.overall_rating || 0);
    });

    const nights = Math.max(1, Math.round(
      (new Date(parsed.checkOut) - new Date(parsed.checkIn)) / 86400000
    ));

    const hotels = properties.slice(0, 20).map((p, index) => {
      const priceInfo = p.prices?.[0]?.rate_per_night || {};
      const perNight = priceInfo.extracted_lowest || 0;
      const perNightBeforeTax = priceInfo.extracted_before_taxes_fees || 0;
      const sources = (p.prices || []).map((pr) => ({
        name: pr.source || 'Unknown',
        price: pr.rate_per_night?.extracted_lowest || 0,
        link: pr.link || null,
      }));

      // Build booking link — prefer cheapest source link, else hotel direct link
      const bookingLink = sources[0]?.link || p.link || null;

      return {
        rank: index + 1,
        name: p.name || 'Unknown Hotel',
        type: p.type || 'Hotel',
        stars: p.extracted_hotel_class ? '⭐'.repeat(p.extracted_hotel_class) : null,
        starsNum: p.extracted_hotel_class || null,
        hotelClass: p.hotel_class || null,
        rating: p.overall_rating || null,
        reviews: p.reviews || null,
        location: p.neighborhood || parsed.location,
        description: p.description || null,
        checkInTime: p.check_in_time || null,
        checkOutTime: p.check_out_time || null,
        price: {
          perNight,
          perNightBeforeTax,
          total: perNight * nights,
          currency: parsed.currency,
        },
        bookingSources: sources,
        bookingLink,
        amenities: p.amenities || [],
        deal: p.deal || null,
        dealDescription: p.deal_description || null,
      };
    });

    return {
      success: true,
      search: {
        location: parsed.location,
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
    console.error('❌ SerpAPI Hotels Error:', error.message);
    return { error: `Hotel search failed: ${error.message}` };
  }
}

// Detailed card for each hotel
function formatHotelDetailed(h, sym) {
  const fmt = (val) => sym === '₹' ? `${sym}${val.toLocaleString('en-IN')}` : `${sym}${val.toLocaleString()}`;

  let output = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  output += `**${h.rank}. ${h.name}**`;
  if (h.hotelClass) output += ` (${h.hotelClass})`;
  output += `\n`;

  if (h.rating) output += `⭐ ${h.rating}/5`;
  if (h.reviews) output += ` (${h.reviews.toLocaleString()} reviews)`;
  if (h.rating || h.reviews) output += `\n`;

  if (h.location) output += `📍 ${h.location}\n`;

  if (h.price.perNight > 0) {
    output += `💰 **${fmt(h.price.perNight)}/night**`;
    if (h.price.perNightBeforeTax && h.price.perNightBeforeTax !== h.price.perNight) {
      output += ` (before tax: ${fmt(h.price.perNightBeforeTax)})`;
    }
    output += `\n`;
    if (h.price.total > 0) output += `🧾 Total stay: ${fmt(h.price.total)}\n`;
  } else {
    output += `💰 Price not available\n`;
  }

  if (h.deal) {
    output += `🏷️ Deal: ${h.deal}`;
    if (h.dealDescription) output += ` — ${h.dealDescription}`;
    output += `\n`;
  }

  if (h.amenities.length > 0) {
    output += `✅ Amenities: ${h.amenities.slice(0, 5).join(', ')}\n`;
  }

  if (h.bookingSources.length > 0) {
    const src = h.bookingSources[0];
    output += `🏬 Source: ${src.name}`;
    if (src.price > 0) output += ` — ${fmt(src.price)}/night`;
    output += `\n`;
  }

  if (h.bookingLink) {
    output += `🔗 [Book Now](${h.bookingLink})\n`;
  }

  output += `\n`;
  return output;
}

// Compact one-liner for overflow hotels
function formatHotelCompact(h, sym) {
  const fmt = (val) => sym === '₹' ? `${sym}${val.toLocaleString('en-IN')}` : `${sym}${val.toLocaleString()}`;
  const price = h.price.perNight > 0 ? fmt(h.price.perNight) : 'N/A';
  const rating = h.rating ? `⭐${h.rating}` : '';
  const cls = h.hotelClass || '';
  const info = [cls, rating].filter(Boolean).join(' ');
  const link = h.bookingLink ? ` — [Book](${h.bookingLink})` : '';
  return `${h.rank}. **${h.name}** — ${price}/night ${info}${link}\n`;
}

// Format full results for chat output
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
  output += `🔍 **${totalFound} hotels found** (Google Hotels via SerpAPI)\n\n`;

  const detailedCount = Math.min(10, hotels.length);
  for (let i = 0; i < detailedCount; i++) {
    output += formatHotelDetailed(hotels[i], sym);
  }

  if (hotels.length > detailedCount) {
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    output += `📋 **More options (${hotels.length - detailedCount} more):**\n\n`;
    for (let i = detailedCount; i < hotels.length; i++) {
      output += formatHotelCompact(hotels[i], sym);
    }
    output += `\n`;
  }

  const withPrice = hotels.filter((h) => h.price.perNight > 0);
  if (withPrice.length > 0) {
    const cheapest = withPrice[0];
    const priciest = withPrice[withPrice.length - 1];
    output += `📊 **Summary:**\n`;
    output += `• Total: ${totalFound} hotels\n`;
    output += `• Price range: ${fmt(cheapest.price.perNight)} – ${fmt(priciest.price.perNight)}/night\n`;
    output += `• 💰 Cheapest: ${cheapest.name} at ${fmt(cheapest.price.perNight)}/night`;
    if (cheapest.bookingLink) output += ` — [Book](${cheapest.bookingLink})`;
    output += `\n`;
  }

  return output;
}

function init() {
  if (config.serpapi?.apiKey) {
    console.log('🏨 SerpAPI: Hotel search enabled (Google Hotels)');
    return true;
  }
  console.log('⚠️ SerpAPI: Hotel search not configured (add SERPAPI_API_KEY)');
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
