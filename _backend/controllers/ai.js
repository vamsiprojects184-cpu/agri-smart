const Groq = require('groq-sdk');
const googleTTS = require('google-tts-api');
const { queryDB, runDB } = require('../database');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const os = require('os');

let groqInstance = null;
let cachedKey = null;

function getGroqClient() {
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    if (!groqInstance || key !== cachedKey) {
        groqInstance = new Groq({ apiKey: key });
        cachedKey = key;
    }
    return groqInstance;
}

const CROP_QUESTIONS = [
    { id: 1, question: "What type of soil do you have?", key: "soilType", options: ["Black", "Red", "Alluvial", "Clay", "Sandy"] },
    { id: 2, question: "How many acres?", type: "number", key: "landSize" },
    { id: 3, question: "Water source?", key: "waterSource", options: ["Rainfed", "Borewell", "Canal", "Drip"] },
    { id: 4, question: "Budget?", key: "budget", options: ["Low", "Medium", "High"] },
    { id: 5, question: "Goal?", key: "goal", options: ["Profit", "Security", "Low Risk"] }
];

async function handleConversationalCrop(req, res) {
    const { conversationState, userResponse, questionId } = req.body;
    if (!conversationState) {
        return res.json({ success: true, data: { question: CROP_QUESTIONS[0], questionNumber: 1, totalQuestions: CROP_QUESTIONS.length, isComplete: false } });
    }
    const currentIdx = questionId - 1;
    const answers = { ...conversationState.answers };
    answers[CROP_QUESTIONS[currentIdx].key] = userResponse;
    const nextIdx = currentIdx + 1;

    if (nextIdx >= CROP_QUESTIONS.length) {
        // Recommendations logic using Groq
        try {
            const completion = await groq.chat.completions.create({
                messages: [{ 
                    role: 'system', 
                    content: 'You are an Agricultural Advisor. Return recommendations in a JSON object with a "recommendations" array.' 
                }, { 
                    role: 'user', 
                    content: `Recommend crops for these farm conditions: ${JSON.stringify(answers)}` 
                }],
                model: 'openai/gpt-oss-120b',
                response_format: { type: 'json_object' }
            });
            return res.json({ success: true, data: { isComplete: true, ...JSON.parse(completion.choices[0].message.content) } });
        } catch (e) {
            return res.json({ success: true, data: { isComplete: true, recommendations: [] } });
        }
    }
    res.json({ success: true, data: { question: CROP_QUESTIONS[nextIdx], questionNumber: nextIdx + 1, totalQuestions: CROP_QUESTIONS.length, isComplete: false, answers } });
}

