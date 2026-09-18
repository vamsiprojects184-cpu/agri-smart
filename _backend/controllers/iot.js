/**
 * AgriSmart Virtual IoT Farm Simulation + Kisan AI Decision Engine
 * Controller: controllers/iot.js
 * Hardware-ready architecture compatible with both browser simulation and ESP32/MQTT.
 */
const { runDB, queryDB } = require('../database');

// In-memory state for ultra-fast, real-time telemetry and closed-loop control
const state = {
    sensors: {
        soil_moisture: 28,      // %
        temperature: 29.5,      // °C
        humidity: 62,           // %
        water_level: 75,        // %
        rain_probability: 15,   // %
        soil_ph: 6.8,
        npk: { n: 140, p: 32, k: 175 },
        light_lux: 34500,
        water_flow: 0,          // L/min
        source: 'Virtual Simulator (ESP32-Ready)',
        last_update: new Date().toISOString()
    },
    actuators: {
        pump: false,            // Pump state (true = ON, false = OFF)
        flow_rate: 72,          // L/min when active
        target_moisture: 30,    // Target moisture % to reach before auto-cutoff
        auto_mode: true,        // AI Autonomous mode
        emergency_stop: false,  // Hard cutoff flag
        pump_started_at: null,  // Timestamp when pump turned on
        max_runtime_sec: 1800   // 30 min safety cutoff
    },
    history: [],
    events: [
        { id: 1, type: 'info', icon: 'ph-cpu', message: 'Kisan AI Virtual IoT Farm Brain initialized.', timestamp: new Date(Date.now() - 360000).toISOString() },
        { id: 2, type: 'success', icon: 'ph-broadcast', message: 'Virtual sensor network connected (Node 101 - North Sector).', timestamp: new Date(Date.now() - 180000).toISOString() }
    ],
    simulation_running: false,
    active_scenario: 'healthy'
};

