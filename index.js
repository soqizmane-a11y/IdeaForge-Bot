require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');

// 1. ENVIRONMENT VARIABLES
const token = process.env.BOT_TOKEN;
const mongoUri = process.env.MONGODB_URI;
const adminId = process.env.ADMIN_ID;

if (!token || !mongoUri) {
  console.error('❌ FATAL ERROR: BOT_TOKEN or MONGODB_URI is missing.');
  process.exit(1);
}

// 2. MONGOOSE SCHEMA & MODEL
const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  firstName: String,
  username: String,
  savedIdeas: [String],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('IdeaForgeUser', userSchema);

// 3. DATABASE CONNECTION
mongoose.connect(mongoUri)
  .then(() => console.log('✅ Connected to MongoDB Atlas successfully.'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  });

// 4. TELEGRAM BOT INITIALIZATION
const bot = new TelegramBot(token, { polling: true });

bot.deleteWebHook()
  .then(() => console.log('✅ Webhook cleared. IdeaForge Bot active and listening...'))
  .catch(err => console.error('⚠️ Webhook delete error:', err.message));

// 5. COMPLETE IDEA DATABASE
const IDEAS = {
  business: [
    "🚀 AI-Powered Resume Tailor: A service that rewrites resumes for specific job descriptions.",
    "💼 Micro-SaaS for Freelancers: Auto-generate invoices and track delayed client payments.",
    "🌿 Local Plant Subscription: Monthly indoor plant deliveries with care guides.",
    "📦 Remote Work Onboarding Boxes: Custom welcome kits for distributed companies."
  ],
  app_bot: [
    "🤖 Telegram Crypto Portfolio Tracker with price alert notifications.",
    "📱 Group Expense Splitter Mini App directly inside Telegram chats.",
    "🎙️ Voice-to-Task Telegram Bot: Converts voice messages into structured To-Do lists.",
    "📚 Habit Stacking Bot: Tracks daily micro-habits with gamified streaks."
  ],
  youtube: [
    "🎥 'I Built a Business in 48 Hours with $0' Challenge.",
    "🎥 'Testing 5 Viral Telegram Bots So You Don't Have To'.",
    "🎥 'Day in the Life of a Solopreneur Building a SaaS'.",
    "🎥 Breakdown of Underrated Micro-Niches Making $10k/month."
  ],
  telegram_channel: [
    "📲 Daily Micro-SaaS Case Studies & Revenue Breakdowns.",
    "📲 AI Prompt Engineering Hacks for Designers & Writers.",
    "📲 Daily Curated Remote Jobs in Tech & Product.",
    "📲 No-Code Tool Reviews & Step-by-Step Tutorials."
  ],
  startup: [
    "📈 B2B Marketplace for Recycled Industrial Materials.",
    "📈 On-Demand Developer Code Review Platform.",
    "📈 Automated Social Proof Widget for E-commerce Websites.",
    "📈 AI-Generated Localized Ad Copy for Small Businesses."
  ],
  creative: [
    "🎨 Interactive Fiction Game played entirely via Telegram messages.",
    "🎨 Daily Sci-Fi Flash Fiction writing prompt community.",
    "🎨 Brand identity concept reimagining vintage logos as modern SaaS icons."
  ],
  side_hustle: [
    "💼 Curating and selling niche digital templates (Notion, Figma, Airtable).",
    "💼 Building custom Telegram bots for local business customer service.",
    "💼 Managing niche Pinterest accounts for affiliate marketing."
  ],
  daily: [
    "🧠 Brainstorm Rule: Take 2 unrelated products (e.g., Coffee + Podcasts) and merge them into a single service.",
    "🧠 Focus on Pain Points: Ask 3 business owners what task consumes most of their weekly time.",
    "🧠 Micro-SaaS Focus: Find a popular browser extension with 10k+ users and build a mobile/Telegram version."
  ]
};

// Temporary in-memory cache for generated ideas per chat (keeps callback_data under 64 bytes)
const userCurrentIdea = {};

// Helper: Get Random Idea
function getRandomIdea(category) {
  const list = IDEAS[category] || IDEAS.business;
  return list[Math.floor(Math.random() * list.length)];
}

// 6. MAIN MENU KEYBOARD
const MAIN_MENU = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '💡 Business Ideas', callback_data: 'cat_business' }, { text: '📱 App & Bot Ideas', callback_data: 'cat_app_bot' }],
      [{ text: '🎥 YouTube Ideas', callback_data: 'cat_youtube' }, { text: '📲 Telegram Channel Ideas', callback_data: 'cat_telegram_channel' }],
      [{ text: '📈 Startup Ideas', callback_data: 'cat_startup' }, { text: '🎨 Creative Projects', callback_data: 'cat_creative' }],
      [{ text: '💼 Side Hustles', callback_data: 'cat_side_hustle' }, { text: '🧠 Daily Inspiration', callback_data: 'cat_daily' }],
      [{ text: '⭐ Saved Ideas', callback_data: 'view_saved' }]
    ]
  }
};

