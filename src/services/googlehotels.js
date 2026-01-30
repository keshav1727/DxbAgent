const config = require('../config');

const SERPAPI_BASE = 'https://serpapi.com/search.json';

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

const GL_MAP = {
  'USD': 'us', 'EUR': 'de', 'GBP': 'uk', 'INR': 'in',
};

// Parse hotel query to extract location, check-in, check-out, budget, star rating, and currency
function parseHotelQuery(query) {
  const lower = query.toLowerCase();
  const today = new Date();

  // --- Extract currency ---
  let currency = 'INR'; // default
  // Check for explicit currency symbols/words before a number (e.g., "$150", "€200", "£100")
  const currencySymbolMatch = lower.match(/([$€£₹])\s*\d/);
  if (currencySymbolMatch) {
    currency = CURRENCY_MAP[currencySymbolMatch[1]] || 'INR';
  } else {
    // Check for currency words (e.g., "150 usd", "200 euros", "in gbp")
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
    // "budget hotel" (not "budget 5000") → 2-3 star
    starRating = 3; // use 3 as upper bound; we'll filter 2-3 client-side
  }

  // --- Extract budget/price range ---
  let maxPrice = null;
  let minPrice = null;

  // Match patterns like "under 10k", "below 5000", "under ₹8000", "under $150"
  const underMatch = lower.match(/(?:under|below|less than|max|upto|up to)\s*(?:[$€£₹]|rs\.?|inr|usd|eur|gbp)?\s*(\d+)\s*(k)?/i);
  if (underMatch) {
    maxPrice = parseInt(underMatch[1]);
    if (underMatch[2]) maxPrice *= 1000;
    if (currency === 'INR' && maxPrice < 500) maxPrice *= 1000; // "under 10" → "under 10k" only for INR
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

  // Check for "near airport" modifier
  const nearAirport = lower.includes('near airport') || lower.includes('airport area');

  // Clean location
  if (location) {
    location = location.replace(/\b(hotel|hotels|in|at|near|around|the|for|of|under|below|budget|from|to|per|day|night|star|luxury|\d)\b/gi, '').trim();
    if (nearAirport) {
      location += ' airport';
    }
  }

  // --- Extract dates ---
  let checkIn = new Date(today);
  checkIn.setDate(today.getDate() + 1); // Default: tomorrow

  let checkOut = new Date(checkIn);
  checkOut.setDate(checkIn.getDate() + 1); // Default: 1 night

  const monthMap = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
  };

  // Check for "from X to Y" date range
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
    // Single date
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

  // Relative dates
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

  // Check for "X nights" or "X days"
  const nightsMatch = lower.match(/(\d+)\s*(?:night|nights|day|days)/i);
  if (nightsMatch && !dateRangeMatch) {
    checkOut = new Date(checkIn);
    checkOut.setDate(checkIn.getDate() + parseInt(nightsMatch[1]));
  }

  // Format dates
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

// Check what info is missing from hotel query — location, dates, and budget are mandatory
function getMissingHotelInfo(query) {
  const lower = query.toLowerCase();
  const missing = [];

  const parsed = parseHotelQuery(query);
  if (!parsed.location) missing.push('location');

  // Check dates - was a date explicitly mentioned?
  const hasDate = lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) ||
    lower.includes('today') || lower.includes('tonight') || lower.includes('tomorrow');
  if (!hasDate) missing.push('dates');

  // Check budget
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

// Search hotels using SerpApi Google Hotels
async function searchHotels(query, adults = 2) {
  if (!config.serpapi?.apiKey) {
    return { error: 'SerpApi not configured. Add SERPAPI_KEY to .env.local' };
  }

  const parsed = parseHotelQuery(query);

  if (!parsed.location) {
    return { error: 'Could not find location. Use format: "hotels in [city]" or "[city] hotels"' };
  }

  const sym = CURRENCY_SYMBOLS[parsed.currency] || parsed.currency;

  console.log(`🏨 Google Hotels: ${parsed.location} (${parsed.checkIn} to ${parsed.checkOut}) [${parsed.currency}]`);
  if (parsed.maxPrice) {
    console.log(`   Budget: ${parsed.minPrice ? sym + parsed.minPrice + ' - ' : 'Under '}${sym}${parsed.maxPrice}`);
  }
  if (parsed.starRating) {
    console.log(`   Star filter: ${parsed.starRating}-star`);
  }

  try {
    const baseParams = {
      engine: 'google_hotels',
      q: parsed.location + ' hotels',
      check_in_date: parsed.checkIn,
      check_out_date: parsed.checkOut,
      currency: parsed.currency,
      hl: 'en',
      gl: GL_MAP[parsed.currency] || 'us',
      adults: adults.toString(),
      api_key: config.serpapi.apiKey,
    };

    // Use hotel_class filter when star rating is specified
    if (parsed.starRating) {
      baseParams.hotel_class = parsed.starRating.toString();
    }

    // Use price filters only when budget is given
    if (parsed.minPrice) {
      baseParams.min_price = parsed.minPrice;
    }
    if (parsed.maxPrice) {
      baseParams.max_price = parsed.maxPrice;
    }

    // Sort by lowest price only when budget is specified
    if (parsed.maxPrice || parsed.minPrice) {
      baseParams.sort_by = '3'; // lowest price
    }

    // Fetch first page
    const params = new URLSearchParams(baseParams);
    console.log(`🏨 API params: currency=${parsed.currency}, hotel_class=${parsed.starRating || 'any'}, min_price=${parsed.minPrice || 'none'}, max_price=${parsed.maxPrice || 'none'}`);
    const response = await fetch(`${SERPAPI_BASE}?${params}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SerpApi Hotels Error:', response.status, errorText);
      return { error: `Google Hotels API error: ${response.status}` };
    }

    const data = await response.json();

    if (data.error) {
      return { error: data.error };
    }

    let properties = data.properties || [];

    // Fetch additional pages (cap at 5 pages to stay responsive)
    const MAX_PAGES = 5;
    let nextPageToken = data.serpapi_pagination?.next_page_token;
    let pagesLoaded = 1;

    while (nextPageToken && pagesLoaded < MAX_PAGES) {
      console.log(`🏨 Fetching page ${pagesLoaded + 1}/${MAX_PAGES}...`);
      const nextParams = new URLSearchParams({
        ...baseParams,
        next_page_token: nextPageToken,
      });

      const nextResponse = await fetch(`${SERPAPI_BASE}?${nextParams}`);
      if (nextResponse.ok) {
        const nextData = await nextResponse.json();
        if (nextData.properties?.length > 0) {
          properties = [...properties, ...nextData.properties];
        }
        nextPageToken = nextData.serpapi_pagination?.next_page_token;
      } else {
        break;
      }
      pagesLoaded++;
    }

    console.log(`🏨 Total hotels fetched: ${properties.length} (${pagesLoaded} pages)`);

    if (properties.length === 0) {
      return { error: `No hotels found in ${parsed.location}` };
    }

    // Client-side star filter as safety net
    if (parsed.starRating) {
      properties = properties.filter(hotel => {
        const hotelStars = hotel.extracted_hotel_class || 0;
        if (hotelStars === 0) return true; // keep hotels without star info
        // For "budget" keyword (starRating=3), allow 2-3 star
        if (parsed.starRating === 3 && query.toLowerCase().includes('budget')) {
          return hotelStars >= 2 && hotelStars <= 3;
        }
        return hotelStars === parsed.starRating;
      });
      console.log(`🏨 Hotels after star filter: ${properties.length}`);
    }

    // Client-side price filter as safety net
    if (parsed.maxPrice || parsed.minPrice) {
      properties = properties.filter(hotel => {
        const price = hotel.rate_per_night?.extracted_lowest || hotel.rate_per_night?.lowest || 0;
        if (price === 0) return true; // Keep hotels without price info
        if (parsed.maxPrice && price > parsed.maxPrice) return false;
        if (parsed.minPrice && price < parsed.minPrice) return false;
        return true;
      });
      console.log(`🏨 Hotels in budget: ${properties.length}`);
    }

    if (properties.length === 0) {
      let filterDesc = '';
      if (parsed.starRating) filterDesc += `${parsed.starRating}-star `;
      if (parsed.maxPrice) filterDesc += `under ${sym}${parsed.maxPrice} `;
      return { error: `No ${filterDesc}hotels found in ${parsed.location}` };
    }

    // Fetch property details for ALL hotels in batches of 15
    const BATCH_SIZE = 15;
    const totalBatches = Math.ceil(properties.length / BATCH_SIZE);
    console.log(`🏨 Fetching booking prices for ALL ${properties.length} hotels in ${totalBatches} batches...`);

    const detailMap = new Map();

    for (let b = 0; b < totalBatches; b++) {
      const start = b * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, properties.length);
      const batch = properties.slice(start, end);
      console.log(`🏨 Batch ${b + 1}/${totalBatches} (${batch.length} hotels)...`);

      const detailPromises = batch.map(async (hotel) => {
        if (!hotel.property_token) return null;
        try {
          const detailParams = new URLSearchParams({
            engine: 'google_hotels',
            q: parsed.location + ' hotels',
            check_in_date: parsed.checkIn,
            check_out_date: parsed.checkOut,
            currency: parsed.currency,
            hl: 'en',
            gl: GL_MAP[parsed.currency] || 'us',
            adults: adults.toString(),
            property_token: hotel.property_token,
            api_key: config.serpapi.apiKey,
          });
          const res = await fetch(`${SERPAPI_BASE}?${detailParams}`);
          if (res.ok) {
            const detail = await res.json();
            return { token: hotel.property_token, prices: detail.prices || [] };
          }
        } catch (e) {
          // Ignore individual failures
        }
        return null;
      });

      const batchResults = await Promise.all(detailPromises);
      batchResults.forEach(d => {
        if (d && d.prices.length > 0) {
          detailMap.set(d.token, d.prices);
        }
      });
    }

    console.log(`🏨 Got booking prices for ${detailMap.size}/${properties.length} hotels`);

    // Process hotel data
    const hotels = properties.map((hotel, index) => {
      const pricePerNight = hotel.rate_per_night?.extracted_lowest || 0;
      const priceBeforeTax = hotel.rate_per_night?.extracted_before_taxes_fees || 0;
      const totalPrice = hotel.total_rate?.extracted_lowest || 0;
      const totalBeforeTax = hotel.total_rate?.extracted_before_taxes_fees || 0;

      // Get booking source prices and links from property details
      const bookingSources = [];
      const detailPrices = detailMap.get(hotel.property_token);
      if (detailPrices) {
        detailPrices.forEach(p => {
          if (p.rate_per_night?.extracted_lowest || p.extracted_price) {
            bookingSources.push({
              source: p.source || 'Unknown',
              perNight: p.rate_per_night?.extracted_lowest || p.extracted_price || 0,
              total: p.total_rate?.extracted_lowest || 0,
              link: p.link || null,
            });
          }
        });
        // Sort by price so cheapest is first
        bookingSources.sort((a, b) => a.perNight - b.perNight);
      }

      return {
        rank: index + 1,
        name: hotel.name || 'Unknown Hotel',
        type: hotel.type || 'Hotel',
        stars: hotel.hotel_class || null,
        starsNum: hotel.extracted_hotel_class || null,
        rating: hotel.overall_rating || null,
        reviews: hotel.reviews || null,
        location: hotel.location || hotel.neighborhood || null,
        description: hotel.description || null,
        checkInTime: hotel.check_in_time || null,
        checkOutTime: hotel.check_out_time || null,
        price: {
          perNight: pricePerNight,
          perNightBeforeTax: priceBeforeTax,
          total: totalPrice,
          totalBeforeTax: totalBeforeTax,
          currency: parsed.currency,
        },
        bookingSources,
        amenities: hotel.amenities || [],
        nearbyPlaces: hotel.nearby_places || [],
        link: hotel.link || null,
      };
    });

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
    console.error('❌ SerpApi Hotels Error:', error.message);
    return { error: `Hotel search failed: ${error.message}` };
  }
}

// Priority booking sources to show
const PRIORITY_SOURCES = ['booking.com', 'makemytrip', 'goibibo', 'agoda', 'cleartrip.com', 'easemytrip.com', 'trip.com', 'expedia.com', 'trivago.com', 'hotels.com'];

function getTopBookingSources(bookingSources, limit = 5) {
  if (!bookingSources || bookingSources.length === 0) return [];

  const sorted = [...bookingSources].sort((a, b) => {
    const aIdx = PRIORITY_SOURCES.findIndex(s => a.source.toLowerCase().includes(s));
    const bIdx = PRIORITY_SOURCES.findIndex(s => b.source.toLowerCase().includes(s));
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.perNight - b.perNight;
  });

  return sorted.slice(0, limit);
}

// Format a single hotel in detailed view (with currency symbol)
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
    output += `⭐ ${h.rating}/5`;
    if (h.reviews) output += ` (${h.reviews} reviews)`;
    output += `\n`;
  }

  if (h.location) {
    output += `📍 ${h.location}\n`;
  }

  // Price details
  if (h.price.perNight > 0) {
    output += `💰 **${fmtPrice(h.price.perNight)}**/night (lowest)`;
    if (h.price.perNightBeforeTax > 0 && h.price.perNightBeforeTax !== h.price.perNight) {
      output += ` (${fmtPrice(h.price.perNightBeforeTax)} + taxes)`;
    }
    output += `\n`;
  } else {
    output += `💰 Price not available\n`;
  }

  // Show booking source price comparison (sorted cheapest first)
  if (h.bookingSources && h.bookingSources.length > 0) {
    const cheapestPrice = h.bookingSources[0].perNight;
    output += `🔗 **Price comparison:**\n`;
    h.bookingSources.forEach((s, i) => {
      const tag = s.perNight === cheapestPrice ? ' ✅ CHEAPEST' : '';
      const link = s.link ? ` [Book](${s.link})` : '';
      output += `   ${s.source}: ${fmtPrice(s.perNight)}/night${tag}${link}\n`;
    });
  }

  // Check-in/out times
  if (h.checkInTime || h.checkOutTime) {
    output += `🕐 Check-in: ${h.checkInTime || 'N/A'} | Check-out: ${h.checkOutTime || 'N/A'}\n`;
  }

  // Amenities
  if (h.amenities && h.amenities.length > 0) {
    output += `🏷️ ${h.amenities.slice(0, 8).join(' • ')}\n`;
  }

  // Nearby places
  if (h.nearbyPlaces && h.nearbyPlaces.length > 0) {
    const places = h.nearbyPlaces.slice(0, 3).map(p => {
      const transport = p.transportations?.[0];
      return `${p.name}${transport ? ' (' + transport.duration + ')' : ''}`;
    });
    output += `📍 Nearby: ${places.join(' • ')}\n`;
  }

  if (h.description) {
    output += `📝 ${h.description.substring(0, 120)}${h.description.length > 120 ? '...' : ''}\n`;
  }

  output += `\n`;
  return output;
}

// Format a single hotel in compact view (one line) — shows cheapest booking source
function formatHotelCompact(h, sym) {
  const fmtPrice = (val) => {
    if (sym === '₹') return `${sym}${val.toLocaleString('en-IN')}`;
    return `${sym}${val.toLocaleString()}`;
  };

  let price = 'N/A';
  let bookLink = '';
  // Prefer cheapest booking source price (already sorted cheapest first)
  if (h.bookingSources && h.bookingSources.length > 0) {
    const cheapest = h.bookingSources[0];
    price = `${fmtPrice(cheapest.perNight)} via ${cheapest.source}`;
    if (cheapest.link) bookLink = ` [Book](${cheapest.link})`;
  } else if (h.price.perNight > 0) {
    price = fmtPrice(h.price.perNight);
  }

  const rating = h.rating ? `⭐${h.rating}` : '';
  const stars = h.starsNum ? `${h.starsNum}-star` : '';
  const info = [stars, rating].filter(Boolean).join(' ');
  return `${h.rank}. **${h.name}** — ${price}/night ${info}${bookLink}\n`;
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
  output += `🔍 **${totalFound} hotels found** (Google Hotels)\n\n`;

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
    const bestRated = hotels.filter(h => h.rating).reduce((max, h) => (h.rating || 0) > (max.rating || 0) ? h : max, hotels[0]);

    output += `📊 **Summary:**\n`;
    output += `• Total: ${totalFound} hotels\n`;
    output += `• Price range: ${fmtPrice(cheapest.price.perNight)} — ${fmtPrice(mostExpensive.price.perNight)}/night\n`;
    output += `• 💰 Cheapest: ${cheapest.name} at ${fmtPrice(cheapest.price.perNight)}/night\n`;
    if (bestRated && bestRated.rating) {
      output += `• ⭐ Best Rated: ${bestRated.name} (${bestRated.rating}/5)\n`;
    }
  }

  output += `\n🔗 **Book on:**\n`;
  output += `• [Google Hotels](https://www.google.com/travel/hotels/${encodeURIComponent(search.location)})\n`;
  output += `• [Booking.com](https://www.booking.com/searchresults.html?ss=${encodeURIComponent(search.location)})\n`;

  return output;
}

function init() {
  if (config.serpapi?.apiKey) {
    console.log('🏨 SerpApi: Google Hotels enabled');
    return true;
  }
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
