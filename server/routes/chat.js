const router = require('express').Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const auth = require('../middleware/auth');
const { toolDefinitions, executeTool } = require('../ai/tools');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
router.use(auth);

router.post('/', async (req, res) => {
  const { messages } = req.body;
  const userId = req.user.id;
  const userName = req.user.name;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentMonth = today.toLocaleString('default', { month: 'long' });

  const systemPrompt = `You are a smart, friendly financial assistant for ${userName}'s expense tracker.
Today's date: ${todayStr}. Current month: ${currentMonth}.
You can CREATE, READ, UPDATE, DELETE expenses using your tools.
Always confirm what you did. Be concise. Use ₹ for currency.
Category mapping: Food/groceries/restaurant → Food, Uber/ola/bus → Transport,
Electricity/rent/internet → Bills, Amazon/clothes → Shopping,
Doctor/medicine → Healthcare, Movie/netflix → Entertainment.`;

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'AI error: GEMINI_API_KEY is missing in .env' });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: toolDefinitions }]
    });

    const apiMessages = messages || [];
    const lastMessageObj = apiMessages[apiMessages.length - 1];

    if (!lastMessageObj) {
      return res.json({ reply: 'Hello!' });
    }

    // Role mapping: Anthropic standard to Gemini standard
    const history = apiMessages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content) }]
    }));

    const chat = model.startChat({ history });

    let result = await chat.sendMessage([{ text: String(lastMessageObj.content) }]);
    let iterations = 0;

    while (iterations < 8) {
      iterations++;

      const functionCalls = result.response.functionCalls();

      if (!functionCalls || functionCalls.length === 0) {
        return res.json({ reply: result.response.text() || 'Done.' });
      }

      const functionResponses = [];

      for (const call of functionCalls) {
        let executionResult;
        try {
          executionResult = await executeTool(call.name, call.args, userId);
        } catch (err) {
          executionResult = { error: err.message };
        }

        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: executionResult
          }
        });
      }

      result = await chat.sendMessage(functionResponses);
    }

    res.json({ reply: result.response.text() || 'Done.' });

  } catch (e) {
    console.error('Chat error:', e);
    const errMsg = e?.message || 'Unknown error';
    res.status(500).json({
      error: `AI error: ${errMsg}`,
      type: e?.name || ''
    });
  }
});

router.post('/ocr', async (req, res) => {
  const { imageBase64, mimeType } = req.body;
  const userId = req.user.id;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `You are an OCR receipt scanner for an expense tracker.
Extract the details from this receipt and output them in purely valid JSON format without markdown blocks.
Required keys: 'amount' (number in rupees), 'merchant' (string, store name), 'date' (YYYY-MM-DD), 'category' (string: Food, Transport, Bills, Shopping, Healthcare, Entertainment, Other), 'description' (short summary).

Only return the standard JSON object. Nothing else.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType || "image/jpeg"
        }
      }
    ]);

    const responseText = result.response.text();
    let receiptData;
    
    // Extract JSON aggressively in case the model wraps it in markdown despite instructions
    try {
      const match = responseText.match(/\{[\s\S]*\}/);
      receiptData = JSON.parse(match ? match[0] : responseText);
    } catch(e) {
      console.log('Failed parsing JSON:', responseText);
      return res.status(400).json({ error: 'Failed to extract valid data from receipt' });
    }

    // Pass the extracted data directly to our expense tool!
    const executionResult = await executeTool('create_expense', { expenses: [receiptData] }, userId);
    
    res.json({ 
      reply: `I scanned the receipt and added an expense for ${receiptData.merchant} (₹${receiptData.amount}).`,
      expense: executionResult
    });

  } catch(e) {
    console.error('OCR Error:', e);
    res.status(500).json({ error: 'Failed to process receipt image' });
  }
});

module.exports = router;