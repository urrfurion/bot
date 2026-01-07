// ==========================================
// CONFIGURATION & SETUP
// ==========================================

const { Telegraf, Scenes, session, Markup } = require('telegraf');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// Initialize bot
const token = "8157925136:AAFPNIG6ipDPyAnwqc9cgIvBa2pcqVDfrW8";
const bot = new Telegraf(token);

// MongoDB connection
const mongoUri = "mongodb+srv://sandip102938:Q1g2Fbn7ewNqEvuK@test.ebvv4hf.mongodb.net/telegram_bot?retryWrites=true&w=majority";
let db;

async function connectDB() {
    try {
        const client = new MongoClient(mongoUri);
        await client.connect();
        db = client.db();
        console.log('✅ Connected to MongoDB');
        return true;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        return false;
    }
}

// Simple scene setup (without complex scenes for now)
const stage = new Scenes.Stage([]);
bot.use(session());
bot.use(stage.middleware());

// 🔐 ADMIN CONFIGURATION
const ADMIN_IDS = [8435248854, 7823816525];

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Check Admin Status
async function isAdmin(userId) {
    try {
        const userIdNum = Number(userId);
        
        // Check hardcoded admin IDs first
        if (ADMIN_IDS.includes(userIdNum)) {
            console.log(`✅ User ${userIdNum} is admin (hardcoded)`);
            return true;
        }
        
        // Check database
        const config = await db.collection('admin').findOne({ type: 'config' });
        if (config && config.admins) {
            const isDbAdmin = config.admins.some(id => String(id) === String(userId));
            console.log(`📊 User ${userId} is admin in DB: ${isDbAdmin}`);
            return isDbAdmin;
        }
        
        console.log(`❌ User ${userId} is NOT admin`);
        return false;
    } catch (e) {
        console.error("Admin check error:", e);
        return false;
    }
}

// ==========================================
// BASIC COMMANDS
// ==========================================

bot.start(async (ctx) => {
    console.log(`Start command from: ${ctx.from.id} (${ctx.from.username})`);
    await ctx.reply("👋 Welcome to the Bot! Use /help to see commands.");
});

bot.command('help', async (ctx) => {
    await ctx.reply(
        "🤖 *Bot Commands*\n\n" +
        "`/start` - Start the bot\n" +
        "`/adminpanel` - Admin panel\n" +
        "`/debug` - Debug info\n" +
        "`/test` - Test command\n" +
        "`/ping` - Check if bot is alive\n\n" +
        "👑 *Admin Only*\n" +
        "`/stats` - User statistics\n" +
        "`/broadcast` - Broadcast message",
        { parse_mode: 'Markdown' }
    );
});

bot.command('test', async (ctx) => {
    await ctx.reply(`✅ Bot is working! Your ID: ${ctx.from.id}`);
});

bot.command('ping', async (ctx) => {
    await ctx.reply('🏓 Pong!');
});

// ==========================================
// DEBUG COMMAND
// ==========================================

bot.command('debug', async (ctx) => {
    const userId = ctx.from.id;
    const isAdminUser = await isAdmin(userId);
    
    let dbInfo = "❌ Could not connect to DB";
    try {
        const config = await db.collection('admin').findOne({ type: 'config' });
        dbInfo = config ? "✅ DB Connected" : "❌ No config found";
    } catch (e) {
        dbInfo = `❌ DB Error: ${e.message}`;
    }
    
    await ctx.reply(
        `🔍 *Debug Information*\n\n` +
        `👤 Your ID: \`${userId}\`\n` +
        `👤 Username: @${ctx.from.username || 'none'}\n` +
        `👑 Is Admin: ${isAdminUser ? '✅ YES' : '❌ NO'}\n` +
        `📋 Hardcoded Admins: ${ADMIN_IDS.join(', ')}\n` +
        `🗃️ Database: ${dbInfo}\n` +
        `🤖 Bot Status: ✅ Running`,
        { parse_mode: 'Markdown' }
    );
    
    console.log(`Debug command from ${userId} - Admin: ${isAdminUser}`);
});

// ==========================================
// ADMIN PANEL - SIMPLE VERSION
// ==========================================

bot.command('adminpanel', async (ctx) => {
    console.log(`Adminpanel command from: ${ctx.from.id}`);
    
    const isAdminUser = await isAdmin(ctx.from.id);
    
    if (!isAdminUser) {
        console.log(`❌ Access denied for ${ctx.from.id}`);
        await ctx.reply("❌ You are not authorized to access admin panel.");
        return;
    }
    
    console.log(`✅ Showing admin panel to ${ctx.from.id}`);
    
    try {
        const text = "👮‍♂️ *Admin Control Panel*\n\nSelect an option below:";
        const keyboard = [
            [{ text: '📢 Broadcast', callback_data: 'admin_broadcast' }],
            [{ text: '👥 User Stats', callback_data: 'admin_userdata' }],
            [{ text: '📺 Manage Channels', callback_data: 'admin_channels' }],
            [{ text: '📱 Manage Apps', callback_data: 'admin_apps' }],
            [{ text: '⚙️ Settings', callback_data: 'admin_settings' }],
            [{ text: '🗑️ Delete Data', callback_data: 'admin_delete' }]
        ];
        
        await ctx.replyWithMarkdown(text, { 
            reply_markup: { inline_keyboard: keyboard } 
        });
        
        console.log(`✅ Admin panel sent to ${ctx.from.id}`);
    } catch (error) {
        console.error("Error sending admin panel:", error);
        await ctx.reply("❌ Error showing admin panel. Check logs.");
    }
});

