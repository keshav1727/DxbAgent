// Conversation memory - stores messages per chat until topic changes
const conversations = new Map();
const topics = new Map();

function getConversation(chatId) {
  if (!conversations.has(chatId)) {
    conversations.set(chatId, []);
  }
  return conversations.get(chatId);
}

function addMessage(chatId, role, content) {
  const conversation = getConversation(chatId);
  conversation.push({ role, content });
}

function getMessages(chatId) {
  return getConversation(chatId);
}

function clearConversation(chatId) {
  conversations.set(chatId, []);
  topics.delete(chatId);
}

function setTopic(chatId, topic) {
  topics.set(chatId, topic);
}

function getTopic(chatId) {
  return topics.get(chatId);
}

// Detect topic from message
function detectTopic(text) {
  const lower = text.toLowerCase();

  if (lower.includes('flight') || lower.includes('fly') || lower.includes('airplane')) {
    return 'flight';
  }
  if (lower.includes('hotel') || lower.includes('stay') || lower.includes('accommodation') || lower.includes('resort') || lower.includes('room')) {
    return 'hotel';
  }
  if (lower.includes('visa') || lower.includes('passport') || lower.includes('immigration')) {
    return 'visa';
  }
  if (lower.includes('weather') || lower.includes('temperature') || lower.includes('forecast')) {
    return 'weather';
  }
  if (lower.includes('translate') || lower.includes('translation')) {
    return 'translation';
  }
  if (lower.includes('restaurant') || lower.includes('food') || lower.includes('eat')) {
    return 'food';
  }
  if (lower.includes('train') || lower.includes('bus') || lower.includes('metro')) {
    return 'transport';
  }

  return null; // No specific topic detected - continue with current
}

// Check if topic changed and clear if needed
function handleTopicChange(chatId, message) {
  const newTopic = detectTopic(message);
  const currentTopic = getTopic(chatId);

  // If a new specific topic is detected and it's different from current
  if (newTopic && newTopic !== currentTopic) {
    console.log(`🔄 Topic changed: ${currentTopic || 'none'} → ${newTopic}`);
    clearConversation(chatId);
    setTopic(chatId, newTopic);
    return true; // Topic changed
  }

  // If no topic set yet, set it
  if (!currentTopic && newTopic) {
    setTopic(chatId, newTopic);
  }

  return false; // Topic not changed
}

module.exports = {
  addMessage,
  getMessages,
  clearConversation,
  setTopic,
  getTopic,
  detectTopic,
  handleTopicChange
};
