/**
 * AgriSmart Voice Command Processor
 * Primary strategy: simulate click on real sidebar .nav-item elements
 * Fallback: window.navigate() if available
 * 
 * Page IDs match actual dashboard.html onclick attributes:
 *   agriSmart, market, scan, dash, farmer_tools, schemes, health, community,
 *   marketplace, irrigation, expenses, profile, todo, weather, mandi, crop_advisor
 */
(function() {

    // Click the real sidebar / mobile nav element for a given page ID
    function goTo(pageId) {
        // Primary: click the real DOM nav item
        const navItem = document.querySelector(
            `.nav-item[onclick*="'${pageId}'"], .mobile-nav-item[onclick*="'${pageId}'"]`
        );
        if (navItem) {
            navItem.click();
            console.log('[VoiceNav] Clicked nav item for:', pageId);
            return;
        }

        // Fallback: call window.navigate directly
        if (typeof window.navigate === 'function') {
            window.navigate(pageId);
            console.log('[VoiceNav] window.navigate called for:', pageId);
            return;
        }

        console.warn('[VoiceNav] No nav item or window.navigate found for:', pageId);
    }

    function respond(msg, pageId) {
        // Speak the response
        if (window.speak) window.speak(msg);

        // Update transcript overlay
        const responseEl = document.getElementById('ai-response-text');
        if (responseEl) responseEl.innerText = msg;

        // Log to voice command history
        if (typeof logAiInteraction === 'function') logAiInteraction(msg, 'ai');

        // Navigate if a page was specified
        if (pageId) goTo(pageId);
    }

    function fallbackProcess(text) {
        if (!text || text.length < 2) return;
        text = text.toLowerCase().trim();
        console.log('[VoiceCmd Fallback] Received:', text);

        // ── NAVIGATION commands ──────────────────────────────────────────────

        // Home / Dashboard overview
        if (text.includes('home') || text.includes('agrismart home') || text.includes('start')) {
            respond('Going to Home', 'agriSmart');
        }
        // Analytics dashboard
        else if (text.includes('analytics') || text.includes('dashboard')) {
            respond('Opening Analytics Dashboard', 'dash');
        }
        // Mandi / Market prices — page ID is 'market'
        else if (text.includes('market') || text.includes('mandi') || text.includes('price') || text.includes('sell')) {
            respond('Showing Mandi Prices', 'market');
        }
        // Weather
        else if (text.includes('weather') || text.includes('forecast') || text.includes('rain')) {
            respond('Loading Weather Report', 'weather');
        }
        // Health Tracker
        else if (text.includes('health') || text.includes('family') || text.includes('medical') || text.includes('doctor')) {
            respond('Opening Family Health Tracker', 'health');
        }
        // Crop Advisor — page ID is 'crop_advisor'
        else if (text.includes('crop') || text.includes('advisor') || text.includes('recommendation') || text.includes('plant')) {
            respond('Starting AI Crop Advisor', 'crop_advisor');
        }
        // Disease Scan — page ID is 'scan'
        else if (text.includes('disease') || text.includes('scan') || text.includes('pest') || text.includes('infection')) {
            respond('Opening Disease Scanner', 'scan');
        }
        // Government Schemes — page ID is 'schemes'
        else if (text.includes('scheme') || text.includes('government') || text.includes('subsidy') || text.includes('pm kisan')) {
            respond('Fetching Government Schemes', 'schemes');
        }
        // Community / Forums — page ID is 'community'
        else if (text.includes('community') || text.includes('forum') || text.includes('post') || text.includes('social')) {
            respond('Opening Farmer Community', 'community');
        }
        // Farmer Tools
        else if (text.includes('tool') || text.includes('farmer tool') || text.includes('calculator') && !text.includes('profit')) {
            respond('Opening Farmer Tools', 'farmer_tools');
        }
        // Profit / Expenses
        else if (text.includes('profit') || text.includes('expense') || text.includes('income') || text.includes('cost')) {
            respond('Opening Profit Calculator', 'expenses');
        }
        // Smart Irrigation / Virtual Farm IoT
        else if (text.includes('irrigat') || text.includes('water pump') || text.includes('sensor') || text.includes('iot') || text.includes('farm') || text.includes('soil moisture')) {
            if (text.includes('turn on') || text.includes('start pump') || text.includes('start irrigat')) {
                if (window.IotService) window.IotService.controlPump(true);
                respond('Starting irrigation pump now.', 'iot');
            } else if (text.includes('turn off') || text.includes('stop pump') || text.includes('stop irrigat')) {
                if (window.IotService) window.IotService.controlPump(false);
                respond('Stopping irrigation pump.', 'iot');
            } else if (text.includes('auto') || text.includes('automatic')) {
                const enable = !text.includes('disable') && !text.includes('off');
                if (window.IotService) window.IotService.toggleAutoMode(enable);
                respond(`Autonomous farm mode ${enable ? 'enabled' : 'disabled'}.`, 'iot');
            } else if (text.includes('soil moisture') || text.includes('moisture')) {
                const s = window.IotService ? window.IotService.getState().sensors : null;
                const m = s ? s.soil_moisture : 28;
                respond(`Current soil moisture is ${m} percent.`, 'iot');
            } else {
                respond('Opening Smart Farm IoT dashboard.', 'iot');
            }
        }
        // Marketplace (buy/sell store)
        else if (text.includes('marketplace') || text.includes('store') || text.includes('buy seed') || text.includes('fertilizer store')) {
            respond('Opening AgriSmart Marketplace', 'marketplace');
        }
        // Todo / Tasks
        else if (text.includes('todo') || text.includes('task') || text.includes('reminder')) {
            respond('Opening your Task List', 'todo');
        }
        // Profile
        else if (text.includes('profile') || text.includes('account') || text.includes('my info')) {
            respond('Opening your Profile', 'profile');
        }

        // ── ACTION commands ──────────────────────────────────────────────────

        else if (text.includes('add member') || text.includes('new member') || text.includes('add family')) {
            goTo('health');
            setTimeout(() => {
                if (window.showAddFamilyMemberModal) window.showAddFamilyMemberModal();
                respond('Please fill in the family member details');
            }, 600);
        }
        else if (text.includes('logout') || text.includes('sign out') || text.includes('exit')) {
            respond('Logging out. Goodbye!');
            setTimeout(() => { if (window.logout) window.logout(); }, 1500);
        }

        // ── UI HELPER commands ───────────────────────────────────────────────

        else if (text.includes('scroll down')) {
            window.scrollBy({ top: 500, behavior: 'smooth' });
            respond('Scrolling down');
        }
        else if (text.includes('scroll up')) {
            window.scrollBy({ top: -500, behavior: 'smooth' });
            respond('Scrolling up');
        }
        else if (text.includes('go back') || text.includes('back')) {
            window.history.back();
            respond('Going back');
        }

        // ── FALLBACK ─────────────────────────────────────────────────────────
        else {
            if (window.speak) window.speak('I heard: ' + text + '. Try saying AgriSmart followed by a page name.');
            console.log('[VoiceCmd Fallback] No match for:', text);
            const aiIn = document.getElementById('ai-text-input');
            if (aiIn) aiIn.value = text;
        }
    }

    window.processVoiceCommand = async function(text) {
        if (!text || text.length < 2) return;
        text = text.trim();
        console.log('[VoiceCmd] Received:', text);

        const aiIn = document.getElementById('ai-text-input');
        if (aiIn) aiIn.value = text;
        
        const responseEl = document.getElementById('ai-response-text');
        if (responseEl) responseEl.innerText = 'Thinking...';

        try {
            const res = await fetch('/api/ai/voice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: text })
            });
            const result = await res.json();
            
            if (result.success && result.data) {
                const data = result.data;
                console.log('[VoiceCmd] AI Response:', data);
                
                if (window.playVoiceAudio && data.audio_base64) {
                    window.playVoiceAudio(data.speech, data.audio_base64);
                } else if (window.speak) {
                    window.speak(data.speech);
                }
                
                if (responseEl) responseEl.innerText = data.speech;
                
                if (data.action === 'NAVIGATE' && data.params && data.params.target) {
                    goTo(data.params.target);
                } else if (data.action === 'START_SCAN') {
                    goTo('scan');
                } else if (data.action === 'GET_MANDI_PRICES' || data.action === 'MARKET_QUOTES') {
                    goTo('market');
                }
                
                if (typeof window.saveAiInteractiontoHistory === 'function') {
                    window.saveAiInteractiontoHistory(text, data.speech);
                }
            } else {
                throw new Error("Invalid API response");
            }
        } catch (error) {
            console.error('[VoiceCmd] API Error, using fallback:', error);
            fallbackProcess(text);
        }
    };
})();
