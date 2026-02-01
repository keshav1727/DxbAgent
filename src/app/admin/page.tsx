'use client';

import { useState, useEffect, useRef } from 'react';

interface UserSummary {
  chatId: string;
  platform: 'whatsapp' | 'telegram';
  userName: string;
  messageCount: number;
  lastMessageAt: string;
  lastMessage: string;
}

interface ChatMsg {
  _id: string;
  chatId: string;
  platform: string;
  userName: string;
  userMessage: string;
  botResponse: string;
  topic: string;
  timestamp: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString();
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'telegram') {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white text-sm font-bold">
        T
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white text-sm font-bold">
      W
    </span>
  );
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/chats');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUsers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function fetchMessages(chatId: string) {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setMessagesLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser);
    }
  }, [selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedUserInfo = users.find((u) => u.chatId === selectedUser);

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Chat History — Admin Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {users.length} user{users.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => {
              setLoading(true);
              fetchUsers();
              if (selectedUser) fetchMessages(selectedUser);
            }}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
          <a
            href="/"
            className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Home
          </a>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — User List */}
        <aside
          className={`${
            sidebarOpen ? 'block' : 'hidden'
          } lg:block w-full lg:w-80 xl:w-96 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto shrink-0`}
        >
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="text-gray-500 dark:text-gray-400">Loading...</div>
            </div>
          ) : error && users.length === 0 ? (
            <div className="p-4 text-red-500 text-sm">{error}</div>
          ) : users.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <p className="text-lg font-medium mb-1">No conversations yet</p>
              <p className="text-sm">Messages will appear here once users start chatting.</p>
            </div>
          ) : (
            <ul>
              {users.map((user) => (
                <li key={user.chatId}>
                  <button
                    onClick={() => {
                      setSelectedUser(user.chatId);
                      if (window.innerWidth < 1024) setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
                      selectedUser === user.chatId
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <PlatformIcon platform={user.platform} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {user.userName}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 shrink-0">
                            {timeAgo(user.lastMessageAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {user.lastMessage}
                          </span>
                          <span className="ml-2 shrink-0 text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full">
                            {user.messageCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Main — Conversation View */}
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
          {!selectedUser ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p className="text-lg">Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 shrink-0">
                <button
                  onClick={() => {
                    setSidebarOpen(true);
                    setSelectedUser(null);
                  }}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {selectedUserInfo && (
                  <>
                    <PlatformIcon platform={selectedUserInfo.platform} />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {selectedUserInfo.userName}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedUserInfo.platform === 'telegram' ? 'Telegram' : 'WhatsApp'} &middot;{' '}
                        {selectedUserInfo.messageCount} messages
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="text-gray-500 dark:text-gray-400">Loading messages...</div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg._id} className="space-y-2">
                      {/* User message */}
                      <div className="flex justify-end">
                        <div className="max-w-[75%]">
                          <div className="bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2 shadow-sm">
                            <p className="text-sm whitespace-pre-wrap">{msg.userMessage}</p>
                          </div>
                          <div className="text-xs text-gray-400 mt-1 text-right">
                            {formatTime(msg.timestamp)}
                          </div>
                        </div>
                      </div>
                      {/* Bot response */}
                      <div className="flex justify-start">
                        <div className="max-w-[75%]">
                          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl rounded-bl-md px-4 py-2 shadow-sm border border-gray-200 dark:border-gray-700">
                            <p className="text-sm whitespace-pre-wrap">{msg.botResponse}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400">{formatTime(msg.timestamp)}</span>
                            {msg.topic && msg.topic !== 'general' && (
                              <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                                {msg.topic}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