// Also handle "admin" as text
bot.hears('admin', async (ctx) => {
    const isAdminUser = await isAdmin(ctx.from.id);
    
    if (!isAdminUser) {
        await ctx.reply("❌ You are not authorized.");
        return;
    }
    
    const text = "👮‍♂️ *Admin Panel*\n\nUse /adminpanel for full admin interface.";
    await ctx.replyWithMarkdown(text);
});

// Handle callback queries for admin panel
bot.action('admin_broadcast', async (ctx) => {
    const isAdminUser = await isAdmin(ctx.from.id);
    if (!isAdminUser) {
        await ctx.answerCbQuery('❌ Not authorized');
        return;
    }
    
    await ctx.answerCbQuery();
    await ctx.reply("📢 Broadcast feature coming soon!");
});

bot.action('admin_userdata', async (ctx) => {
    const isAdminUser = await isAdmin(ctx.from.id);
    if (!isAdminUser) {
        await ctx.answerCbQuery('❌ Not authorized');
        return;
    }
    
    await ctx.answerCbQuery();
    
    try {
        const users = await db.collection('info').find({}).toArray();
        const total = users.length;
        const joined = users.filter(u => u.joinedAll).length;
        
        await ctx.reply(
            `👥 *User Statistics*\n\n` +
            `📊 Total Users: ${total}\n` +
            `✅ Verified Users: ${joined}\n` +
            `❌ Unverified: ${total - joined}`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        await ctx.reply("❌ Error fetching user data");
    }
});

bot.action('admin_channels', async (ctx) => {
    const isAdminUser = await isAdmin(ctx.from.id);
    if (!isAdminUser) {
        await ctx.answerCbQuery('❌ Not authorized');
        return;
    }
    
    await ctx.answerCbQuery();
    await ctx.reply("📺 Channel management coming soon!");
});

bot.action('admin_apps', async (ctx) => {
    const isAdminUser = await isAdmin(ctx.from.id);
    if (!isAdminUser) {
        await ctx.answerCbQuery('❌ Not authorized');
        return;
    }
    
    await ctx.answerCbQuery();
    await ctx.reply("📱 App management coming soon!");
});

bot.action('admin_settings', async (ctx) => {
    const isAdminUser = await isAdmin(ctx.from.id);
    if (!isAdminUser) {
        await ctx.answerCbQuery('❌ Not authorized');
        return;
    }
    
    await ctx.answerCbQuery();
    await ctx.reply("⚙️ Settings management coming soon!");
});

bot.action('admin_delete', async (ctx) => {
    const isAdminUser = await isAdmin(ctx.from.id);
    if (!isAdminUser) {
        await ctx.answerCbQuery('❌ Not authorized');
        return;
    }
    
    await ctx.answerCbQuery();
    await ctx.reply("🗑️ Data deletion coming soon!");
});

// Back button
bot.action('admin_back', async (ctx) => {
    await ctx.editMessageText("👮‍♂️ *Admin Panel*\n\nUse /adminpanel for options.", {
        parse_mode: 'Markdown'
    });
});

// ==========================================
// ADMIN STATS COMMAND
// ==========================================

bot.command('stats', async (ctx) => {
    const isAdminUser = await isAdmin(ctx.from.id);
    
    if (!isAdminUser) {
        await ctx.reply("❌ Admin only command.");
        return;
    }
    
    try {
        const users = await db.collection('info').find({}).toArray();
        const total = users.length;
        
        await ctx.reply(
            `📊 *Bot Statistics*\n\n` +
            `👥 Total Users: ${total}\n` +
            `🤖 Bot Status: ✅ Running\n` +
            `🗃️ DB: ✅ Connected\n` +
            `👑 Admins: ${ADMIN_IDS.length}`,
            { parse_mode: 'Markdown' }
        );
    } catch (e) {
        await ctx.reply("❌ Error fetching stats: " + e.message);
    }
});

// ==========================================
// ERROR HANDLING
// ==========================================

bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err);
    ctx.reply("❌ An error occurred. Please try again.");
});

// ==========================================
// START BOT
// ==========================================

async function startBot() {
    console.log("🚀 Starting bot...");
    
    try {
        // Connect to MongoDB
        const dbConnected = await connectDB();
        if (!dbConnected) {
            console.log("⚠️ Starting without MongoDB connection");
        }
        
        // Initialize database if connected
        if (db) {
            try {
                await db.collection('admin').updateOne(
                    { type: 'config' },
                    { 
                        $setOnInsert: { 
                            type: 'config',
                            admins: ADMIN_IDS,
                            channels: [],
                            apps: []
                        }
                    },
                    { upsert: true }
                );
                console.log(`✅ Bot initialized with ${ADMIN_IDS.length} admins`);
            } catch (e) {
                console.error("❌ Error initializing bot:", e);
            }
        }
        
        // Start bot
        await bot.launch();
        console.log('🤖 Bot is running...');
        
        // Enable graceful stop
        process.once('SIGINT', () => {
            console.log('🛑 Stopping bot...');
            bot.stop('SIGINT');
        });
        process.once('SIGTERM', () => {
            console.log('🛑 Stopping bot...');
            bot.stop('SIGTERM');
        });
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

// Railway deployment setup
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV === 'production') {
    const express = require('express');
    const app = express();
    
    app.get('/', (req, res) => {
        res.send('Telegram Bot is running!');
    });
    
    app.listen(PORT, () => {
        console.log(`🌐 Web server running on port ${PORT}`);
        startBot();
    });
} else {
    startBot();
}

console.log("📦 Bot package loaded successfully!");
