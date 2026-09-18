// js/actionEngine.js
const ActionEngine = {
    execute: function(json) {
        console.log("[ActionEngine] Executing:", json);
        
        // Update context
        if (window.CommandContext) {
            window.CommandContext.update({
                crop: json.crop,
                location: json.location
            });
            
            // Fill missing from context if needed
            const context = window.CommandContext.get();
            if (!json.crop && context.crop) json.crop = context.crop;
            if (!json.location && context.location) json.location = context.location;
        }

        // Always speak the AI's generated response if provided
        if (json.speech && window.speak) {
            window.speak(json.speech);
        }
        
        // Update UI transcript to the AI's response
        const responseEl = document.getElementById('ai-response-text');
        if (responseEl && json.speech) {
            responseEl.innerText = json.speech;
        }

        const intent = json.intent;
        
        switch (intent) {
            case 'navigate':
                this.handleNavigate(json.target || json.value);
                break;
            case 'crop_price':
            case 'mandi_search':
            case 'price_prediction':
                this.handleMandiSearch(json);
                break;
            case 'weather':
                this.handleWeather(json);
                break;
            case 'crop_suggestion':
                this.handleCropSuggestion(json);
                break;
            case 'control_pump':
                if (window.IotService) window.IotService.controlPump(json.params?.status !== false);
                this.handleNavigate('iot');
                break;
            case 'farm_status':
            case 'check_farm':
                this.handleNavigate('iot');
                break;
            case 'auto_mode':
                if (window.IotService) window.IotService.toggleAutoMode(json.params?.auto_mode !== false);
                this.handleNavigate('iot');
                break;
            case 'form_fill':
                this.handleFormFill(json);
                break;
            case 'scroll':
                this.handleScroll(json);
                break;
            case 'go_back':
                window.history.back();
                break;
            case 'chat':
            case 'unknown':
            default:
                // For general questions, the speech already handled above
                if (!json.speech && window.speak) {
                    window.speak("I'm sorry, I didn't understand that command.");
                }
                break;
        }
    },

    handleNavigate: function(target) {
        if (!target) return;
        // Map target names to page IDs used by navigate()
        let pageId = null;
        
        target = target.toLowerCase();
        if (target.includes('home') || target.includes('dashboard')) pageId = 'agriSmart';
        else if (target.includes('market') || target.includes('mandi') || target.includes('price')) pageId = 'market';
        else if (target.includes('scan') || target.includes('disease')) pageId = 'scan';
        else if (target.includes('tool') || target.includes('calculator')) pageId = 'farmer_tools';
        else if (target.includes('scheme')) pageId = 'schemes';
        else if (target.includes('health') || target.includes('medical')) pageId = 'health';
        else if (target.includes('community') || target.includes('forum')) pageId = 'community';
        else if (target.includes('store') || target.includes('buy') || target.includes('marketplace')) pageId = 'marketplace';
        else if (target.includes('iot') || target.includes('farm') || target.includes('water') || target.includes('irrigat')) pageId = 'iot';
        else if (target.includes('profit') || target.includes('finance')) pageId = 'profit_intel';
        else if (target.includes('expense')) pageId = 'expenses';
        else if (target.includes('profile') || target.includes('account')) pageId = 'profile';
        else if (target.includes('task') || target.includes('todo')) pageId = 'todo';
        else if (target.includes('weather')) pageId = 'weather_page';
        
        if (pageId && window.navigate) {
            window.navigate(pageId);
        } else {
            console.warn("[ActionEngine] Unknown navigate target:", target);
        }
    },

    handleMandiSearch: function(json) {
        // We no longer automatically navigate to the market page for informational queries.
        // We just let the AI speak the answer.
        
        // If we happen to already be on the market page (or if the elements exist), update the UI visuals:
        if (window.fetchLiveMandiPrices) {
            // Need to set crop and fetch
            const cp = document.getElementById('market-crop');
            if (cp && json.crop) {
               cp.value = json.crop.toLowerCase();
            }
            const st = document.getElementById('market-state');
            if (st && json.location) {
               st.value = json.location; // Might need mapping
            }
            window.fetchLiveMandiPrices();
        }
    },

    handleWeather: function(json) {
        if (window.navigate) window.navigate('weather_page');
        if (window.refreshWeather) window.refreshWeather();
    },

    handleCropSuggestion: function(json) {
        if (window.navigate) window.navigate('crop_advisor');
        if (window.triggerVoiceCropInput) {
            setTimeout(() => window.triggerVoiceCropInput(), 500);
        }
    },

    handleFormFill: function(json) {
        // Find inputs by placeholder or id roughly matching json.target
        if (json.target && json.value) {
            const inputs = document.querySelectorAll('input, select, textarea');
            let filled = false;
            inputs.forEach(input => {
                if ((input.id && input.id.toLowerCase().includes(json.target.toLowerCase())) || 
                    (input.placeholder && input.placeholder.toLowerCase().includes(json.target.toLowerCase()))) {
                    input.value = json.value;
                    filled = true;
                }
            });
            if (filled) console.log(`[ActionEngine] Filled ${json.target} with ${json.value}`);
        }
    },

    handleScroll: function(json) {
        let direction = json.target || json.value || 'down';
        if (direction.includes('up')) {
            window.scrollBy({ top: -500, behavior: 'smooth' });
        } else {
            window.scrollBy({ top: 500, behavior: 'smooth' });
        }
    }
};

window.ActionEngine = ActionEngine;
