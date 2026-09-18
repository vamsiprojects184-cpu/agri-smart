/**
 * AgriSmart Virtual IoT Farm Simulation + Kisan AI Decision Engine Client
 * File: js/iotService.js
 * Hardware-compatible architecture (ESP32/MQTT-ready abstraction)
 */
window.IotService = (function() {
    let state = {
        sensors: {
            soil_moisture: 28,
            temperature: 29.5,
            humidity: 62,
            water_level: 75,
            rain_probability: 15,
            soil_ph: 6.8,
            npk: { n: 140, p: 32, k: 175 },
            light_lux: 34500,
            water_flow: 0,
            source: 'Virtual Simulator',
            last_update: new Date().toISOString()
        },
        actuators: {
            pump: false,
            flow_rate: 72,
            target_moisture: 30,
            auto_mode: true,
            emergency_stop: false
        },
        decision: {
            status: 'HEALTHY',
            reason: 'Farm conditions normal.',
            recommendation: 'Continue monitoring.',
            action: 'NONE',
            confidence: 0.95
        },
        active_scenario: 'healthy'
    };

    let pollingInterval = null;
    let liveSimulationInterval = null;
    let isLiveSimulating = true;
    let telemetryChart = null;
    let isRunningDemoFlow = false;

    // Initialize IoT module
    function init() {
        console.log('[IotService] Initializing Virtual IoT Farm...');
        fetchSensors();
        bindSliderEvents();
        initTelemetryChart();
        startPolling();
        startLiveSimulation();
        fetchEvents();
    }

    // Polling backend state
    function startPolling() {
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(() => {
            // Only poll if IoT section or irrigation section is visible/active
            const iotSection = document.getElementById('iot') || document.getElementById('irrigation');
            if (iotSection && iotSection.classList.contains('active')) {
                fetchSensors();
                fetchEvents();
            }
        }, 3000);
    }

    // Live continuous simulation tick (gradual sensor drifts + closed-loop pump moisture boost)
    function startLiveSimulation() {
        if (liveSimulationInterval) clearInterval(liveSimulationInterval);
        liveSimulationInterval = setInterval(() => {
            if (!isLiveSimulating || isRunningDemoFlow) return;

            // If pump is on, moisture increases gradually
            if (state.actuators.pump && !state.actuators.emergency_stop) {
                let currentMoist = Number(state.sensors.soil_moisture);
                let target = Number(state.actuators.target_moisture || 30);
                if (currentMoist < target) {
                    currentMoist = Math.min(target + 2, Math.round((currentMoist + 1.2) * 10) / 10);
                    let tank = Math.max(5, Math.round((Number(state.sensors.water_level) - 0.3) * 10) / 10);
                    updateSensorValues({ soil_moisture: currentMoist, water_level: tank });
                } else {
                    // Reached target
                    controlPump(false);
                }
            } else {
                // Subtle realistic environmental drift (-0.1% moisture every few ticks, slight temp jitter)
                if (Math.random() > 0.6) {
                    const driftMoist = Math.max(10, Math.round((Number(state.sensors.soil_moisture) - 0.2) * 10) / 10);
                    updateSensorValues({ soil_moisture: driftMoist }, false); // silent update
                }
            }
        }, 2000);
    }

    // Fetch sensors from backend API
    async function fetchSensors() {
        try {
            const res = await fetch('/api/iot/sensors');
            const data = await res.json();
            if (data.success && data.data) {
                state = data.data;
                renderUI();
                updateChartData();
            }
        } catch (err) {
            console.warn('[IotService] Error fetching sensors:', err);
        }
    }

    // Fetch events from backend API
    async function fetchEvents() {
        try {
            const res = await fetch('/api/iot/events');
            const data = await res.json();
            if (data.success && data.data) {
                renderEvents(data.data);
            }
        } catch (err) {
            console.warn('[IotService] Error fetching events:', err);
        }
    }

    // Update sensor readings on backend
    async function updateSensorValues(updates, reloadUI = true) {
        try {
            const res = await fetch('/api/iot/sensors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            const data = await res.json();
            if (data.success && data.data) {
                state.sensors = data.data.sensors;
                state.actuators = data.data.actuators;
                state.decision = data.data.decision;
                if (reloadUI) renderUI();
            }
        } catch (err) {
            console.error('[IotService] Update failed:', err);
        }
    }

    // Load preset demo scenario
    async function loadScenario(scenario) {
        try {
            const res = await fetch('/api/iot/scenario', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scenario })
            });
            const data = await res.json();
            if (data.success && data.data) {
                state.sensors = data.data.sensors;
                state.actuators = data.data.actuators;
                state.decision = data.data.decision;
                state.active_scenario = scenario;
                renderUI();
                syncSliderInputs();
                fetchEvents();
            }
        } catch (err) {
            console.error('[IotService] Scenario load failed:', err);
        }
    }

    // Manual pump control
    async function controlPump(status) {
        try {
            const res = await fetch('/api/iot/pump', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            const data = await res.json();
            if (data.success && data.data) {
                state.actuators = data.data.actuators;
                state.sensors = data.data.sensors;
                state.decision = data.data.decision;
                renderUI();
                fetchEvents();
            } else if (data.error) {
                alert(`⚠️ ${data.error}`);
            }
        } catch (err) {
            console.error('[IotService] Pump control failed:', err);
        }
    }

    // Toggle Auto / Manual mode
    async function toggleAutoMode(auto_mode) {
        try {
            const res = await fetch('/api/iot/auto-mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auto_mode })
            });
            const data = await res.json();
            if (data.success && data.data) {
                state.actuators.auto_mode = data.data.auto_mode;
                renderUI();
                fetchEvents();
            }
        } catch (err) {
            console.error('[IotService] Toggle auto mode failed:', err);
        }
    }

    // Trigger Emergency Stop
    async function triggerEmergencyStop(release = false) {
        try {
            const res = await fetch('/api/iot/emergency-stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ release })
            });
            const data = await res.json();
            if (data.success && data.data) {
                state.actuators = data.data.actuators;
                state.decision = data.data.decision;
                renderUI();
                fetchEvents();
            }
        } catch (err) {
            console.error('[IotService] Emergency stop failed:', err);
        }
    }

    // Hackathon "WOW" Flow: Full automated demo sequence
    async function runDemoSimulation() {
        if (isRunningDemoFlow) return;
        isRunningDemoFlow = true;

        const banner = document.getElementById('demo-flow-status');
        const updateFlow = (step, title, desc, icon = 'ph-gear') => {
            if (banner) {
                banner.style.display = 'block';
                banner.innerHTML = `
                    <div class="d-flex align-items-center gap-3">
                        <div class="spinner-border spinner-border-sm text-accent" role="status"></div>
                        <div>
                            <div class="small fw-bold text-accent"><i class="ph ${icon}"></i> STEP ${step}/5: ${title}</div>
                            <div class="small opacity-80">${desc}</div>
                        </div>
                    </div>
                `;
            }
        };

        // STEP 1: Dry Farm condition
        updateFlow(1, 'SENSE', 'Simulating parched soil conditions (14% moisture, 35°C temp)...', 'ph-sun-dim');
        await loadScenario('dry');
        await sleep(1500);

        // STEP 2: AI Evaluates
        updateFlow(2, 'THINK', 'Kisan AI Brain evaluating multi-factor inputs (Moisture < 22%, Rain: 5%, Tank: 70%)...', 'ph-brain');
        await sleep(1800);

        // STEP 3: Safety Validation & Pump Start
        updateFlow(3, 'ACT', 'Safety layer approved water level -> Activating Virtual Pump (72 L/min)...', 'ph-drop');
        await controlPump(true);
        await sleep(1200);

        // STEP 4: Closed-Loop Moisture Injection Animation
        for (let m = 16; m <= 30; m += 3) {
            updateFlow(4, 'CLOSED-LOOP SENSE', `Water flowing -> Soil moisture increasing: ${m}% -> Target: 30%`, 'ph-arrows-clockwise');
            await updateSensorValues({ soil_moisture: m, water_level: Math.max(50, 70 - (m - 14) * 0.8) });
            await sleep(1000);
        }

        // STEP 5: Target reached -> Pump cutoff & Healthy State
        updateFlow(5, 'COMPLETE', 'Target moisture 30% reached! Auto-cutoff pump. Farm Status: 🟢 HEALTHY', 'ph-check-circle');
        await controlPump(false);
        await sleep(2000);

        if (banner) {
            banner.innerHTML = `
                <div class="d-flex align-items-center justify-content-between">
                    <div class="text-success small fw-bold"><i class="ph ph-check-circle-fill"></i> Closed-Loop Simulation Completed Successfully! (Sense -> Think -> Act -> Monitor)</div>
                    <button class="btn btn-sm btn-outline-light py-0 px-2" onclick="this.parentElement.parentElement.style.display='none'">Dismiss</button>
                </div>
            `;
        }
        isRunningDemoFlow = false;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Render all UI components
    function renderUI() {
        const s = state.sensors;
        const a = state.actuators;
        const d = state.decision;

        // 1. Sensor values & progress bars
        setElText('val-soil-moist', `${s.soil_moisture}%`);
        setElWidth('bar-soil-moist', `${s.soil_moisture}%`);
        setElText('status-soil-moist', s.soil_moisture < 20 ? 'LOW' : s.soil_moisture > 50 ? 'WET' : 'OPTIMAL');
        setElColor('status-soil-moist', s.soil_moisture < 20 ? '#ef4444' : s.soil_moisture > 50 ? '#38bdf8' : '#4ade80');

        setElText('val-temp', `${s.temperature}°C`);
        setElWidth('bar-temp', `${Math.min(100, (s.temperature / 50) * 100)}%`);
        setElText('status-temp', s.temperature > 38 ? 'CRITICAL HEAT' : s.temperature > 32 ? 'HIGH' : 'NORMAL');
        setElColor('status-temp', s.temperature > 38 ? '#ef4444' : s.temperature > 32 ? '#f59e0b' : '#4ade80');

        setElText('val-humidity', `${s.humidity}%`);
        setElWidth('bar-humidity', `${s.humidity}%`);
        setElText('status-humidity', s.humidity > 80 ? 'HIGH (MOLD RISK)' : s.humidity < 40 ? 'DRY' : 'OPTIMAL');

        setElText('val-tank', `${s.water_level}%`);
        setElWidth('bar-tank', `${s.water_level}%`);
        setElText('status-tank', s.water_level < 20 ? 'CRITICAL LOW' : s.water_level < 40 ? 'LOW' : 'NORMAL');
        setElColor('status-tank', s.water_level < 20 ? '#ef4444' : s.water_level < 40 ? '#f59e0b' : '#38bdf8');

        setElText('val-rain', `${s.rain_probability}%`);
        setElWidth('bar-rain', `${s.rain_probability}%`);
        setElText('status-rain', s.rain_probability > 70 ? 'HEAVY RAIN EXPECTED' : s.rain_probability > 40 ? 'CHANCE OF RAIN' : 'CLEAR SKY');

        // Optional sensors
        setElText('val-ph', `${s.soil_ph || 6.8}`);
        setElText('val-npk', `N:${s.npk?.n || 140} P:${s.npk?.p || 32} K:${s.npk?.k || 175}`);
        setElText('val-light', `${s.light_lux ? (s.light_lux / 1000).toFixed(1) : 34}k Lux`);
        setElText('val-flow', `${s.water_flow || 0} L/min`);

        // Last updated timestamp
        const timeStr = new Date(s.last_update || Date.now()).toLocaleTimeString();
        setElText('iot-last-update', timeStr);

        // 2. Farm Status & Decision Card
        const statusBadge = document.getElementById('farm-status-badge');
        if (statusBadge) {
            statusBadge.className = `badge bg-${d.badge_color || 'success'} px-3 py-2 fs-6 rounded-pill`;
            statusBadge.innerHTML = `<i class="ph ph-circle-fill fs-6 me-1"></i> ${d.status || 'HEALTHY'}`;
        }
        setElText('farm-decision-reason', d.reason || 'Farm conditions optimal.');
        setElText('farm-decision-recom', d.recommendation || 'No action needed.');
        setElText('farm-decision-action', d.action || 'NONE');
        setElText('farm-decision-conf', `Decision Confidence: ${Math.round((d.confidence || 0.95) * 100)}%`);

        // 3. Pump & Actuator UI
        const pumpToggle = document.getElementById('iot-pump-switch');
        if (pumpToggle) pumpToggle.checked = a.pump;
        
        const pumpStateBadge = document.getElementById('iot-pump-badge');
        if (pumpStateBadge) {
            pumpStateBadge.className = a.pump ? 'badge bg-success' : 'badge bg-secondary';
            pumpStateBadge.innerText = a.pump ? 'ACTIVE (PUMPING)' : 'STANDBY (OFF)';
        }

        const autoModeToggle = document.getElementById('iot-auto-toggle');
        if (autoModeToggle) autoModeToggle.checked = a.auto_mode;

        const emergencyBtn = document.getElementById('iot-emergency-btn');
        if (emergencyBtn) {
            if (a.emergency_stop) {
                emergencyBtn.className = 'btn btn-warning w-100 fw-bold';
                emergencyBtn.innerHTML = '<i class="ph ph-lock-key-open"></i> RELEASE EMERGENCY STOP';
            } else {
                emergencyBtn.className = 'btn btn-danger w-100 fw-bold';
                emergencyBtn.innerHTML = '<i class="ph ph-warning-octagon"></i> EMERGENCY STOP';
            }
        }

        // 4. Digital Twin visual updates
        const twinField = document.getElementById('twin-field-grid');
        if (twinField) {
            if (s.soil_moisture < 20) {
                twinField.style.filter = 'sepia(0.6) hue-rotate(-20deg)'; // Dry / parched brownish tint
            } else if (s.soil_moisture > 50) {
                twinField.style.filter = 'saturate(1.4) hue-rotate(15deg)'; // Very lush/wet
            } else {
                twinField.style.filter = 'none'; // Healthy green
            }
        }

        const twinPump = document.getElementById('twin-pump-visual');
        if (twinPump) {
            if (a.pump) {
                twinPump.classList.add('pump-active-pulse');
                twinPump.style.borderColor = 'var(--accent)';
                twinPump.style.boxShadow = '0 0 25px rgba(74, 222, 128, 0.6)';
            } else {
                twinPump.classList.remove('pump-active-pulse');
                twinPump.style.borderColor = 'rgba(255,255,255,0.2)';
                twinPump.style.boxShadow = 'none';
            }
        }

        const twinTank = document.getElementById('twin-tank-bar');
        if (twinTank) twinTank.style.height = `${s.water_level}%`;
    }

    function setElText(id, text) {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
    }

    function setElWidth(id, width) {
        const el = document.getElementById(id);
        if (el) el.style.width = width;
    }

    function setElColor(id, color) {
        const el = document.getElementById(id);
        if (el) el.style.color = color;
    }

    // Render Event Timeline
    function renderEvents(events) {
        const list = document.getElementById('iot-events-list');
        if (!list) return;
        if (!events || events.length === 0) {
            list.innerHTML = '<div class="text-center opacity-50 small p-3">No recent events.</div>';
            return;
        }

        list.innerHTML = events.slice(0, 10).map(e => {
            const time = new Date(e.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            let badgeClass = 'text-accent';
            if (e.type === 'danger' || e.type === 'warning') badgeClass = 'text-warning';
            if (e.type === 'info') badgeClass = 'text-info';

            return `
                <div class="d-flex align-items-start gap-3 py-2 border-bottom border-white border-opacity-10">
                    <div class="${badgeClass} fs-5 mt-1"><i class="ph ${e.icon || 'ph-dot'}"></i></div>
                    <div class="flex-grow-1">
                        <div class="small fw-semibold">${e.message}</div>
                        <div class="x-small opacity-50">${time}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Bind slider input change events
    function bindSliderEvents() {
        const bindSlider = (id, key) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', (e) => {
                    const val = Number(e.target.value);
                    const updateObj = {};
                    updateObj[key] = val;
                    updateSensorValues(updateObj);
                });
            }
        };

        bindSlider('slider-soil-moist', 'soil_moisture');
        bindSlider('slider-temp', 'temperature');
        bindSlider('slider-humidity', 'humidity');
        bindSlider('slider-tank', 'water_level');
        bindSlider('slider-rain', 'rain_probability');
    }

    // Sync slider positions with state
    function syncSliderInputs() {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };
        setVal('slider-soil-moist', state.sensors.soil_moisture);
        setVal('slider-temp', state.sensors.temperature);
        setVal('slider-humidity', state.sensors.humidity);
        setVal('slider-tank', state.sensors.water_level);
        setVal('slider-rain', state.sensors.rain_probability);
    }

    // Telemetry Chart using Chart.js
    function initTelemetryChart() {
        const canvas = document.getElementById('iotTelemetryChart');
        if (!canvas || typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');
        if (telemetryChart) telemetryChart.destroy();

        telemetryChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['10m', '8m', '6m', '4m', '2m', 'Now'],
                datasets: [
                    {
                        label: 'Soil Moisture (%)',
                        data: [26, 27, 28, 28, 27, 28],
                        borderColor: '#4ade80',
                        backgroundColor: 'rgba(74, 222, 128, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Temperature (°C)',
                        data: [28, 29, 30, 29, 29, 30],
                        borderColor: '#f59e0b',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        tension: 0.3
                    },
                    {
                        label: 'Water Tank (%)',
                        data: [78, 77, 76, 75, 75, 75],
                        borderColor: '#38bdf8',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#f8fafc', boxWidth: 12, font: { size: 11 } }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    y: {
                        ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        min: 0,
                        max: 100
                    }
                }
            }
        });
    }

    function updateChartData() {
        if (!telemetryChart) return;
        const s = state.sensors;
        // Shift and push current reading
        const dMoist = telemetryChart.data.datasets[0].data;
        const dTemp = telemetryChart.data.datasets[1].data;
        const dTank = telemetryChart.data.datasets[2].data;

        if (dMoist.length >= 10) {
            dMoist.shift();
            dTemp.shift();
            dTank.shift();
            telemetryChart.data.labels.shift();
        }
        dMoist.push(s.soil_moisture);
        dTemp.push(s.temperature);
        dTank.push(s.water_level);
        telemetryChart.data.labels.push(new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }));
        telemetryChart.update('none');
    }

    return {
        init,
        fetchSensors,
        loadScenario,
        controlPump,
        toggleAutoMode,
        triggerEmergencyStop,
        runDemoSimulation,
        updateSensorValues,
        getState: () => state
    };
})();

// Auto-boot when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.IotService.init();
});