async function handleCropRecommendation(req, res) {
    console.log("[AI] Starting Crop Recommendation...");
    const { location, season, soil_type, rainfall, previous_crop } = req.body;

    const groq = getGroqClient();
    if (!groq) {
        return res.status(503).json({ success: false, error: 'AI service not configured. Set GROQ_API_KEY.' });
    }

    try {
        const prompt = `
        Act as an expert Agricultural Advisor in India. Provide the best crop recommendation based on these conditions:
        - Location: ${location}
        - Season: ${season}
        - Soil Type & Fertility: ${soil_type}
        - Rainfall/Water: ${rainfall}mm
        - Previous Crop: ${previous_crop}
        
        Account for weather patterns and price fluctuations to provide a realistic "risk_level" (Low, Medium, or High).
        Return purely a JSON object with this exact structure (no markdown tags like \`\`\`json):
        {
          "best_crop": {
            "name": "English name of crop",
            "local_name": "Telugu or internal name",
            "yield_range": "Expected yield per acre (e.g. 15-20 quintals/acre)",
            "profit_potential": "Estimated profit properly formatted in INR (e.g. ₹60,000-80,000/acre)",
            "risk_level": "Low",
            "reason": "Detailed explanation of why this is best, mentioning soil and weather",
            "fertilizer_schedule": [ { "stage": "...", "product": "...", "dosage": "...", "instructions": "..." } ],
            "pesticide_advisory": [ { "pest": "...", "product": "...", "timing": "...", "notes": "..." } ]
          },
          "alternatives": [
            { "name": "...", "risk_level": "...", "reason": "...", "yield_range": "...", "suitability_score": 85 }
          ]
        }`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: 'system', content: 'You are an Agricultural Advisor. Output valid JSON only.' }, { role: 'user', content: prompt }],
            model: 'openai/gpt-oss-120b',
            response_format: { type: 'json_object' },
            temperature: 0.2
        });

        const content = completion.choices[0].message.content;
        const data = JSON.parse(content);
        res.json({ success: true, data });
    } catch (err) {
        console.error("[AI] Crop Recommendation Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}

async function handleDiseaseDetection(req, res) {
    console.log("[AI] Starting Disease Detection...");
    let imageUrl = req.body.imageUrl;
    let imageBytes = req.body.file || req.body.imageBytes;
    let imageType = req.body.fileType || req.body.imageType;

    if (imageBytes && Buffer.isBuffer(imageBytes)) {
        console.log(`[AI] Image received as Buffer (${imageBytes.length} bytes), Type: ${imageType}`);
        imageUrl = `data:${imageType || 'image/jpeg'};base64,${imageBytes.toString('base64')}`;
    }

    if (!imageUrl) {
        console.error("[AI] Error: No imageUrl or imageBytes found in request body");
        return res.status(400).json({ success: false, error: 'No image provided. Please upload a crop image.' });
    }

    const visionKey = process.env.GROQ_VISION_API_KEY || process.env.GROQ_API_KEY;
    if (!visionKey) {
        return res.status(503).json({ success: false, error: 'AI service not configured. Set GROQ_API_KEY.' });
    }
    const groq = new Groq({ apiKey: visionKey });

    try {
        console.log("[AI] Calling Groq Vision Model (Llama 4 Scout)...");
        const completion = await groq.chat.completions.create({
            messages: [{ 
                role: 'user', 
                content: [
                    { type: 'text', text: 'Identify the plant disease in this image. Return ONLY a valid JSON object: {"disease_name": string, "confidence": number, "symptoms": [string], "organic_remedies": [string], "treatment_plan": [string], "chemical_treatment": string}' }, 
                    { type: 'image_url', image_url: { url: imageUrl } }
                ] 
            }],
            model: 'qwen/qwen3.8-27b',
            temperature: 0.1
        });

        let content = completion.choices[0]?.message?.content || '';
        console.log("[AI] Groq Raw Content Received:", content.substring(0, 100) + "...");

        // Robust JSON extraction
        content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            console.error("[AI] Error: AI output does not contain a JSON object");
            throw new Error('AI did not return valid JSON results.');
        }

        try {
            const resultData = JSON.parse(jsonMatch[0]);
            console.log("[AI] Analysis Successful:", resultData.disease_name);
            res.json({ success: true, data: resultData });
        } catch (parseErr) {
            console.error("[AI] JSON Parse Error:", parseErr.message, "Content:", jsonMatch[0]);
            throw new Error('Failed to parse AI medical report.');
        }
    } catch (err) {
        console.error("[AI] Groq Vision Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}

async function handleVoiceAssistant(req, res) {
    console.log("[AI] Starting Voice Assistant Processing...");
    let query = req.body.query;
    const audioBytes = req.body.file || req.body.audioBytes;
    
    console.log(`[AI] Input: query="${query}", audio=${audioBytes ? audioBytes.length + ' bytes' : 'none'}`);

    const groq = getGroqClient();
    if (!groq) {
        return res.status(503).json({ success: false, error: 'AI service not configured. Set GROQ_API_KEY.' });
    }

    try {
        // If query is missing but audio is provided, transcribe first
        if ((!query || query === "undefined" || query === "null") && audioBytes && Buffer.isBuffer(audioBytes)) {
            console.log("[AI] Transcribing audio with Whisper...");
            const tempPath = path.join(os.tmpdir(), `voice_cmd_${Date.now()}.webm`);
            fs.writeFileSync(tempPath, audioBytes);
            
            const transcription = await groq.audio.transcriptions.create({
                file: fs.createReadStream(tempPath),
                model: 'whisper-large-v3',
                response_format: 'json',
                language: req.body.preferred_language || 'en'
            });
            
            query = transcription.text;
            console.log("[AI] Whisper Transcribed Text:", query);
            fs.unlinkSync(tempPath); // Cleanup
        }

        if (!query || query.trim().length === 0 || query === "undefined") {
            console.warn("[AI] Error: Empty or invalid query after processing");
            return res.status(400).json({ success: false, error: 'No query provided' });
        }

        console.log("[AI] Calling Groq LLM with query:", query.substring(0, 50) + "...");
        const completion = await groq.chat.completions.create({
            messages: [{ 
                role: 'system', 
                content: 'You are AgriSmart Brain, an AI agricultural assistant. You help farmers with crop advice, weather info, and farm management. Respond only in JSON with fields: "speech" (natural text), "action" (NAVIGATE, CONTROL_PUMP, START_SCAN, or NONE), and "params" (object). Valid NAVIGATE targets are: agriSmart, market, scan, dash, farmer_tools, schemes, health, community, marketplace, irrigation, expenses, profile, todo, weather, crop_advisor. Use these targets in params.target when action is NAVIGATE.' 
            }, { 
                role: 'user', 
                content: String(query) // Force string 
            }],
            model: 'openai/gpt-oss-120b',
            response_format: { type: 'json_object' }
        });

        const content = completion.choices[0].message.content;
        console.log("[AI] Groq LLM Response:", content.substring(0, 100) + "...");
        const result = JSON.parse(content);
        const audioBase64 = await googleTTS.getAudioBase64(result.speech.substring(0, 200), { lang: 'en' });
        res.json({ success: true, data: { ...result, query, audio_base64: audioBase64 } });
    } catch (err) {
        console.error("[AI] Voice Assistant Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
}

async function handleSoilHealth(req, res) {
    const { soilType, state } = req.body;
    const groq = getGroqClient();
    if (!groq) {
        return res.status(503).json({ success: false, error: 'AI service not configured. Set GROQ_API_KEY.' });
    }
    try {
        const completion = await groq.chat.completions.create({
            messages: [{ 
                role: 'system', 
                content: 'You are a Soil Health Expert. Analyze soil type and state, and return a JSON object with: "score" (0-100), "status" (Excellent, Good, Fair, Poor), "recommendations" (array), and "next_steps" (array).' 
            }, { 
                role: 'user', 
                content: `Soil Type: ${soilType}, Region: ${state}` 
            }],
            model: 'openai/gpt-oss-120b',
            response_format: { type: 'json_object' }
        });
        res.json({ success: true, data: JSON.parse(completion.choices[0].message.content) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = { handleConversationalCrop, handleCropRecommendation, handleDiseaseDetection, handleVoiceAssistant, handleSoilHealth };
