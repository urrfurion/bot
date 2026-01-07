// ==========================================
// TELEGRAM BOT - COMPLETE SOLUTION
// ==========================================
// Features: Channel Verification, Code Generation, Admin Panel, Cloudinary
// Deployment: Railway Ready
// ==========================================

const { Telegraf, Scenes, session, Markup } = require('telegraf');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

// Cloudinary configuration
cloudinary.config({
  cloud_name: 'dneusgyzc',
  api_key: '474713292161728',
  api_secret: 'DHJmvD784FEVmeOt1-K8XeNhCQQ'
});

// Initialize bot
const bot = new Telegraf(process.env.BOT_TOKEN || '8157925136:AAFPNIG6ipDPyAnwqc9cgIvBa2pcqVDfrW8');

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://sandip102938:Q1g2Fbn7ewNqEvuK@test.ebvv4hf.mongodb.net/telegram_bot';
let db;

async function connectDB() {
    try {
        const client = new MongoClient(mongoUri);
        await client.connect();
        db = client.db();
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
}

// Initialize scenes and session
const stage = new Scenes.Stage([]);
bot.use(session());
bot.use(stage.middleware());

// Scene handler factory
function createScene(sceneId) {
    return new Scenes.BaseScene(sceneId);
}

// SCENE DEFINITIONS
const scenes = {
    broadcast: createScene('broadcast_scene'),
    
    // Channel scenes
    addChannelName: createScene('add_chan_name_scene'),
    addChannelId: createScene('add_chan_id_scene'),
    editChannelName: createScene('edit_chan_name_scene'),
    editChannelId: createScene('edit_chan_id_scene'),
    
    // App scenes
    addAppName: createScene('add_app_name_scene'),
    addAppImage: createScene('add_app_image_scene'),
    addAppCodeCount: createScene('add_app_code_count_scene'),
    addAppCodePrefixes: createScene('add_app_code_prefixes_scene'),
    addAppCodeLengths: createScene('add_app_code_lengths_scene'),
    addAppCodeMessage: createScene('add_app_code_message_scene'),
    
    // Edit scenes
    editAppName: createScene('edit_app_name_scene'),
    editAppImage: createScene('edit_app_image_scene'),
    editAppCodeMessage: createScene('edit_app_code_message_scene'),
    
    // Image and message scenes
    editStartImage: createScene('edit_start_image_scene'),
    editStartMessage: createScene('edit_start_message_scene'),
    editMenuImage: createScene('edit_menu_image_scene'),
    editMenuMessage: createScene('edit_menu_message_scene'),
    
    // Timer scene
    editTimer: createScene('edit_timer_scene'),
    
    // Admin scenes
    addAdmin: createScene('add_admin_scene')
};

// Register all scenes
Object.values(scenes).forEach(scene => stage.register(scene));

// 🔐 ADMIN CONFIGURATION
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(Number) : [8435248854, 7478663641];

// Default configurations
const DEFAULT_CONFIG = {
    startImage: 'https://res.cloudinary.com/dneusgyzc/image/upload/l_text:Stalinist%20One_140_bold:{name},co_rgb:00e5ff,g_center/fl_preserve_transparency/v1763670359/1000106281_cfg1ke.jpg',
    startMessage: '👋 *Welcome! We are Premium Agents.*\n\n⚠️ _Access Denied_\nTo access our exclusive agent list, you must join our affiliate channels below:',
    menuImage: 'https://res.cloudinary.com/dneusgyzc/image/upload/l_text:Stalinist%20One_140_bold:{name},co_rgb:00e5ff,g_center/fl_preserve_transparency/v1763670359/1000106281_cfg1ke.jpg',
    menuMessage: '🎉 *Welcome to the Agent Panel!*\n\n✅ _Verification Successful_\nSelect an app below to generate codes:',
    codeTimer: 7200 // 2 hours in seconds
};

// Admin Panel Website
const ADMIN_PANEL_URL = 'https://web-production-89e02.up.railway.app';

// ==========================================
// DATABASE INITIALIZATION
// ==========================================

async function initBot() {
    try {
        // Initialize DB config with defaults
        await db.collection('admin').updateOne(
            { type: 'config' },
            { 
                $set: { 
                    type: 'config',
                    admins: ADMIN_IDS,
                    startImage: DEFAULT_CONFIG.startImage,
                    startMessage: DEFAULT_CONFIG.startMessage,
                    menuImage: DEFAULT_CONFIG.menuImage,
                    menuMessage: DEFAULT_CONFIG.menuMessage,
                    codeTimer: DEFAULT_CONFIG.codeTimer
                },
                $setOnInsert: {
                    channels: [],
                    apps: [],
                    createdAt: new Date()
                }
            },
            { upsert: true }
        );
        console.log(`✅ Bot initialized. Admins loaded: ${ADMIN_IDS.length}`);
    } catch (e) {
        console.error("❌ Error initializing bot:", e);
    }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Notify ALL Admins
async function notifyAdmin(text) {
    const config = await db.collection('admin').findOne({ type: 'config' });
    const allAdmins = config?.admins || ADMIN_IDS;
    
    for (const adminId of allAdmins) {
        try {
            await bot.telegram.sendMessage(adminId, text, { parse_mode: 'Markdown' });
        } catch (e) {
            console.error(`Failed to notify admin ${adminId}`, e.message);
        }
    }
}

// Smart Name Logic
function getSmartName(user) {
    let firstName = user.first_name || "";
    let username = user.username || "";
    let lastName = user.last_name || "";
    
    // Clean names
    const cleanFirstName = firstName.replace(/[^a-zA-Z0-9 ]/g, "").trim();
    const cleanUsername = username.replace(/[^a-zA-Z0-9 ]/g, "").trim();
    const cleanLastName = lastName.replace(/[^a-zA-Z0-9 ]/g, "").trim();
    
    let finalName = "Agent";
    
    // Priority: first name (if <= 8 chars) > username > first name > last name
    if (cleanFirstName && cleanFirstName.length <= 8) {
        finalName = cleanFirstName;
    } else if (cleanUsername && (cleanUsername.length < cleanFirstName.length || !cleanFirstName)) {
        finalName = cleanUsername;
    } else if (cleanFirstName) {
        finalName = cleanFirstName;
    } else if (cleanLastName) {
        finalName = cleanLastName;
    } else if (cleanUsername) {
        finalName = cleanUsername;
    }
    
    // Truncate if too long
    if (finalName.length > 10) {
        return finalName.substring(0, 9) + "...";
    }
    return finalName;
}

// Check Admin Status
async function isAdmin(userId) {
    try {
        const config = await db.collection('admin').findOne({ type: 'config' });
        const allAdmins = config?.admins || ADMIN_IDS;
        return allAdmins.some(id => String(id) === String(userId));
    } catch (e) {
        console.error("Error checking admin:", e);
        return ADMIN_IDS.includes(Number(userId));
    }
}

// Get Unjoined Channels
async function getUnjoinedChannels(userId) {
    const config = await db.collection('admin').findOne({ type: 'config' });
    if (!config || !config.channels || config.channels.length === 0) return [];
    
    const unjoined = [];
    
    for (const channel of config.channels) {
        try {
            const member = await bot.telegram.getChatMember(channel.id, userId);
            const status = member.status;
            if (status === 'left' || status === 'kicked') {
                unjoined.push(channel);
            }
        } catch (e) {
            console.error(`Error checking channel ${channel.id}:`, e.message);
            unjoined.push(channel);
        }
    }
    
    return unjoined;
}

// Generate Random Code
function generateCode(prefix = "", length = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = prefix;
    
    for (let i = code.length; i < length; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return code;
}

// Format Time Remaining
function formatTimeRemaining(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours}h ${minutes}m ${secs}s`;
}

// Replace Variables in Text
function replaceVariables(text, variables) {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{${key}}`, 'gi');
        result = result.replace(regex, value || '');
    }
    return result;
}

