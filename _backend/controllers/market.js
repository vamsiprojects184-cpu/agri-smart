const fetch = require('node-fetch');

async function handleMarketAdvisory(req, res) {
    const { crop, state = "Telangana", location, prices, arrivals, storage } = { ...req.query, ...req.body };
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY; // Fallback to groq key if openrouter is not set
    
    // Default fallback if no keys
    if (!apiKey) return res.json({ success: true, data: { situation: "Stable prices expected.", risk_level: "Low", recommendation: "Hold", reason: "API Key missing, providing default advice.", expected_price_low: 2000, expected_price_high: 2500, action_window_days: 7 } });

    try {
        const prompt = `
        Act as an expert Agricultural Market Analyst in India.
        Crop: ${crop}
        Location: ${location || state}
        Recent Prices: ${prices ? JSON.stringify(prices) : 'Unknown'}
        Arrivals: ${arrivals || 'Unknown'}
        Farmer has storage facility: ${storage ? 'Yes' : 'No'}

        Analyze the market trend for this crop in this region. 
        Provide a Price Prediction and Advisory in JSON format strictly containing these exact keys:
        - "situation": A brief description of the current market situation.
        - "risk_level": "Low", "Medium", or "High"
        - "recommendation": A short, clear action like "Sell Now", "Hold for 1 week", "Staggered Sale".
        - "reason": Why the farmer should take this action (e.g. "Tomato price will increase next week due to low arrivals -> Hold crop").
        - "expected_price_low": Number (lower bound of expected price per quintal in INR)
        - "expected_price_high": Number (upper bound)
        - "action_window_days": Number of days this advice is valid for
        `;

        // We use Groq since it's reliable for structured JSON
        const Groq = require('groq-sdk');
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'system', content: 'You are a Market Analyst. Output valid JSON only.' }, { role: 'user', content: prompt }],
            model: 'openai/gpt-oss-120b',
            response_format: { type: 'json_object' },
            temperature: 0.2
        });

        const resultData = JSON.parse(completion.choices[0].message.content);
        res.json({ success: true, data: resultData });
    } catch (err) {
        console.error("[Market] Advisory Error:", err.message);
        res.json({ success: false, message: err.message });
    }
}

module.exports = { handleMarketAdvisory };
