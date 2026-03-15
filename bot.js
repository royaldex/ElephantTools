const TelegramBot = require('node-telegram-bot-api');
const https = require('https');

const BOT_TOKEN = '8747975359:AAHe0aFnRHafYbJWzmI-SJh3w5Ux3vzrlw0';
const TON_WALLET = 'UQAcBykElvVGUdqqagg0FN4-pIuqmNPnL8qwy_APLGTsjVSt';
const ORDER_LOG_CHAT = null; // Set to your Telegram chat ID to get order notifications

const STRAINS = {
  grape_escape: {
    name: 'Grape Escape',
    lineage: 'El Chemi Kiwi × Cosmic Cupcake',
    type: 'Feminized Auto — 80% Indica',
    time: '~75 Days',
    flavor: 'Grape · SweeTARTS · Sweet · Tangy',
    effect: 'Heavy head high · Deep relaxation',
    price: 50,
    seeds: 8,
    emoji: '🍇'
  },
  vipers_treat: {
    name: "Viper's Treat",
    lineage: 'Black Mamba × Cosmic Cupcake',
    type: 'Feminized Auto — Hybrid',
    time: '~70 Days',
    flavor: 'Fuel · Dark Fruit · Sweet · Spice',
    effect: 'Hybrid high · Uplifting · Body relaxation',
    price: 50,
    seeds: 8,
    emoji: '🐍'
  },
  tropical_dream_cake: {
    name: 'Tropical Dream Cake',
    lineage: 'Orange Razzle Dazzle × Cosmic Cupcake',
    type: 'Feminized Auto — Hybrid',
    time: '~70 Days',
    flavor: 'Tropical · Orange · Sweet · Cake',
    effect: 'Balanced hybrid · Relaxed · Creative',
    price: 50,
    seeds: 8,
    emoji: '🌴'
  }
};

const sessions = {};
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

function getTONPrice(cb) {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd';
  https.get(url, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      try { cb(JSON.parse(data)['the-open-network']?.usd || null); }
      catch { cb(null); }
    });
  }).on('error', () => cb(null));
}

function strainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🍇 Grape Escape — $50', callback_data: 'strain_grape_escape' }],
        [{ text: "🐍 Viper's Treat — $50", callback_data: 'strain_vipers_treat' }],
        [{ text: '🌴 Tropical Dream Cake — $50', callback_data: 'strain_tropical_dream_cake' }],
      ]
    }
  };
}

function logOrder(o) {
  if (!ORDER_LOG_CHAT) return;
  bot.sendMessage(ORDER_LOG_CHAT,
    `🌿 NEW ORDER\n\nStrain: ${o.strain}\nSeeds: ${o.seeds}\nPrice: $${o.price} (${o.tonAmount} TON)\nShip to: ${o.address}\nUser: @${o.username || 'unknown'} (${o.userId})\nTime: ${new Date().toISOString()}`
  );
}

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `✦ *Welcome to Autofire Genetics*, ${msg.from.first_name || 'Grower'}.\n\nConnoisseur-grade autoflower seeds. Feminized. 8 seeds per pack. $50 each.\n\nPayments accepted in TON — fast, private, no middlemen.\n\nBrowse the current lineup:`,
    { parse_mode: 'Markdown', ...strainMenu() }
  );
});

bot.onText(/\/menu/, (msg) => {
  bot.sendMessage(msg.chat.id, '🌿 *Current Strains:*',
    { parse_mode: 'Markdown', ...strainMenu() }
  );
});

bot.onText(/\/order/, (msg) => {
  bot.sendMessage(msg.chat.id, '🌿 Select a strain to order:', strainMenu());
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `*Autofire Genetics Bot*\n\n/start — Welcome\n/menu — Browse strains\n/order — Place an order\n/help — Commands\n\nIG: @autofiregenetics`,
    { parse_mode: 'Markdown' }
  );
});

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  bot.answerCallbackQuery(query.id);

  if (data.startsWith('strain_')) {
    const key = data.replace('strain_', '');
    const s = STRAINS[key];
    if (!s) return;
    sessions[userId] = { step: 'confirm', strainKey: key };
    bot.sendMessage(chatId,
      `${s.emoji} *${s.name}*\n\n*Lineage:* ${s.lineage}\n*Type:* ${s.type}\n*Flower Time:* ${s.time}\n*Flavor:* ${s.flavor}\n*Effect:* ${s.effect}\n\n*Pack:* ${s.seeds} seeds — *$${s.price}* (paid in TON)`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Order this strain', callback_data: `order_${key}` }],
            [{ text: '← Back to menu', callback_data: 'back_menu' }]
          ]
        }
      }
    );
  }

  if (data.startsWith('order_')) {
    const key = data.replace('order_', '');
    sessions[userId] = { step: 'address', strainKey: key };
    bot.sendMessage(chatId,
      `📦 *Shipping Address*\n\nReply with your full address:\n\n_Name_\n_Street_\n_City, State, ZIP_\n_Country_\n\nAll orders ship in plain discreet packaging. 🔒`,
      { parse_mode: 'Markdown' }
    );
  }

  if (data === 'back_menu') {
    bot.sendMessage(chatId, '🌿 Select a strain:', strainMenu());
  }

  if (data === 'paid_confirm') {
    const session = sessions[userId];
    if (!session) return;
    const s = STRAINS[session.strainKey];
    logOrder({ strain: s.name, seeds: s.seeds, price: s.price, tonAmount: session.tonAmount, address: session.address, username: query.from.username, userId });
    delete sessions[userId];
    bot.sendMessage(chatId,
      `✦ *Order received — thank you!*\n\n${s.emoji} *${s.name}* — ${s.seeds} seeds\n\nWe'll verify your TON payment and ship within 2–3 business days. You'll receive a tracking update here.\n\nFollow @autofiregenetics on Instagram for new drops. 🌿`,
      { parse_mode: 'Markdown' }
    );
  }

  if (data === 'paid_issue') {
    bot.sendMessage(chatId, `No problem — DM us on Instagram @autofiregenetics and we'll sort it out.`);
  }
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  if (!text || text.startsWith('/')) return;
  const session = sessions[userId];
  if (!session || session.step !== 'address') return;

  session.address = text;
  session.step = 'payment';
  const s = STRAINS[session.strainKey];

  getTONPrice((tonPrice) => {
    let tonAmount, priceNote;
    if (tonPrice) {
      tonAmount = (s.price / tonPrice).toFixed(4);
      priceNote = `$${s.price} USD = *${tonAmount} TON*\n_(live rate: 1 TON ≈ $${tonPrice.toFixed(2)})_`;
    } else {
      tonAmount = 'see current rate';
      priceNote = `*$${s.price} USD* in TON at current market rate`;
    }
    session.tonAmount = tonAmount;

    bot.sendMessage(chatId,
      `💎 *Payment*\n\n${s.emoji} *${s.name}* — ${s.seeds} seeds\n*Ship to:* ${text}\n\n${priceNote}\n\n*Send TON to:*\n\`${TON_WALLET}\`\n\nTo pay: open @wallet in Telegram → Send → paste the address above.\n\nOnce sent, tap *I've Paid* below.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ I've Paid", callback_data: 'paid_confirm' }],
            [{ text: '❓ Issue with payment', callback_data: 'paid_issue' }]
          ]
        }
      }
    );
  });
});

bot.on('polling_error', (err) => console.error('Polling error:', err.message));
console.log('✦ Autofire Genetics Bot running...');