// Seed initial history
for (let i = 10; i >= 0; i--) {
    const time = new Date(Date.now() - i * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    state.history.push({
        time,
        soil_moisture: Math.round(27 + Math.sin(i) * 2),
        temperature: Math.round(29 + Math.cos(i) * 1.5),
        humidity: Math.round(62 + Math.sin(i) * 3),
        water_level: 75
    });
}

// Log event helper
function logEvent(type, icon, message) {
    const event = {
        id: Date.now(),
        type,
        icon,
        message,
        timestamp: new Date().toISOString()
    };
    state.events.unshift(event);
    if (state.events.length > 50) state.events.pop();

    // Async SQLite persistence (safe fail)
    runDB("INSERT INTO iot_events (type, message, icon) VALUES (?, ?, ?)", [type, message, icon]).catch(() => {});
    return event;
}

// Multi-factor Kisan AI Decision Engine
function evaluateFarmConditions(sensors = state.sensors, actuators = state.actuators) {
    const moisture = Number(sensors.soil_moisture);
    const temp = Number(sensors.temperature);
    const humidity = Number(sensors.humidity);
    const tank = Number(sensors.water_level);
    const rain = Number(sensors.rain_probability);
    const targetMoisture = Number(actuators.target_moisture || 30);

    // 1. Safety Block: Emergency Stop
    if (actuators.emergency_stop) {
        return {
            status: 'CRITICAL',
            status_code: 'critical',
            badge_color: 'danger',
            reason: 'Emergency Stop is actively engaged. All farm actuators are strictly locked.',
            recommendation: 'Inspect physical field perimeter before disengaging Emergency Stop.',
            action: 'PUMP_BLOCK',
            confidence: 1.0,
            safety_passed: false,
            timestamp: new Date().toISOString()
        };
    }

    // 2. Safety Block: Low Water Level in Tank (< 20%)
    if (tank < 20) {
        return {
            status: 'WARNING',
            status_code: 'warning',
            badge_color: 'warning',
            reason: `Water tank level is critically low (${tank}%). Operating pump risks cavitation and pump motor burnout.`,
            recommendation: 'Refill farm reservoir or switch to alternate water bore before starting irrigation.',
            action: 'PUMP_BLOCK',
            confidence: 0.98,
            safety_passed: false,
            timestamp: new Date().toISOString()
        };
    }

    // 3. Closed-loop: If pump is currently running and target moisture is reached
    if (actuators.pump && moisture >= targetMoisture) {
        return {
            status: 'HEALTHY',
            status_code: 'healthy',
            badge_color: 'success',
            reason: `Target soil moisture (${targetMoisture}%) has been reached. Current reading: ${moisture}%.`,
            recommendation: 'Stop irrigation pump to conserve water and prevent soil waterlogging.',
            action: 'PUMP_OFF',
            confidence: 0.97,
            safety_passed: true,
            timestamp: new Date().toISOString()
        };
    }

    // 4. Rain Expected: Delay Irrigation
    if (moisture < 22 && rain >= 70) {
        return {
            status: 'ATTENTION',
            status_code: 'attention',
            badge_color: 'info',
            reason: `Soil moisture is low (${moisture}%), but weather forecast indicates high probability of rain (${rain}%).`,
            recommendation: 'Delay irrigation by 12–24 hours to prevent runoff and conserve groundwater.',
            action: 'DELAY_IRRIGATION',
            confidence: 0.92,
            safety_passed: true,
            timestamp: new Date().toISOString()
        };
    }

    // 5. Heat Stress Alert
    if (temp >= 40 && humidity <= 35) {
        return {
            status: 'WARNING',
            status_code: 'warning',
            badge_color: 'warning',
            reason: `Severe heat stress detected (${temp}°C, ${humidity}% RH). Stomatal closure risk and high transpiration detected.`,
            recommendation: 'Activate micro-sprinklers for canopy cooling and ensure optimal root moisture.',
            action: moisture < 25 ? 'PUMP_ON' : 'SHADE_ALERT',
            confidence: 0.95,
            safety_passed: true,
            timestamp: new Date().toISOString()
        };
    }

    // 6. Disease / Fungal Spore Risk
    if (humidity >= 85 && temp >= 25 && temp <= 32) {
        return {
            status: 'ATTENTION',
            status_code: 'attention',
            badge_color: 'warning',
            reason: `High relative humidity (${humidity}%) and warm temperatures (${temp}°C) create ideal conditions for fungal blight spores.`,
            recommendation: 'Do not irrigate overhead. Apply preventive organic neem/bio-fungicide spray and improve airflow.',
            action: 'DISEASE_RISK_ALERT',
            confidence: 0.91,
            safety_passed: true,
            timestamp: new Date().toISOString()
        };
    }

    // 7. Low Soil Moisture -> Irrigation Required
    if (moisture < 22) {
        return {
            status: 'ATTENTION',
            status_code: 'attention',
            badge_color: 'warning',
            reason: `Soil moisture (${moisture}%) is below the configured crop threshold (22%). Rain probability is low (${rain}%) and water reservoir is sufficient (${tank}%).`,
            recommendation: `Start irrigation immediately to reach target moisture of ${targetMoisture}%.`,
            action: 'PUMP_ON',
            confidence: 0.94,
            safety_passed: true,
            timestamp: new Date().toISOString()
        };
    }

    // 8. Normal / Optimal Range
    return {
        status: 'HEALTHY',
        status_code: 'healthy',
        badge_color: 'success',
        reason: `Soil moisture (${moisture}%), temperature (${temp}°C), and humidity (${humidity}%) are in the optimal agronomic zone.`,
        recommendation: 'Conditions are stable. Continue autonomous monitoring.',
        action: actuators.pump ? 'PUMP_OFF' : 'NONE',
        confidence: 0.96,
        safety_passed: true,
        timestamp: new Date().toISOString()
    };
}

// Closed-loop simulation tick: gradually adjust readings based on pump state
function applyClosedLoopStep() {
    if (state.actuators.pump && !state.actuators.emergency_stop) {
        // Pump is pumping water!
        state.sensors.water_flow = state.actuators.flow_rate;
        
        // Increase moisture gradually (+1.5% to +2.5% per step)
        const oldMoisture = state.sensors.soil_moisture;
        state.sensors.soil_moisture = Math.min(100, Math.round((oldMoisture + 2.0) * 10) / 10);
        
        // Water tank depletes slightly (-0.5% per step)
        state.sensors.water_level = Math.max(0, Math.round((state.sensors.water_level - 0.4) * 10) / 10);
        
        state.sensors.last_update = new Date().toISOString();

        // Check if target moisture reached
        if (state.sensors.soil_moisture >= state.actuators.target_moisture) {
            state.actuators.pump = false;
            state.sensors.water_flow = 0;
            logEvent('success', 'ph-check-circle', `Target moisture of ${state.actuators.target_moisture}% reached! Closed-loop automatically stopped pump.`);
        }
    } else {
        state.sensors.water_flow = 0;
    }
}

// Controller Handlers
async function handleGetSensors(req, res) {
    applyClosedLoopStep();
    const decision = evaluateFarmConditions(state.sensors, state.actuators);
    res.json({
        success: true,
        data: {
            sensors: state.sensors,
            actuators: state.actuators,
            decision,
            active_scenario: state.active_scenario
        }
    });
}

async function handleUpdateSensors(req, res) {
    const updates = req.body;
    let changed = false;

    ['soil_moisture', 'temperature', 'humidity', 'water_level', 'rain_probability', 'soil_ph'].forEach(key => {
        if (updates[key] !== undefined) {
            state.sensors[key] = Math.round(Number(updates[key]) * 10) / 10;
            changed = true;
        }
    });

    if (updates.source) state.sensors.source = updates.source;
    state.sensors.last_update = new Date().toISOString();

    if (changed) {
        // Record telemetry point
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        state.history.push({
            time,
            soil_moisture: state.sensors.soil_moisture,
            temperature: state.sensors.temperature,
            humidity: state.sensors.humidity,
            water_level: state.sensors.water_level
        });
        if (state.history.length > 25) state.history.shift();

        // Async persist to SQLite
        runDB(
            "INSERT INTO sensor_readings (soil_moisture, temperature, humidity, water_level, rain_probability, source) VALUES (?, ?, ?, ?, ?, ?)",
            [state.sensors.soil_moisture, state.sensors.temperature, state.sensors.humidity, state.sensors.water_level, state.sensors.rain_probability, state.sensors.source]
        ).catch(() => {});
    }

    // Evaluate new decision
    const decision = evaluateFarmConditions(state.sensors, state.actuators);

    // Auto-mode closed-loop trigger
    if (state.actuators.auto_mode && !state.actuators.emergency_stop) {
        if (decision.action === 'PUMP_ON' && !state.actuators.pump) {
            state.actuators.pump = true;
            state.sensors.water_flow = state.actuators.flow_rate;
            logEvent('info', 'ph-drop', `Kisan AI Auto-Mode: Started irrigation pump (${decision.reason})`);
        } else if (decision.action === 'PUMP_OFF' && state.actuators.pump) {
            state.actuators.pump = false;
            state.sensors.water_flow = 0;
            logEvent('success', 'ph-stop-circle', `Kisan AI Auto-Mode: Stopped irrigation pump.`);
        }
    }

    res.json({
        success: true,
        data: {
            sensors: state.sensors,
            actuators: state.actuators,
            decision
        }
    });
}

async function handleLoadScenario(req, res) {
    const { scenario } = req.body;
    state.active_scenario = scenario;

    switch (scenario) {
        case 'dry':
            state.sensors.soil_moisture = 12;
            state.sensors.temperature = 36;
            state.sensors.humidity = 35;
            state.sensors.rain_probability = 5;
            state.sensors.water_level = 70;
            logEvent('warning', 'ph-sun-dim', 'Loaded Scenario: Dry Farm (Moisture 12%, Temp 36°C).');
            break;
        case 'rain':
            state.sensors.soil_moisture = 18;
            state.sensors.temperature = 30;
            state.sensors.humidity = 70;
            state.sensors.rain_probability = 85;
            state.sensors.water_level = 80;
            logEvent('info', 'ph-cloud-rain', 'Loaded Scenario: Rain Coming (85% Rain Forecast).');
            break;
        case 'healthy':
            state.sensors.soil_moisture = 30;
            state.sensors.temperature = 27;
            state.sensors.humidity = 65;
            state.sensors.rain_probability = 30;
            state.sensors.water_level = 85;
            logEvent('success', 'ph-plant', 'Loaded Scenario: Healthy Farm (Moisture 30%, Temp 27°C).');
            break;
        case 'heat':
            state.sensors.soil_moisture = 15;
            state.sensors.temperature = 42;
            state.sensors.humidity = 30;
            state.sensors.rain_probability = 0;
            state.sensors.water_level = 65;
            logEvent('danger', 'ph-flame', 'Loaded Scenario: Heat Stress (42°C High Heat Alert).');
            break;
        case 'disease':
            state.sensors.soil_moisture = 28;
            state.sensors.temperature = 28;
            state.sensors.humidity = 88;
            state.sensors.rain_probability = 45;
            state.sensors.water_level = 90;
            logEvent('warning', 'ph-bug', 'Loaded Scenario: Disease Spore Risk (Humidity 88%).');
            break;
        default:
            return res.status(400).json({ success: false, message: 'Unknown scenario' });
    }

    state.sensors.last_update = new Date().toISOString();
    const decision = evaluateFarmConditions(state.sensors, state.actuators);

    // If auto mode is on and pump should activate or stop
    if (state.actuators.auto_mode && !state.actuators.emergency_stop) {
        if (decision.action === 'PUMP_ON') {
            state.actuators.pump = true;
            state.sensors.water_flow = state.actuators.flow_rate;
            logEvent('info', 'ph-drop', 'Kisan AI: Irrigation activated automatically for scenario.');
        } else if (decision.action === 'PUMP_OFF' || decision.action === 'DELAY_IRRIGATION') {
            state.actuators.pump = false;
            state.sensors.water_flow = 0;
        }
    }

    res.json({
        success: true,
        data: {
            scenario,
            sensors: state.sensors,
            actuators: state.actuators,
            decision
        }
    });
}

async function handlePumpControl(req, res) {
    const { status, target_moisture } = req.body;
    const isTurningOn = Boolean(status);

    if (target_moisture) {
        state.actuators.target_moisture = Number(target_moisture);
    }

    // Safety validation
    if (isTurningOn) {
        if (state.actuators.emergency_stop) {
            return res.status(403).json({
                success: false,
                error: 'Action blocked by Safety Layer: Emergency Stop is active.'
            });
        }
        if (state.sensors.water_level < 20) {
            return res.status(403).json({
                success: false,
                error: `Action blocked by Safety Layer: Water tank level (${state.sensors.water_level}%) is too low.`
            });
        }
    }

    state.actuators.pump = isTurningOn;
    state.sensors.water_flow = isTurningOn ? state.actuators.flow_rate : 0;
    state.actuators.pump_started_at = isTurningOn ? new Date().toISOString() : null;

    logEvent(
        isTurningOn ? 'info' : 'warning',
        isTurningOn ? 'ph-drop' : 'ph-stop-circle',
        `Irrigation Pump turned ${isTurningOn ? 'ON' : 'OFF'} manually.`
    );

    // SQLite persist
    runDB(
        "INSERT INTO farm_actions (actuator, state, reason, source) VALUES (?, ?, ?, ?)",
        ['irrigation_pump', isTurningOn ? 'ON' : 'OFF', 'Manual operator switch', 'user_web']
    ).catch(() => {});

    const decision = evaluateFarmConditions(state.sensors, state.actuators);
    res.json({
        success: true,
        message: `Irrigation pump turned ${isTurningOn ? 'ON' : 'OFF'}.`,
        data: {
            actuators: state.actuators,
            sensors: state.sensors,
            decision
        }
    });
}

async function handleToggleAutoMode(req, res) {
    const { auto_mode } = req.body;
    state.actuators.auto_mode = Boolean(auto_mode);

    logEvent(
        'info',
        'ph-robot',
        `Kisan AI Autonomous Mode ${state.actuators.auto_mode ? 'ENABLED' : 'DISABLED'}.`
    );

    res.json({
        success: true,
        data: {
            auto_mode: state.actuators.auto_mode
        }
    });
}

async function handleEmergencyStop(req, res) {
    const { release } = req.body;
    state.actuators.emergency_stop = !release;

    if (state.actuators.emergency_stop) {
        state.actuators.pump = false;
        state.sensors.water_flow = 0;
        logEvent('danger', 'ph-warning-octagon', 'EMERGENCY STOP ACTIVATED! All actuators immediately severed.');
    } else {
        logEvent('info', 'ph-shield-check', 'Emergency stop released. Normal controls restored.');
    }

    const decision = evaluateFarmConditions(state.sensors, state.actuators);
    res.json({
        success: true,
        data: {
            emergency_stop: state.actuators.emergency_stop,
            actuators: state.actuators,
            decision
        }
    });
}

async function handleGetHistory(req, res) {
    res.json({
        success: true,
        data: state.history
    });
}

async function handleGetEvents(req, res) {
    res.json({
        success: true,
        data: state.events
    });
}

async function handleEvaluateDecision(req, res) {
    const decision = evaluateFarmConditions(state.sensors, state.actuators);
    res.json({
        success: true,
        data: decision
    });
}

module.exports = {
    handleGetSensors,
    handleUpdateSensors,
    handleLoadScenario,
    handlePumpControl,
    handleToggleAutoMode,
    handleEmergencyStop,
    handleGetHistory,
    handleGetEvents,
    handleEvaluateDecision,
    evaluateFarmConditions,
    state
};