// Get User Variables
function getUserVariables(user) {
    const smartName = getSmartName(user);
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    
    return {
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        full_name: fullName || '',
        username: user.username ? `@${user.username}` : '',
        name: smartName
    };
}

// Upload to Cloudinary
async function uploadToCloudinary(fileBuffer, folder = 'bot_images') {
    try {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { folder: folder },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            ).end(fileBuffer);
        });
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
}

// ==========================================
// USER FLOW - START COMMAND
// ==========================================

bot.start(async (ctx) => {
    try {
        const user = ctx.from;
        const userId = user.id;
        
        // Check if user exists
        const existingUser = await db.collection('users').findOne({ userId });
        
        if (!existingUser) {
            // New user - add to database
            await db.collection('users').insertOne({
                userId,
                firstName: user.first_name,
                lastName: user.last_name,
                username: user.username,
                joinedAll: false,
                joinedAt: new Date(),
                lastActive: new Date(),
                codeTimestamps: {}
            });
            
            // Notify admins
            const userLink = user.username ? `@${user.username}` : user.first_name || 'Unknown';
            await notifyAdmin(`🆕 *New User Joined*\nID: \`${userId}\`\nUser: ${userLink}`);
        } else {
            // Update last active
            await db.collection('users').updateOne(
                { userId },
                { 
                    $set: { 
                        firstName: user.first_name,
                        lastName: user.last_name,
                        username: user.username,
                        lastActive: new Date()
                    }
                }
            );
        }
        
        await showStartScreen(ctx);
    } catch (error) {
        console.error("Start command error:", error);
        await ctx.reply("❌ An error occurred. Please try again.");
    }
});

// Show Start Screen
async function showStartScreen(ctx) {
    try {
        const user = ctx.from;
        const userId = user.id;
        
        // Get unjoined channels
        const unjoinedChannels = await getUnjoinedChannels(userId);
        
        // Get configuration
        const config = await db.collection('admin').findOne({ type: 'config' });
        
        // Prepare user variables
        const userVars = getUserVariables(user);
        
        // Prepare image URL
        const startImage = config?.startImage || DEFAULT_CONFIG.startImage;
        const imageUrl = replaceVariables(startImage, userVars);
        
        // Prepare message
        let startMessage = config?.startMessage || DEFAULT_CONFIG.startMessage;
        startMessage = replaceVariables(startMessage, userVars);
        
        // Check if user is admin for admin panel button
        const isUserAdmin = await isAdmin(userId);
        
        // If user hasn't joined all channels
        if (unjoinedChannels.length > 0) {
            await db.collection('users').updateOne(
                { userId },
                { $set: { joinedAll: false } }
            );
            
            // Create channel buttons
            const buttons = unjoinedChannels.map(channel => {
                const buttonText = channel.buttonLabel || `Join ${channel.title}`;
                return [{ text: buttonText, url: channel.link }];
            });
            
            // Add verify button
            buttons.push([{ text: '✅ Check Joined', callback_data: 'check_joined' }]);
            
            // Add admin panel button if user is admin
            if (isUserAdmin) {
                buttons.push([{ text: '👑 Admin Panel', url: ADMIN_PANEL_URL }]);
            }
            
            // Send message with photo
            await ctx.replyWithPhoto(imageUrl, {
                caption: startMessage,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons }
            });
            return;
        }
        
        // User has joined all channels
        const userData = await db.collection('users').findOne({ userId });
        
        if (!userData?.joinedAll) {
            await db.collection('users').updateOne(
                { userId },
                { $set: { joinedAll: true } }
            );
            
            // Notify admins
            const userLink = user.username ? `@${user.username}` : user.first_name || 'Unknown';
            await notifyAdmin(`✅ *User Joined All Channels*\nID: \`${userId}\`\nUser: ${userLink}`);
        }
        
        // Show main menu
        await showMainMenu(ctx);
    } catch (error) {
        console.error("Show start screen error:", error);
        await ctx.reply("❌ An error occurred. Please try again.");
    }
}

