require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
  console.log('API Key present:', !!process.env.GEMINI_API_KEY);
  console.log('API Key begins with:', process.env.GEMINI_API_KEY?.slice(0, 10) + '...');

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'INSERT_YOUR_GEMINI_API_KEY_HERE') {
    console.log('❌ Error: GEMINI_API_KEY is missing or still set to placeholder in .env!');
    return;
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

  try {
    const chat = model.startChat();
    const result = await chat.sendMessage('Say hi');
    console.log('✅ SUCCESS:', result.response.text());
  } catch (e) {
    console.error('❌ ERROR name:', e.name);
    console.error('❌ ERROR message:', e.message);
  }
}

test();
