const fetch = require('node-fetch');
const Groq = require('groq-sdk');

const STATE_COORDS = {
    "Telangana": { lat: 17.385, lon: 78.486 },
    "Andhra Pradesh": { lat: 15.912, lon: 79.740 },
    "Maharashtra": { lat: 19.751, lon: 75.713 },
    "Default": { lat: 20.5937, lon: 78.9629 }
};

const BASE_URL = "https://api.open-meteo.com/v1/forecast";

let groqInstance = null;
function getGroqClient() {
    const key = process.env.GROQ_API_KEY;
    if (!key) return null;
    if (!groqInstance) groqInstance = new Groq({ apiKey: key });
    return groqInstance;
}

const getWeatherDescription = (code) => {
    if (code === 0) return "Clear sky";
    if ([1, 2, 3].includes(code)) return "Cloudy";
    if ([61, 63, 65].includes(code)) return "Rain";
    if ([95, 96, 99].includes(code)) return "Thunderstorm";
    return "Variable";
};

async function handleGetWeather(req, res) {
    try {
        const state = req.query.state || "Default";
        const wantsAdvisory = req.query.advisory === 'true';
        const coords = STATE_COORDS[state] || STATE_COORDS["Default"];
        const params = new URLSearchParams({
            latitude: coords.lat, longitude: coords.lon,
            current: "temperature_2m,relative_humidity_2m,rain,wind_speed_10m,weather_code",
            daily: "temperature_2m_max,temperature_2m_min,precipitation_sum",
            timezone: "auto", forecast_days: 7
        });
        const response = await fetch(`${BASE_URL}?${params}`);
        const data = await response.json();
        
        let aiAdvisory = "Conditions are stable. Proceed with regular farming activities.";
        
        if (wantsAdvisory) {
            const groq = getGroqClient();
            if (groq) {
                try {
                    const prompt = `Based on the following 7-day weather forecast, provide a 2-sentence agricultural advisory for farmers (focus on irrigation, pesticide timing, or crop stress):
Current Temp: ${data.current.temperature_2m}°C, Rain: ${data.current.rain}mm, Wind: ${data.current.wind_speed_10m}km/h.
7-Day Max Temps: ${data.daily.temperature_2m_max.join(', ')} °C
7-Day Rain (mm): ${data.daily.precipitation_sum.join(', ')} mm`;
                    
                    const completion = await groq.chat.completions.create({
                        messages: [{ role: 'system', content: 'You are an AI agricultural meteorologist. Do not use markdown asterisks.' }, { role: 'user', content: prompt }],
                        model: 'openai/gpt-oss-120b',
                        temperature: 0.3
                    });
                    aiAdvisory = completion.choices[0].message.content.trim();
                } catch(e) { console.error("Weather AI Error:", e); }
            }
        }

        res.json({
            success: true,
            data: {
                temperature: data.current.temperature_2m,
                humidity: data.current.relative_humidity_2m,
                description: getWeatherDescription(data.current.weather_code),
                forecast_max_temps: data.daily.temperature_2m_max,
                forecast_precipitation: data.daily.precipitation_sum,
                rain: data.current.rain,
                wind_speed: data.current.wind_speed_10m,
                advisory: aiAdvisory
            }
        });
    } catch (error) {
        res.json({ success: true, data: { temperature: 28, description: "Sunny (Mock)", advisory: "Weather services currently offline.", forecast_max_temps: [], forecast_precipitation: [] } });
    }
}

module.exports = { handleGetWeather };