// Show Main Menu
async function showMainMenu(ctx) {
    try {
        const user = ctx.from;
        const userId = user.id;
        
        // Get configuration
        const config = await db.collection('admin').findOne({ type: 'config' });
        const apps = config?.apps || [];
        
        // Prepare user variables
        const userVars = getUserVariables(user);
        
        // Prepare image URL
        const menuImage = config?.menuImage || DEFAULT_CONFIG.menuImage;
        const imageUrl = replaceVariables(menuImage, userVars);
        
        // Prepare message
        let menuMessage = config?.menuMessage || DEFAULT_CONFIG.menuMessage;
        menuMessage = replaceVariables(menuMessage, userVars);
        
        // Create app buttons
        const keyboard = [];
        
        if (apps.length === 0) {
            keyboard.push([{ text: 'Coming Soon...', callback_data: 'no_apps' }]);
        } else {
            apps.forEach(app => {
                keyboard.push([{ text: app.name, callback_data: `app_${app.id}` }]);
            });
        }
        
        // Add admin panel button if user is admin
        const isUserAdmin = await isAdmin(userId);
        if (isUserAdmin) {
            keyboard.push([{ text: '👑 Admin Panel', url: ADMIN_PANEL_URL }]);
        }
        
        // Add back button
        keyboard.push([{ text: '🔙 Back', callback_data: 'back_to_start' }]);
        
        await ctx.replyWithPhoto(imageUrl, {
            caption: menuMessage,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    } catch (error) {
        console.error("Show main menu error:", error);
        await ctx.reply("❌ An error occurred. Please try again.");
    }
}

// Check Joined Channels
bot.action('check_joined', async (ctx) => {
    try {
        await ctx.deleteMessage();
        await showStartScreen(ctx);
    } catch (error) {
        console.error("Check joined error:", error);
    }
});

// Back to Start
bot.action('back_to_start', async (ctx) => {
    try {
        await ctx.deleteMessage();
        await showStartScreen(ctx);
    } catch (error) {
        console.error("Back to start error:", error);
    }
});

// No Apps Available
bot.action('no_apps', async (ctx) => {
    await ctx.answerCbQuery("No apps available yet. Please check back later.");
});

// ==========================================
// APP CODE GENERATION
// ==========================================

bot.action(/^app_(.+)$/, async (ctx) => {
    try {
        await ctx.deleteMessage();
        
        const appId = ctx.match[1];
        const userId = ctx.from.id;
        
        // Get app details
        const config = await db.collection('admin').findOne({ type: 'config' });
        const app = config?.apps?.find(a => a.id === appId);
        
        if (!app) {
            await ctx.reply("❌ App not found. Please try again.");
            return;
        }
        
        // Get user data
        const userData = await db.collection('users').findOne({ userId });
        const codeTimer = config?.codeTimer || DEFAULT_CONFIG.codeTimer;
        
        // Check cooldown
        const lastGenerated = userData?.codeTimestamps?.[appId];
        const now = Math.floor(Date.now() / 1000);
        
        if (lastGenerated && (now - lastGenerated) < codeTimer) {
            const remaining = codeTimer - (now - lastGenerated);
            const timeStr = formatTimeRemaining(remaining);
            
            await ctx.reply(
                `⏰ *Please Wait*\n\nYou can generate new codes for *${app.name}* in:\n\`${timeStr}\``,
                { parse_mode: 'Markdown' }
            );
            
            // Show back button
            await ctx.reply("🔙 Back to Menu", {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔙 Back', callback_data: 'back_to_menu' }
                    ]]
                }
            });
            return;
        }
        
        // Generate codes
        const codes = [];
        for (let i = 0; i < app.codeCount; i++) {
            const prefix = app.codePrefixes[i] || '';
            const length = app.codeLengths[i] || 8;
            codes.push(generateCode(prefix, length));
        }
        
        // Prepare variables
        const userVars = getUserVariables(ctx.from);
        const appVars = {
            app_name: app.name,
            button_name: app.name
        };
        
        // Add code variables
        codes.forEach((code, index) => {
            appVars[`code${index + 1}`] = code;
        });
        
        // Replace variables in message
        let message = app.codeMessage;
        message = replaceVariables(message, userVars);
        message = replaceVariables(message, appVars);
        
        // Send app image if available
        if (app.image && app.image !== 'none') {
            await ctx.replyWithPhoto(app.image, {
                caption: message,
                parse_mode: 'Markdown'
            });
        } else {
            await ctx.reply(message, { parse_mode: 'Markdown' });
        }
        
        // Update user's cooldown
        await db.collection('users').updateOne(
            { userId },
            { $set: { [`codeTimestamps.${appId}`]: now } }
        );
        
        // Show back button
        await ctx.reply("🔙 Back to Menu", {
            reply_markup: {
                inline_keyboard: [[
                    { text: '🔙 Back', callback_data: 'back_to_menu' }
                ]]
            }
        });
        
    } catch (error) {
        console.error("App selection error:", error);
        await ctx.reply("❌ An error occurred. Please try again.");
    }
});

// Back to Menu
bot.action('back_to_menu', async (ctx) => {
    try {
        await ctx.deleteMessage();
        await showMainMenu(ctx);
    } catch (error) {
        console.error("Back to menu error:", error);
    }
});

// ==========================================
// 🛡️ ADMIN PANEL
// ==========================================

bot.command('admin', async (ctx) => {
    if (!await isAdmin(ctx.from.id)) {
        return ctx.reply("❌ You are not authorized to use this command.");
    }
    
    await showAdminPanel(ctx);
});

async function showAdminPanel(ctx) {
    const text = "👮‍♂️ *Admin Control Panel*\n\nSelect an option below:";
    const keyboard = [
        [{ text: '📢 Broadcast', callback_data: 'admin_broadcast' }],
        [{ text: '👥 User Stats', callback_data: 'admin_userstats' }],
        [{ text: '🖼️ Start Image', callback_data: 'admin_startimage' }],
        [{ text: '📝 Start Message', callback_data: 'admin_startmessage' }],
        [{ text: '🖼️ Menu Image', callback_data: 'admin_menuimage' }],
        [{ text: '📝 Menu Message', callback_data: 'admin_menumessage' }],
        [{ text: '⏰ Code Timer', callback_data: 'admin_timer' }],
        [{ text: '📺 Manage Channels', callback_data: 'admin_channels' }],
        [{ text: '📱 Manage Apps', callback_data: 'admin_apps' }],
        [{ text: '👑 Manage Admins', callback_data: 'admin_manage_admins' }],
        [{ text: '🌐 Admin Website', url: ADMIN_PANEL_URL }],
        [{ text: '🗑️ Delete Data', callback_data: 'admin_deletedata' }]
    ];
    
    if (ctx.callbackQuery) {
        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    } else {
        await ctx.reply(text, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        });
    }
}

// Back to Admin Panel
bot.action('admin_back', async (ctx) => {
    await showAdminPanel(ctx);
});

// ==========================================
// ADMIN FEATURES
// ==========================================

