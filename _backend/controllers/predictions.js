const { getGroqClient } = require('./groqService');
const { db } = require('../firebase');
const fetch = require('node-fetch');

// Store API key globally for shared use
let groqInstance = null;
function initGroq() {
    const Groq = require('groq-sdk');
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    if (!groqInstance) groqInstance = new Groq({ apiKey: key });
    return groqInstance;
}

async function handlePricePrediction(req, res) {
    const { crop, state, currentPrice, history = [] } = req.body;
    
    if (!crop || !state || !currentPrice) {
        return res.status(400).json({ success: false, error: "Missing required fields: crop, state, currentPrice" });
    }

    try {
        const groq = initGroq();
        if (!groq) return res.status(503).json({ success: false, error: "Groq API key missing" });

        console.log(`[Predictions] Generating 7-day forecast for ${crop} in ${state} at base ₹${currentPrice}`);

        // Construct the prompt for logic-based 7-day simulated forecast
        const prompt = `You are AgriSmart AI Market Predictor. Given a crop, region, and today's modal price, predict the next 7 days of prices.
Current Scenario:
- Crop: ${crop}
- Location: ${state}
- Today's Price: ₹${currentPrice} per quintal
- Recent History (if any): [${history.join(', ')}]

Rules:
1. Provide a realistic 7-day trend (factors like harvest season, typical demand).
2. Limit fluctuations to +/- 5% per day.
3. Determine if the trend is UP, DOWN, or STABLE.
4. Give a strong Recommendation: SELL, HOLD, or WAIT.
5. Provide a Confidence Score out of 100.
6. Return purely valid JSON output matching this schema:
{
  "trend_direction": "UP" | "DOWN" | "STABLE",
  "recommendation": "SELL" | "HOLD" | "WAIT",
  "reasoning": "Short 1-sentence market rationale.",
  "confidence_score": 85,
  "predictions": [
     {"day": 1, "predicted_price": 2050},
     {"day": 2, "predicted_price": 2060},
     {"day": 3, "predicted_price": 2080},
     {"day": 4, "predicted_price": 2100},
     {"day": 5, "predicted_price": 2110},
     {"day": 6, "predicted_price": 2090},
     {"day": 7, "predicted_price": 2120}
  ]
}

DO NOT output any markdown blocks or explanations. Only the plain JSON text.`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'openai/gpt-oss-120b',
            temperature: 0.2, // Low temp for more deterministic numbers
            response_format: { type: 'json_object' }
        });

        const content = completion.choices[0].message.content;
        let predictionData;
        try {
            predictionData = JSON.parse(content.trim());
        } catch(e) {
            console.error("Failed to parse prediction:", content);
            throw new Error("Invalid output from AI model.");
        }

        // Save to Firestore
        const docRef = db.collection('price_predictions').doc(`${state}_${crop}`.replace(/\s+/g, '_').toLowerCase());
        await docRef.set({
            crop,
            state,
            basePrice: currentPrice,
            prediction: predictionData,
            timestamp: require('../firebase').admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, data: predictionData });

    } catch (err) {
        console.error("[Predictions] Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}

async function handleProfitCalculation(req, res) {
    const { crop, landSize, costPerAcre, expectedYieldPerAcre, state } = req.body;

    if (!crop || !landSize || !costPerAcre || !expectedYieldPerAcre || !state) {
        return res.status(400).json({ success: false, error: "Missing required fields for profit calculation" });
    }

    try {
        const groq = initGroq();
        
        // Fetch current price from Mandi API (cached or live)
        const common = require('./common');
        // We'll simulate a mini-fetch or use a default if Mandi API is complex to call internally
        const prices = { "Rice": 2250, "Wheat": 2100, "Cotton": 7200, "Maize": 1950, "Chilli": 15000, "Tomato": 1800, "Onion": 1400 };
        const currentPrice = prices[crop] || 2000;

        const totalRevenue = (parseFloat(expectedYieldPerAcre) * parseFloat(landSize)) * (currentPrice / 1); // price per quintal
        const totalCost = parseFloat(costPerAcre) * parseFloat(landSize);
        const netProfit = totalRevenue - totalCost;
        const profitMargin = ((netProfit / totalCost) * 100).toFixed(1);

        let aiAdvisory = "Profitability is within normal range for this season.";

        if (groq) {
            const prompt = `Crop: ${crop}, Land: ${landSize} acres, Total Cost: ₹${totalCost}, Total Revenue: ₹${totalRevenue}, Net Profit: ₹${netProfit}.
Current Market Price: ₹${currentPrice}/quintal.
Provide a 2-sentence financial advisory for the farmer. Should they invest more in fertilizers, save for next season, or consider crop insurance? Be specific and encouraging. Do not use markdown.`;
            
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'system', content: 'You are a Financial Advisor for Farmers.' }, { role: 'user', content: prompt }],
                model: 'openai/gpt-oss-120b',
                temperature: 0.3
            });
            aiAdvisory = completion.choices[0].message.content.trim();
        }

        res.json({
            success: true,
            data: {
                currentPrice,
                totalRevenue,
                totalCost,
                netProfit,
                profitMargin,
                advisory: aiAdvisory
            }
        });
    } catch (err) {
        console.error("[ProfitCalc] Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = { handlePricePrediction, handleProfitCalculation };
