require('dotenv').config();
const { Telegraf } = require('telegraf');
const { OpenAI } = require('openai');
const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');

const bot = new Telegraf(process.env.BOT_TOKEN);
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

let memory = {};

// 🔹 Command: /start
bot.start((ctx) => {
  ctx.reply(`👋 Welcome to SHADOW — your personal AI assistant.`);
});

// 🔹 Command: /image <prompt>
bot.command('image', async (ctx) => {
  const prompt = ctx.message.text.split(' ').slice(1).join(' ');
  if (!prompt) return ctx.reply('❗ Please provide an image prompt.');

  try {
    const res = await openai.images.generate({
      prompt,
      n: 1,
      size: "512x512"
    });

    const imageUrl = res.data[0].url;
    ctx.replyWithPhoto(imageUrl, { caption: `🎨 Image for: "${prompt}"` });
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Error generating image.');
  }
});

// 🔹 Command: /code <language>\n<code>
bot.command('code', async (ctx) => {
  const text = ctx.message.text.split(' ').slice(1).join(' ');
  const lang = text.split('\n')[0].toLowerCase();
  const code = text.split('\n').slice(1).join('\n');

  if (!lang || !code) return ctx.reply('🧠 Usage: /code <language>\\n<code>');

  try {
    if (lang === 'js' || lang === 'javascript') {
      const result = eval(code);
      ctx.reply(`🧪 JS Output:\n${result}`);
    } else if (lang === 'python' || lang === 'py') {
      fs.writeFileSync('temp.py', code);
      exec('python3 temp.py', (err, stdout, stderr) => {
        if (err || stderr) return ctx.reply(`❌ Python Error:\n${stderr || err.message}`);
        ctx.reply(`🐍 Python Output:\n${stdout}`);
      });
    } else {
      ctx.reply('⚠️ Language not supported. Use js or python.');
    }
  } catch (e) {
    ctx.reply(`❌ Error:\n${e.message}`);
  }
});

// 🔹 Command: /remember <key> = <value>
bot.command('remember', (ctx) => {
  const match = ctx.message.text.match(/\/remember\s+(\w+)\s*=\s*(.+)/);
  if (!match) return ctx.reply('💾 Usage: /remember <key> = <value>');
  const [, key, value] = match;
  memory[key] = value;
  ctx.reply(`✅ Remembered: ${key} = ${value}`);
});

// 🔹 Command: /recall <key>
bot.command('recall', (ctx) => {
  const key = ctx.message.text.split(' ')[1];
  if (!key) return ctx.reply('🧠 Usage: /recall <key>');
  const value = memory[key];
  ctx.reply(value ? `📌 ${key} = ${value}` : '❌ Not found.');
});

// 🔹 Voice messages (speech to text)
bot.on('voice', async (ctx) => {
  try {
    const file = await ctx.telegram.getFile(ctx.message.voice.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    const oggPath = './voice.ogg';
    const mp3Path = './voice.mp3';

    const writer = fs.createWriteStream(oggPath);
    const res = await axios({ url: fileUrl, method: 'GET', responseType: 'stream' });
    res.data.pipe(writer);
    await new Promise((resolve) => writer.on('finish', resolve));

    await new Promise((resolve, reject) => {
      exec(`ffmpeg -i ${oggPath} -ar 44100 -ac 2 -b:a 192k ${mp3Path}`, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(mp3Path),
      model: 'whisper-1'
    });

    ctx.reply(`🎤 You said: ${transcription.text}`);
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Voice processing failed.');
  }
});

// Launch
bot.launch();
console.log('🤖 Shadow bot is running...');