// 1. BROADCAST
bot.action('admin_broadcast', async (ctx) => {
    if (!await isAdmin(ctx.from.id)) return;
    
    const text = "📢 *Broadcast Message*\n\nSend the message you want to broadcast to all users.\n\n*Types supported:*\n• Text\n• Photo with caption\n• Document\n\nType 'cancel' to cancel.";
    
    await ctx.editMessageText(text, { parse_mode: 'Markdown' });
    await ctx.scene.enter('broadcast_scene');
});

scenes.broadcast.on('message', async (ctx) => {
    if (ctx.message.text?.toLowerCase() === 'cancel') {
        await ctx.reply("❌ Broadcast cancelled.");
        await ctx.scene.leave();
        await showAdminPanel(ctx);
        return;
    }
    
    const users = await db.collection('users').find({}).toArray();
    const totalUsers = users.length;
    let successful = 0;
    let failed = 0;
    
    await ctx.reply(`🚀 Broadcasting to ${totalUsers} users...`);
    
    for (const user of users) {
        try {
            if (ctx.message.photo) {
                // Send photo
                await ctx.telegram.sendPhoto(
                    user.userId,
                    ctx.message.photo[ctx.message.photo.length - 1].file_id,
                    {
                        caption: ctx.message.caption,
                        parse_mode: 'Markdown'
                    }
                );
            } else if (ctx.message.document) {
                // Send document
                await ctx.telegram.sendDocument(
                    user.userId,
                    ctx.message.document.file_id,
                    {
                        caption: ctx.message.caption,
                        parse_mode: 'Markdown'
                    }
                );
            } else if (ctx.message.text) {
                // Send text
                await ctx.telegram.sendMessage(
                    user.userId,
                    ctx.message.text,
                    { parse_mode: 'Markdown' }
                );
            }
            
            successful++;
            await new Promise(resolve => setTimeout(resolve, 50)); // Rate limiting
        } catch (error) {
            failed++;
            console.error(`Failed to send to user ${user.userId}:`, error.message);
        }
    }
    
    await ctx.reply(
        `✅ *Broadcast Complete*\n\n📊 Statistics:\n• Total: ${totalUsers}\n• ✅ Successful: ${successful}\n• ❌ Failed: ${failed}`,
        { parse_mode: 'Markdown' }
    );
    
    await ctx.scene.leave();
    await showAdminPanel(ctx);
});

// 2. USER STATS
bot.action('admin_userstats', async (ctx) => {
    if (!await isAdmin(ctx.from.id)) return;
    
    const users = await db.collection('users').find({}).toArray();
    const totalUsers = users.length;
    const verifiedUsers = users.filter(u => u.joinedAll).length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeToday = users.filter(u => u.lastActive >= today).length;
    
    let recentUsersText = "";
    const recentUsers = users
        .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt))
        .slice(0, 5);
    
    recentUsers.forEach((user, index) => {
        const username = user.username ? `@${user.username}` : user.firstName || 'Unknown';
        const status = user.joinedAll ? '✅' : '❌';
        const userLink = `[${username}](tg://user?id=${user.userId})`;
        recentUsersText += `${index + 1}. ${userLink} ${status}\n`;
    });
    
    const text = `📊 *User Statistics*\n\n` +
                 `• Total Users: ${totalUsers}\n` +
                 `• Verified Users: ${verifiedUsers}\n` +
                 `• Active Today: ${activeToday}\n\n` +
                 `👥 *Recent Users (5)*:\n${recentUsersText}`;
    
    const keyboard = [[{ text: '🔙 Back', callback_data: 'admin_back' }]];
    
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
});

// 3. START IMAGE MANAGEMENT
bot.action('admin_startimage', async (ctx) => {
    if (!await isAdmin(ctx.from.id)) return;
    
    const config = await db.collection('admin').findOne({ type: 'config' });
    const currentImage = config?.startImage || DEFAULT_CONFIG.startImage;
    
    const text = `🖼️ *Start Image Management*\n\nCurrent Image URL:\n\`${currentImage}\`\n\n*Available variables:* \`{name}\`\n\nSelect an option:`;
    
    const keyboard = [
        [{ text: '✏️ Edit Image URL', callback_data: 'admin_edit_startimage' }],
        [{ text: '📤 Upload New Image', callback_data: 'admin_upload_startimage' }],
        [{ text: '🔄 Reset to Default', callback_data: 'admin_reset_startimage' }],
        [{ text: '🔙 Back', callback_data: 'admin_back' }]
    ];
    
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
});

bot.action('admin_edit_startimage', async (ctx) => {
    await ctx.reply("Enter the new image URL (supports {name} variable):\n\nType 'cancel' to cancel.");
    await ctx.scene.enter('edit_start_image_scene');
});

scenes.editStartImage.on('text', async (ctx) => {
    if (ctx.message.text.toLowerCase() === 'cancel') {
        await ctx.reply("❌ Edit cancelled.");
        await ctx.scene.leave();
        await showAdminPanel(ctx);
        return;
    }
    
    const newUrl = ctx.message.text.trim();
    
    // Basic URL validation
    if (!newUrl.startsWith('http')) {
        await ctx.reply("❌ Invalid URL. Must start with http:// or https://");
        return;
    }
    
    await db.collection('admin').updateOne(
        { type: 'config' },
        { $set: { startImage: newUrl } }
    );
    
    await ctx.reply("✅ Start image updated successfully!");
    await ctx.scene.leave();
    await showAdminPanel(ctx);
});

bot.action('admin_upload_startimage', async (ctx) => {
    await ctx.reply("Please send the image you want to upload.\n\nType 'cancel' to cancel.");
    await ctx.scene.enter('edit_start_image_scene');
});

scenes.editStartImage.on('photo', async (ctx) => {
    try {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const fileLink = await ctx.telegram.getFileLink(photo.file_id);
        const response = await fetch(fileLink);
        const buffer = await response.arrayBuffer();
        
        // Upload to Cloudinary
        const result = await uploadToCloudinary(Buffer.from(buffer), 'start_images');
        
        // Add {name} variable to URL
        const cloudinaryUrl = result.secure_url.replace('/upload/', '/upload/l_text:Stalinist%20One_140_bold:{name},co_rgb:00e5ff,g_center/');
        
        await db.collection('admin').updateOne(
            { type: 'config' },
            { $set: { startImage: cloudinaryUrl } }
        );
        
        await ctx.reply("✅ Image uploaded to Cloudinary and set as start image!");
        await ctx.scene.leave();
        await showAdminPanel(ctx);
    } catch (error) {
        console.error("Upload error:", error);
        await ctx.reply("❌ Failed to upload image. Please try again.");
        await ctx.scene.leave();
    }
});