// 7. COMMAND HANDLERS

// /start Command
bot.onText(/\/start/i, async (msg) => {
  const chatId = msg.chat.id;
  const { id, first_name, username } = msg.chat;

  try {
    let user = await User.findOne({ telegramId: id.toString() });
    if (!user) {
      await User.create({
        telegramId: id.toString(),
        firstName: first_name || 'Creator',
        username: username || ''
      });
    }

    const welcomeMsg = 
      `👋 *Welcome to IdeaForge Bot, ${first_name || 'Creator'}!*\n\n` +
      `Your personal AI-powered idea generator.\n\n` +
      `I can help you discover:\n` +
      `💡 Business Ideas\n` +
      `📱 App & Bot Ideas\n` +
      `🎥 YouTube Content Ideas\n` +
      `📲 Telegram Channel Ideas\n` +
      `📈 Startup Ideas\n` +
      `🎨 Creative Project Ideas\n` +
      `💼 Side Hustle Ideas\n` +
      `🧠 Daily Inspiration\n\n` +
      `*Tap a category below to generate ideas instantly!*`;

    await bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown', ...MAIN_MENU });
  } catch (err) {
    console.error('Error on /start:', err);
  }
});

// Inline Keyboard Button Click Handler
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  try {
    await bot.answerCallbackQuery(query.id);
  } catch (e) {}

  if (data.startsWith('cat_')) {
    const category = data.replace('cat_', '');
    const idea = getRandomIdea(category);

    // Save active idea in memory for short reference
    userCurrentIdea[chatId] = idea;

    const ideaKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Generate Another', callback_data: `cat_${category}` }],
          [{ text: '⭐ Save This Idea', callback_data: 'save_current' }],
          [{ text: '⬅️ Back to Main Menu', callback_data: 'main_menu' }]
        ]
      }
    };

    await bot.sendMessage(chatId, `✨ *Generated Idea:*\n\n${idea}`, { parse_mode: 'Markdown', ...ideaKeyboard });
  } 
  
  else if (data === 'save_current') {
    const currentIdea = userCurrentIdea[chatId];
    if (!currentIdea) {
      return bot.sendMessage(chatId, '⚠️ No active idea found to save. Generate a new one first!');
    }

    try {
      const user = await User.findOne({ telegramId: chatId.toString() });
      if (user) {
        if (!user.savedIdeas.includes(currentIdea)) {
          user.savedIdeas.push(currentIdea);
          await user.save();
          await bot.sendMessage(chatId, '✅ *Idea saved to your bookmarks!*', { parse_mode: 'Markdown' });
        } else {
          await bot.sendMessage(chatId, '⭐ *You already saved this idea.*', { parse_mode: 'Markdown' });
        }
      }
    } catch (err) {
      console.error('Save error:', err);
    }
  } 

  else if (data === 'view_saved') {
    try {
      const user = await User.findOne({ telegramId: chatId.toString() });
      if (!user || !user.savedIdeas.length) {
        return bot.sendMessage(chatId, '⭐ You have no saved ideas yet.\nGenerate an idea and tap "Save This Idea".');
      }

      let text = `⭐ *Your Saved Ideas:*\n\n`;
      user.savedIdeas.forEach((item, index) => {
        text += `${index + 1}. ${item}\n\n`;
      });

      await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Fetch saved error:', err);
    }
  } 

  else if (data === 'main_menu') {
    await bot.sendMessage(chatId, 'Choose a category to generate fresh ideas:', MAIN_MENU);
  }
});

// Admin Command: /broadcast <message>
bot.onText(/\/broadcast (.+)/i, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!adminId || chatId.toString() !== adminId.toString()) {
    return bot.sendMessage(chatId, '⛔ You are not authorized to perform admin broadcasts.');
  }

  const broadcastMsg = match[1];
  try {
    const users = await User.find({});
    let count = 0;

    for (const u of users) {
      try {
        await bot.sendMessage(u.telegramId, `📢 *IdeaForge Announcement:*\n\n${broadcastMsg}`, { parse_mode: 'Markdown' });
        count++;
      } catch (e) {}
    }

    bot.sendMessage(chatId, `✅ Broadcast sent to ${count} registered users.`);
  } catch (err) {
    console.error('Broadcast error:', err);
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error(`⚠️ Polling error [${error.code}]: ${error.message}`);
});

console.log('🚀 IdeaForge Bot actively running...');
