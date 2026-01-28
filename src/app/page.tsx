export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-8 text-gray-900 dark:text-white">
            Multi-Platform AI Agent
            <span className="block text-lg font-normal text-blue-600 dark:text-blue-400 mt-2">
              Telegram + WhatsApp • Powered by Vercel AI SDK
            </span>
          </h1>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white">
              Bot Status
            </h2>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-700 dark:text-gray-300">Telegram Bot: Active</span>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-700 dark:text-gray-300">WhatsApp Bot: Active via Twilio</span>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-gray-700 dark:text-gray-300">GPT-4o via Vercel AI: Connected</span>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="text-gray-700 dark:text-gray-300">Webhook Server: Running on Port 3001</span>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
                🤖 Your multi-platform agent is ready!
              </h3>
              <p className="text-blue-700 dark:text-blue-400 text-sm">
                Message your Telegram bot or WhatsApp number to start chatting. The agent will respond with AI-powered answers on both platforms.
              </p>
            </div>

            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
              <h4 className="font-medium text-gray-800 dark:text-gray-300 mb-2">
                💡 How to use:
              </h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• <strong>Telegram:</strong> Open Telegram and find your bot</li>
                <li>• <strong>WhatsApp:</strong> Message your Twilio WhatsApp number</li>
                <li>• Send any message or question on either platform</li>
                <li>• Get instant AI responses from GPT-4o</li>
                <li>• Stop the agent with Ctrl+C in terminal</li>
              </ul>
            </div>

            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-md">
              <h4 className="font-medium text-green-800 dark:text-green-300 mb-2">
                🚀 Quick Start
              </h4>
              <p className="text-green-700 dark:text-green-400 text-sm">
                Run <code className="bg-green-100 dark:bg-green-800 px-1 py-0.5 rounded">npm run bot</code> to start your multi-platform AI agent.
                Setup required: Telegram bot token, OpenAI API key, and Twilio credentials.
              </p>
            </div>

            <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-md">
              <h4 className="font-medium text-orange-800 dark:text-orange-300 mb-2">
                📡 WhatsApp Setup
              </h4>
              <p className="text-orange-700 dark:text-orange-400 text-sm">
                WhatsApp requires a public webhook URL. Use{' '}
                <a
                  href="https://ngrok.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-orange-600"
                >
                  ngrok
                </a>{' '}
                for local testing or deploy to get a public URL.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}