bot.action('admin_reset_startimage', async (ctx) => {
    await db.collection('admin').updateOne(
        { type: 'config' },
        { $set: { startImage: DEFAULT_CONFIG.startImage } }
    );
    
    await ctx.answerCbQuery("✅ Start image reset to default");
    await showAdminPanel(ctx);
});

// 4. START MESSAGE MANAGEMENT
bot.action('admin_startmessage', async (ctx) => {
    if (!await isAdmin(ctx.from.id)) return;
    
    const config = await db.collection('admin').findOne({ type: 'config' });
    const currentMessage = config?.startMessage || DEFAULT_CONFIG.startMessage;
    
    const text = `📝 *Start Message Management*\n\nCurrent Message:\n\`\`\`\n${currentMessage}\n\`\`\`\n\n*Available variables:* \`{first_name}\`, \`{last_name}\`, \`{full_name}\`, \`{username}\`, \`{name}\`\n\nSelect an option:`;
    
    const keyboard = [
        [{ text: '✏️ Edit Message', callback_data: 'admin_edit_startmessage' }],
        [{ text: '🔄 Reset to Default', callback_data: 'admin_reset_startmessage' }],
        [{ text: '🔙 Back', callback_data: 'admin_back' }]
    ];
    
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
});

bot.action('admin_edit_startmessage', async (ctx) => {
    await ctx.reply("Enter the new start message:\n\nType 'cancel' to cancel.");
    await ctx.scene.enter('edit_start_message_scene');
});

scenes.editStartMessage.on('text', async (ctx) => {
    if (ctx.message.text.toLowerCase() === 'cancel') {
        await ctx.reply("❌ Edit cancelled.");
        await ctx.scene.leave();
        await showAdminPanel(ctx);
        return;
    }
    
    const newMessage = ctx.message.text;
    
    await db.collection('admin').updateOne(
        { type: 'config' },
        { $set: { startMessage: newMessage } }
    );
    
    await ctx.reply("✅ Start message updated successfully!");
    await ctx.scene.leave();
    await showAdminPanel(ctx);
});

bot.action('admin_reset_startmessage', async (ctx) => {
    await db.collection('admin').updateOne(
        { type: 'config' },
        { $set: { startMessage: DEFAULT_CONFIG.startMessage } }
    );
    
    await ctx.answerCbQuery("✅ Start message reset to default");
    await showAdminPanel(ctx);
});

// 5. MENU IMAGE MANAGEMENT (Similar to start image)
bot.action('admin_menuimage', async (ctx) => {
    if (!await isAdmin(ctx.from.id)) return;
    
    const config = await db.collection('admin').findOne({ type: 'config' });
    const currentImage = config?.menuImage || DEFAULT_CONFIG.menuImage;
    
    const text = `🖼️ *Menu Image Management*\n\nCurrent Image URL:\n\`${currentImage}\`\n\n*Available variables:* \`{name}\`\n\nSelect an option:`;
    
    const keyboard = [
        [{ text: '✏️ Edit Image URL', callback_data: 'admin_edit_menuimage' }],
        [{ text: '📤 Upload New Image', callback_data: 'admin_upload_menuimage' }],
        [{ text: '🔄 Reset to Default', callback_data: 'admin_reset_menuimage' }],
        [{ text: '🔙 Back', callback_data: 'admin_back' }]
    ];
    
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
});

// 6. MENU MESSAGE MANAGEMENT (Similar to start message)
bot.action('admin_menumessage', async (ctx) => {
    if (!await isAdmin(ctx.from.id)) return;
    
    const config = await db.collection('admin').findOne({ type: 'config' });
    const currentMessage = config?.menuMessage || DEFAULT_CONFIG.menuMessage;
    
    const text = `📝 *Menu Message Management*\n\nCurrent Message:\n\`\`\`\n${currentMessage}\n\`\`\`\n\n*Available variables:* \`{first_name}\`, \`{last_name}\`, \`{full_name}\`, \`{username}\`, \`{name}\`\n\nSelect an option:`;
    
    const keyboard = [
        [{ text: '✏️ Edit Message', callback_data: 'admin_edit_menumessage' }],
        [{ text: '🔄 Reset to Default', callback_data: 'admin_reset_menumessage' }],
        [{ text: '🔙 Back', callback_data: 'admin_back' }]
    ];
    
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
});

// 7. CODE TIMER MANAGEMENT
bot.action('admin_timer', async (ctx) => {
    if (!await isAdmin(ctx.from.id)) return;
    
    const config = await db.collection('admin').findOne({ type: 'config' });
    const currentTimer = config?.codeTimer || DEFAULT_CONFIG.codeTimer;
    const hours = Math.floor(currentTimer / 3600);
    
    const text = `⏰ *Code Timer Settings*\n\nCurrent timer: *${hours} hours*\n(Users must wait this long between code generations)\n\nSelect an option:`;
    
    const keyboard = [
        [{ text: '2 Hours', callback_data: 'timer_2' }],
        [{ text: '4 Hours', callback_data: 'timer_4' }],
        [{ text: '6 Hours', callback_data: 'timer_6' }],
        [{ text: '12 Hours', callback_data: 'timer_12' }],
        [{ text: '24 Hours', callback_data: 'timer_24' }],
        [{ text: '✏️ Custom Hours', callback_data: 'timer_custom' }],
        [{ text: '🔙 Back', callback_data: 'admin_back' }]
    ];
    
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
});

// Timer selection handlers
['2', '4', '6', '12', '24'].forEach(hours => {
    bot.action(`timer_${hours}`, async (ctx) => {
        const seconds = parseInt(hours) * 3600;
        await db.collection('admin').updateOne(
            { type: 'config' },
            { $set: { codeTimer: seconds } }
        );
        await ctx.answerCbQuery(`✅ Timer set to ${hours} hours`);
        await showAdminPanel(ctx);
    });
});

bot.action('timer_custom', async (ctx) => {
    await ctx.reply("Enter timer in hours (e.g., 3 for 3 hours):\n\nType 'cancel' to cancel.");
    await ctx.scene.enter('edit_timer_scene');
});

