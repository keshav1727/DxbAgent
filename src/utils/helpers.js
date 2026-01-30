// Split text into chunks for WhatsApp (max 1600 chars)
function splitMessage(text, maxLength = 1550) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks;
}

// Check if message needs real-time search
function needsSearch(text) {
  const lower = text.toLowerCase();
  const keywords = [
    'flight', 'flights', 'book flight', 'fly to',
    'visa', 'passport', 'travel requirements',
    'weather', 'temperature', 'forecast',
    'news', 'latest', 'current', 'today',
    'price', 'cost', 'how much',
    'where is', 'what is', 'who is', 'when is',
    'search', 'find', 'look up',
    'hotel', 'hotels', 'accommodation',
    'restaurant', 'food', 'places to eat',
    'train', 'bus', 'transport',
    'stock', 'crypto', 'bitcoin', 'market',
  ];

  // Also detect flight route patterns like "from X to Y"
  const flightRoutePattern = /from\s+\w+\s+to\s+\w+/i;
  if (flightRoutePattern.test(text)) {
    return true;
  }

  return keywords.some((k) => lower.includes(k));
}

// Check if message is a flight-related query
function isFlightQuery(text) {
  const lower = text.toLowerCase();

  // Direct flight keywords
  if (lower.includes('flight') || lower.includes('fly to') || lower.includes('airplane')) {
    return true;
  }

  // Route pattern: "from X to Y"
  const routePattern = /from\s+\w+\s+to\s+\w+/i;
  if (routePattern.test(text)) {
    return true;
  }

  return false;
}

module.exports = { splitMessage, needsSearch, isFlightQuery };
