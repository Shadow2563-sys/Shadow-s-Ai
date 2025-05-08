require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Configuration, OpenAIApi } = require('openai');
const fetch = require('node-fetch');
const fs = require('fs');
const { exec } = require('child_process');

const bot = new Telegraf(process.env.BOT_TOKEN);

const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_KEY,
}));

// 🧠 In-memory memory
const memory = {};

// /start
bot.start((ctx) => ctx.reply('👤 I am SHADOW — your dark AI assistant made by @Vortex_Shadow2563. Ask me anything or use /image, /code, /remember, /recall.'));

// General AI Q&A
bot.on('text', async (ctx) => {
  const message = ctx.message.text;
  const ignoredCommands = ['/start', '/image', '/code', '/remember', '/recall'];

  if (ignoredCommands.some(cmd => message.startsWith(cmd))) return;

  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are Shadow, a dark, intelligent AI assistant. Help the user with anything.' },
        { role: 'user', content: message }
      ],
    });

    const reply = response.data.choices[0].message.content;
    ctx.reply(reply);
  } catch (err) {
    console.error(err);
    ctx.reply('⚠️ Shadow encountered an error trying to think.');
  }
});

// /image
bot.command('image', async (ctx) => {
  const prompt = ctx.message.text.split(' ').slice(1).join(' ');
  if (!prompt) return ctx.reply('🖼️ Provide a description. Example: /image a robotic crow in shadows');

  try {
    const res = await openai.createImage({ prompt, n: 1, size: "512x512" });
    const imageUrl = res.data.data[0].url;
    ctx.replyWithPhoto(imageUrl);
  } catch (err) {
    console.error(err);
    ctx.reply('⚠️ Shadow failed to visualize the image.');
  }
});

// /code
bot.command('code', (ctx) => {
  const code = ctx.message.text.split(' ').slice(1).join(' ');
  if (!code) return ctx.reply('🧾 Provide some code. Example: /code 2 + 2');

  try {
    let result = eval(code);
    ctx.reply(`🧮 Result: ${result}`);
  } catch (err) {
    ctx.reply(`❌ Error: ${err.message}`);
  }
});

// /remember
bot.command('remember', (ctx) => {
  const data = ctx.message.text.split(' ').slice(1).join(' ');
  if (!data) return ctx.reply('🧠 What should I remember? Example: /remember I like juice wrld');
  memory[ctx.from.id] = data;
  ctx.reply('✅ Shadow has stored your memory.');
});

// /recall
bot.command('recall', (ctx) => {
  const data = memory[ctx.from.id];
  if (!data) return ctx.reply('❌ Nothing remembered yet.');
  ctx.reply(`🧠 You told me: "${data}"`);
});

// Voice Messages
bot.on('voice', async (ctx) => {
  const file = await ctx.telegram.getFile(ctx.message.voice.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
  const oggPath = `voice.ogg`;
  const wavPath = `voice.wav`;

  const res = await fetch(fileUrl);
  const buffer = await res.buffer();
  fs.writeFileSync(oggPath, buffer);

  exec(`ffmpeg -i ${oggPath} -ar 16000 -ac 1 -f wav ${wavPath}`, async (err) => {
    if (err) return ctx.reply('⚠️ Audio conversion failed.');

    const audioData = fs.readFileSync(wavPath);
    try {
      const response = await openai.createTranscription(
        audioData,
        "whisper-1"
      );
      const transcript = response.data.text;
      ctx.reply(`🗣️ You said: "${transcript}"`);
    } catch (err) {
      console.error(err);
      ctx.reply('❌ Shadow couldn’t understand the voice.');
    }
  });
});