scenes.editTimer.on('text', async (ctx) => {
    if (ctx.message.text.toLowerCase() === 'cancel') {
        await ctx.reply("❌ Edit cancelled.");
        await ctx.scene.leave();
        await showAdminPanel(ctx);
        return;
    }
    
    const hours = parseInt(ctx.message.text);
    if (isNaN(hours) || hours < 1) {
        await ctx.reply("❌ Please enter a valid number of hours.");
        return;
    }
    
    const seconds = hours * 3600;
    await db.collection('admin').updateOne(
        { type: 'config' },
        { $set: { codeTimer: seconds } }
    );
    
    await ctx.reply(`✅ Timer set to ${hours} hours (${seconds} seconds)`);
    await ctx.scene.leave();
    await showAdminPanel(ctx);
});

// 8. CHANNEL MANAGEMENT
bot.action('admin_channels', async (ctx) => {
    if (!await isAdmin(ctx.from.id)) return;
    
    const config = await db.collection('admin').findOne({ type: 'config' });
    const channels = config?.channels || [];
    
    let text = "📺 *Manage Channels*\n\n";
    
    if (channels.length === 0) {
        text += "No channels added yet.\n";
    } else {
        channels.forEach((channel, index) => {
            text += `${index + 1}. ${channel.buttonLabel || channel.title}\n`;
        });
    }
    
    text += "\nSelect an option:";
    
    const keyboard = [
        [{ text: '➕ Add Channel', callback_data: 'admin_add_channel' }],
        [{ text: '👁️ View All', callback_data: 'admin_view_channels' }],
        [{ text: '✏️ Edit Channel', callback_data: 'admin_edit_channel' }],
        [{ text: '🗑️ Delete Channel', callback_data: 'admin_delete_channel' }],
        [{ text: '🔙 Back', callback_data: 'admin_back' }]
    ];
    
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
});

bot.action('admin_add_channel', async (ctx) => {
    await ctx.reply("Enter channel button name (e.g., 'Join Main Channel'):\n\nType 'cancel' to cancel.");
    await ctx.scene.enter('add_channel_name_scene');
});

scenes.addChannelName.on('text', async (ctx) => {
    if (ctx.message.text.toLowerCase() === 'cancel') {
        await ctx.reply("❌ Add cancelled.");
        await ctx.scene.leave();
        return;
    }
    
    ctx.scene.state.buttonLabel = ctx.message.text;
    await ctx.reply("Now send the channel ID (e.g., -1001234567890) or username (e.g., @channelname):\n\nYou can also forward a message from the channel.");
    await ctx.scene.leave();
    await ctx.scene.enter('add_channel_id_scene', ctx.scene.state);
});

scenes.addChannelId.on(['text', 'forward_date'], async (ctx) => {
    const buttonLabel = ctx.scene.state.buttonLabel;
    let channelId;
    
    if (ctx.message.forward_from_chat) {
        channelId = ctx.message.forward_from_chat.id;
    } else if (ctx.message.text) {
        channelId = ctx.message.text.trim();
    } else {
        await ctx.reply("❌ Please send a valid channel ID or forward a message.");
        return;
    }
    
    try {
        // Try to get chat info
        const chat = await ctx.telegram.getChat(channelId);
        
        // Check if bot is admin
        try {
            const member = await ctx.telegram.getChatMember(chat.id, ctx.botInfo.id);
            if (member.status !== 'administrator') {
                await ctx.reply("❌ Bot must be admin in the channel.\nMake bot admin and try again.");
                await ctx.scene.leave();
                return;
            }
        } catch (error) {
            await ctx.reply("❌ Bot must be admin in the channel.\nMake bot admin and try again.");
            await ctx.scene.leave();
            return;
        }
        
        // Get invite link
        let link;
        if (chat.username) {
            link = `https://t.me/${chat.username}`;
        } else {
            try {
                link = await ctx.telegram.exportChatInviteLink(chat.id);
            } catch (error) {
                link = `https://t.me/c/${String(chat.id).slice(4)}`;
            }
        }
        
        // Add to database
        await db.collection('admin').updateOne(
            { type: 'config' },
            {
                $push: {
                    channels: {
                        id: chat.id,
                        title: chat.title,
                        buttonLabel: buttonLabel,
                        link: link,
                        type: chat.username ? 'public' : 'private'
                    }
                }
            }
        );
        
        await ctx.reply(`✅ Channel added successfully!\n\n• Name: ${buttonLabel}\n• ID: ${chat.id}\n• Link: ${link}`);
        
    } catch (error) {
        await ctx.reply(`❌ Error: ${error.message}\n\nPlease make sure the channel ID or username is correct.`);
    }
    
    await ctx.scene.leave();
    await showAdminPanel(ctx);
});

// 9. APP MANAGEMENT
bot.action('admin_apps', async (ctx) => {
    if (!await isAdmin(ctx.from.id)) return;
    
    const config = await db.collection('admin').findOne({ type: 'config' });
    const apps = config?.apps || [];
    
    let text = "📱 *Manage Apps*\n\n";
    
    if (apps.length === 0) {
        text += "No apps added yet.\n";
    } else {
        apps.forEach((app, index) => {
            text += `${index + 1}. ${app.name} (${app.codeCount} codes)\n`;
        });
    }
    
    text += "\nSelect an option:";
    
    const keyboard = [
        [{ text: '➕ Add App', callback_data: 'admin_add_app' }],
        [{ text: '👁️ View All', callback_data: 'admin_view_apps' }],
        [{ text: '✏️ Edit App', callback_data: 'admin_edit_app' }],
        [{ text: '🗑️ Delete App', callback_data: 'admin_delete_app' }],
        [{ text: '🔙 Back', callback_data: 'admin_back' }]
    ];
    
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
});

bot.action('admin_add_app', async (ctx) => {
    await ctx.reply("Enter app name (e.g., 'WhatsApp Agents'):\n\nType 'cancel' to cancel.");
    await ctx.scene.enter('add_app_name_scene');
});

// App creation flow
scenes.addAppName.on('text', async (ctx) => {
    if (ctx.message.text.toLowerCase() === 'cancel') {
        await ctx.reply("❌ Add cancelled.");
        await ctx.scene.leave();
        return;
    }
    
    ctx.scene.state.name = ctx.message.text;
    await ctx.reply("Send app image URL or photo (or send 'none' for no image):");
    await ctx.scene.leave();
    await ctx.scene.enter('add_app_image_scene', ctx.scene.state);
});

