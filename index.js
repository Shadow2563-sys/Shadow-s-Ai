require('dotenv').config();
const { Telegraf } = require('telegraf');
const { OpenAI } = require('openai');
const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const bot = new Telegraf(process.env.BOT_TOKEN);

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

let memory = {}; // simple memory storage

// /start and /shadow command
bot.start((ctx) => {
  ctx.reply(`👋 Welcome to *Shadow AI*, your personal assistant. Type anything!`, { parse_mode: 'Markdown' });
});
bot.hears('shadow', (ctx) => ctx.reply('🔮 Shadow AI at your service. Ask me anything.'));

// /image command
bot.command('image', async (ctx) => {
  const prompt = ctx.message.text.split(' ').slice(1).join(' ');
  if (!prompt) return ctx.reply('⚠️ Please provide a prompt. Example:\n/image futuristic city at night');

  try {
    const res = await openai.images.generate({
      prompt,
      n: 1,
      size: '512x512',
    });

    ctx.replyWithPhoto(res.data[0].url);
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Failed to generate image.');
  }
});

// /code command
bot.command('code', async (ctx) => {
  const input = ctx.message.text.split(' ').slice(1).join(' ');
  if (!input) return ctx.reply('⚠️ Provide a code snippet. Example:\n/code console.log("Hello")');

  let result = '';
  if (input.includes('console.log') || input.includes('function')) {
    // JavaScript
    try {
      result = eval(input);
      ctx.reply(`✅ JS Result:\n${result}`);
    } catch (e) {
      ctx.reply(`❌ JS Error:\n${e.message}`);
    }
  } else {
    // Python (with subprocess)
    const filename = path.join(__dirname, 'temp.py');
    fs.writeFileSync(filename, input);
    exec(`python3 ${filename}`, (err, stdout, stderr) => {
      if (err || stderr) return ctx.reply(`❌ Python Error:\n${stderr || err.message}`);
      ctx.reply(`✅ Python Result:\n${stdout}`);
      fs.unlinkSync(filename);
    });
  }
});

// /remember <key> <value>
bot.command('remember', (ctx) => {
  const [, key, ...value] = ctx.message.text.split(' ');
  if (!key || value.length === 0) return ctx.reply('❗ Usage: /remember name Shadow');
  memory[key] = value.join(' ');
  ctx.reply(`🧠 Remembered: ${key} = ${memory[key]}`);
});

// /recall <key>
bot.command('recall', (ctx) => {
  const key = ctx.message.text.split(' ')[1];
  if (!key) return ctx.reply('❗ Usage: /recall name');
  const value = memory[key];
  if (!value) return ctx.reply(`❌ Nothing remembered for: ${key}`);
  ctx.reply(`🔍 ${key} = ${value}`);
});

// Voice message → Transcribe with OpenAI
bot.on('voice', async (ctx) => {
  try {
    const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const filePath = path.join(__dirname, 'audio.ogg');
    const writer = fs.createWriteStream(filePath);
    const res = await axios.get(fileLink.href, { responseType: 'stream' });
    res.data.pipe(writer);

    writer.on('finish', async () => {
      const transcript = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-1',
      });

      ctx.reply(`🗣 Transcription:\n${transcript.text}`);
      fs.unlinkSync(filePath);
    });
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Failed to transcribe audio.');
  }
});

// Catch-all text → AI Chat
bot.on('text', async (ctx) => {
  const userMessage = ctx.message.text;
  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: userMessage }],
      model: 'gpt-3.5-turbo'
    });

    const reply = completion.choices[0].message.content;
    ctx.reply(reply);
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Failed to get response from Shadow.');
  }
});

// Start bot
bot.launch();
console.log('🤖 Shadow bot is running...');