scenes.addAppImage.on(['text', 'photo'], async (ctx) => {
    if (ctx.message.text && ctx.message.text.toLowerCase() === 'none') {
        ctx.scene.state.image = 'none';
    } else if (ctx.message.photo) {
        try {
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            const fileLink = await ctx.telegram.getFileLink(photo.file_id);
            const response = await fetch(fileLink);
            const buffer = await response.arrayBuffer();
            
            // Upload to Cloudinary
            const result = await uploadToCloudinary(Buffer.from(buffer), 'app_images');
            ctx.scene.state.image = result.secure_url;
            ctx.scene.state.cloudinaryId = result.public_id;
        } catch (error) {
            console.error("Upload error:", error);
            await ctx.reply("❌ Failed to upload image. Please send image URL instead.");
            return;
        }
    } else if (ctx.message.text) {
        ctx.scene.state.image = ctx.message.text;
    } else {
        await ctx.reply("❌ Please send an image or 'none'.");
        return;
    }
    
    await ctx.reply("How many codes to generate? (1-10):");
    await ctx.scene.leave();
    await ctx.scene.enter('add_app_code_count_scene', ctx.scene.state);
});

scenes.addAppCodeCount.on('text', async (ctx) => {
    const count = parseInt(ctx.message.text);
    if (isNaN(count) || count < 1 || count > 10) {
        await ctx.reply("❌ Please enter a number between 1 and 10.");
        return;
    }
    
    ctx.scene.state.codeCount = count;
    
    // Ask for prefixes
    let message = "Enter prefixes for each code (separated by commas):\n";
    message += "Example for 3 codes: XY,AB,CD\n";
    message += "Leave empty for no prefixes.";
    
    await ctx.reply(message);
    await ctx.scene.leave();
    await ctx.scene.enter('add_app_code_prefixes_scene', ctx.scene.state);
});

scenes.addAppCodePrefixes.on('text', async (ctx) => {
    const prefixes = ctx.message.text.split(',').map(p => p.trim()).filter(p => p);
    ctx.scene.state.codePrefixes = prefixes;
    
    // Ask for lengths
    let message = "Enter code lengths for each code (separated by commas, min 6):\n";
    message += "Example for 3 codes: 8,10,12\n";
    message += "Default is 8 for all codes.";
    
    await ctx.reply(message);
    await ctx.scene.leave();
    await ctx.scene.enter('add_app_code_lengths_scene', ctx.scene.state);
});

scenes.addAppCodeLengths.on('text', async (ctx) => {
    const lengths = ctx.message.text.split(',').map(l => parseInt(l.trim())).filter(l => !isNaN(l) && l >= 6);
    ctx.scene.state.codeLengths = lengths;
    
    // Ask for message
    let message = "Enter the code message template:\n\n";
    message += "Available variables:\n";
    message += "• User: {first_name}, {last_name}, {full_name}, {username}, {name}\n";
    message += "• App: {app_name}, {button_name}\n";
    message += "• Codes: {code1}, {code2}, ... {code10}\n\n";
    message += "Example: 'Your codes for {app_name} are:\n{code1}\n{code2}'";
    
    await ctx.reply(message);
    await ctx.scene.leave();
    await ctx.scene.enter('add_app_code_message_scene', ctx.scene.state);
});

scenes.addAppCodeMessage.on('text', async (ctx) => {
    const state = ctx.scene.state;
    
    // Create app object
    const app = {
        id: `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: state.name,
        image: state.image,
        codeCount: state.codeCount,
        codePrefixes: state.codePrefixes || [],
        codeLengths: state.codeLengths || Array(state.codeCount).fill(8),
        codeMessage: ctx.message.text,
        cloudinaryId: state.cloudinaryId,
        createdAt: new Date()
    };
    
    // Add to database
    await db.collection('admin').updateOne(
        { type: 'config' },
        { $push: { apps: app } }
    );
    
    await ctx.reply(`✅ App '${app.name}' added successfully!\n\n• Codes: ${app.codeCount}\n• Image: ${app.image === 'none' ? 'None' : 'Set'}`);
    await ctx.scene.leave();
    await showAdminPanel(ctx);
});

// 10. MANAGE ADMINS
bot.action('admin_manage_admins', async (ctx) => {
    if (!await isAdmin(ctx.from.id)) return;
    
    const config = await db.collection('admin').findOne({ type: 'config' });
    const admins = config?.admins || ADMIN_IDS;
    
    let text = "👑 *Manage Admins*\n\nCurrent Admins:\n";
    
    admins.forEach((adminId, index) => {
        text += `${index + 1}. \`${adminId}\`\n`;
    });
    
    text += "\nSelect an option:";
    
    const keyboard = [
        [{ text: '➕ Add Admin', callback_data: 'admin_add_admin' }],
        [{ text: '🗑️ Remove Admin', callback_data: 'admin_remove_admin' }],
        [{ text: '🔙 Back', callback_data: 'admin_back' }]
    ];
    
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
});

bot.action('admin_add_admin', async (ctx) => {
    await ctx.reply("Send the user ID of the new admin:\n\nType 'cancel' to cancel.");
    await ctx.scene.enter('add_admin_scene');
});

scenes.addAdmin.on('text', async (ctx) => {
    if (ctx.message.text.toLowerCase() === 'cancel') {
        await ctx.reply("❌ Add cancelled.");
        await ctx.scene.leave();
        await showAdminPanel(ctx);
        return;
    }
    
    const newAdminId = parseInt(ctx.message.text);
    if (isNaN(newAdminId)) {
        await ctx.reply("❌ Invalid user ID. Please enter a numeric ID.");
        return;
    }
    
    const config = await db.collection('admin').findOne({ type: 'config' });
    const currentAdmins = config?.admins || ADMIN_IDS;
    
    if (currentAdmins.includes(newAdminId)) {
        await ctx.reply("❌ This user is already an admin.");
        await ctx.scene.leave();
        await showAdminPanel(ctx);
        return;
    }
    
    const updatedAdmins = [...currentAdmins, newAdminId];
    await db.collection('admin').updateOne(
        { type: 'config' },
        { $set: { admins: updatedAdmins } }
    );
    
    await ctx.reply(`✅ Admin added successfully!\n\nNew admin ID: \`${newAdminId}\``);
    await ctx.scene.leave();
    await showAdminPanel(ctx);
});

// 11. DATA DELETION
bot.action('admin_deletedata', async (ctx) => {
    if (!await isAdmin(ctx.from.id)) return;
    
    const text = "⚠️ *DANGER ZONE - DATA DELETION*\n\nSelect what you want to delete:\n\n*WARNING: These actions cannot be undone!*";
    
    const keyboard = [
        [{ text: '🗑️ Delete All Users', callback_data: 'delete_all_users' }],
        [{ text: '🗑️ Delete All Channels', callback_data: 'delete_all_channels' }],
        [{ text: '🗑️ Delete All Apps', callback_data: 'delete_all_apps' }],
        [{ text: '🔥 DELETE EVERYTHING', callback_data: 'delete_everything' }],
        [{ text: '🔙 Back', callback_data: 'admin_back' }]
    ];
    
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
    });
});

// Data deletion handlers
bot.action('delete_all_users', async (ctx) => {
    const keyboard = [
        [{ text: '✅ YES, DELETE ALL USERS', callback_data: 'confirm_delete_users' }],
        [{ text: '❌ NO, CANCEL', callback_data: 'admin_deletedata' }]
    ];
    
    await ctx.editMessageText(
        "⚠️ *CONFIRMATION REQUIRED*\n\nAre you sure you want to delete ALL users?\n\nThis will remove:\n• All user data\n• Join history\n• Code timestamps\n\n*This action cannot be undone!*",
        {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        }
    );
});

bot.action('confirm_delete_users', async (ctx) => {
    const result = await db.collection('users').deleteMany({});
    await ctx.editMessageText(`✅ Deleted ${result.deletedCount} users.`, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: '🔙 Back to Admin', callback_data: 'admin_back' }]]
        }
    });
});

bot.action('delete_all_channels', async (ctx) => {
    const keyboard = [
        [{ text: '✅ YES, DELETE ALL CHANNELS', callback_data: 'confirm_delete_channels' }],
        [{ text: '❌ NO, CANCEL', callback_data: 'admin_deletedata' }]
    ];
    
    await ctx.editMessageText(
        "⚠️ *CONFIRMATION REQUIRED*\n\nAre you sure you want to delete ALL channels?\n\nThis will remove:\n• All channel data\n• Users will skip verification\n\n*This action cannot be undone!*",
        {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        }
    );
});

bot.action('confirm_delete_channels', async (ctx) => {
    await db.collection('admin').updateOne(
        { type: 'config' },
        { $set: { channels: [] } }
    );
    
    await ctx.editMessageText("✅ All channels deleted.", {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: '🔙 Back to Admin', callback_data: 'admin_back' }]]
        }
    });
});

bot.action('delete_all_apps', async (ctx) => {
    const keyboard = [
        [{ text: '✅ YES, DELETE ALL APPS', callback_data: 'confirm_delete_apps' }],
        [{ text: '❌ NO, CANCEL', callback_data: 'admin_deletedata' }]
    ];
    
    await ctx.editMessageText(
        "⚠️ *CONFIRMATION REQUIRED*\n\nAre you sure you want to delete ALL apps?\n\nThis will remove:\n• All app data\n• No code generation available\n\n*This action cannot be undone!*",
        {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        }
    );
});

bot.action('confirm_delete_apps', async (ctx) => {
    const config = await db.collection('admin').findOne({ type: 'config' });
    const apps = config?.apps || [];
    
    // Delete images from Cloudinary
    for (const app of apps) {
        if (app.cloudinaryId) {
            try {
                await cloudinary.uploader.destroy(app.cloudinaryId);
            } catch (error) {
                console.error(`Failed to delete image ${app.cloudinaryId}:`, error);
            }
        }
    }
    
    await db.collection('admin').updateOne(
        { type: 'config' },
        { $set: { apps: [] } }
    );
    
    await ctx.editMessageText("✅ All apps deleted (including Cloudinary images).", {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: '🔙 Back to Admin', callback_data: 'admin_back' }]]
        }
    });
});

bot.action('delete_everything', async (ctx) => {
    const keyboard = [
        [{ text: '🔥 YES, DELETE EVERYTHING', callback_data: 'confirm_delete_everything' }],
        [{ text: '❌ NO, CANCEL', callback_data: 'admin_deletedata' }]
    ];
    
    await ctx.editMessageText(
        "🚨 *EXTREME DANGER*\n\nAre you absolutely sure you want to DELETE EVERYTHING?\n\nThis will remove:\n• ALL users\n• ALL channels\n• ALL apps\n• ALL settings\n\n*COMPLETE RESET - IRREVERSIBLE!*\n\nType 'DELETE_ALL' to confirm:",
        {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        }
    );
});

bot.action('confirm_delete_everything', async (ctx) => {
    await ctx.reply("Please type 'DELETE_ALL' to confirm complete deletion:");
    
    const listener = async (ctx2) => {
        if (ctx2.message.text === 'DELETE_ALL') {
            // Delete users
            await db.collection('users').deleteMany({});
            
            // Delete config
            await db.collection('admin').deleteOne({ type: 'config' });
            
            // Reinitialize with defaults
            await initBot();
            
            await ctx2.reply("🔥 COMPLETE RESET DONE!\n\nBot has been reset to factory settings.");
            
            // Remove listener
            bot.off('message', listener);
        } else {
            await ctx2.reply("❌ Cancelled. Wrong confirmation text.");
            bot.off('message', listener);
        }
    };
    
    bot.on('message', listener);
});

// ==========================================
// ERROR HANDLING
// ==========================================

bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}:`, err);
    if (ctx.message) {
        ctx.reply("❌ An error occurred. Please try again.");
    }
});

// ==========================================
// START BOT
// ==========================================

async function startBot() {
    try {
        // Connect to database
        await connectDB();
        
        // Initialize bot settings
        await initBot();
        
        // Start bot
        await bot.launch();
        console.log('🤖 Bot is running...');
        
        // Enable graceful stop
        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

// Handle Railway port binding
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV === 'production') {
    // For Railway deployment
    const express = require('express');
    const app = express();
    
    app.get('/', (req, res) => {
        res.send('Telegram Bot is running!');
    });
    
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        startBot();
    });
} else {
    // For local development
    startBot();
}

console.log("Bot Starting...");
