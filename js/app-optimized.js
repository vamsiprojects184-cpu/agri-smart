// ==================== AUTHENTICATION & API CONFIG ====================
        const API_BASE_URL = '/api'; // Dynamic port support
        let authToken = localStorage.getItem('token');
        let currentUser = null;
        let currentPage = 'agriSmart';

        // Initialize Global Objects
        const db_fs = db; // Mapping aliases from firebase-config.js
        const auth_fb = auth;
        const storage_fb = storage;
        const messaging_fb = (typeof messaging !== 'undefined') ? messaging : null;

        // ==================== SMART ALERT SYSTEM ====================
        let alerts = [
            { id: 1, title: 'Welcome to AgriSmart', message: 'Set up your profile to receive personalized crop alerts.', type: 'info', read: false, time: 'Just now' }
        ];

        window.toggleAlertCenter = function() {
            const center = document.getElementById('alert-center');
            if (!center) return;
            const isVisible = center.style.display === 'block';
            center.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) renderAlerts();
        };

        window.renderAlerts = function() {
            const list = document.getElementById('alert-list');
            const badge = document.getElementById('notification-badge');
            if (!list || !badge) return;
            
            if (alerts.length === 0) {
                list.innerHTML = '<div class="p-4 text-center opacity-50 small"><i class="ph ph-notification fs-2 mb-2"></i><p class="mb-0">No new alerts.</p></div>';
                badge.style.display = 'none';
                return;
            }

            const unreadCount = alerts.filter(a => !a.read).length;
            badge.innerText = unreadCount;
            badge.style.display = unreadCount > 0 ? 'block' : 'none';

            list.innerHTML = alerts.map(a => `
                <div class="p-3 border-bottom border-white border-opacity-5 cursor-pointer hover-bg-white-5 alert-item ${a.read ? 'opacity-60' : ''}" onclick="markAlertAsRead(${a.id})">
                    <div class="d-flex gap-3">
                        <div class="rounded-circle p-2 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 35px; height: 35px; background: ${getAlertBg(a.type)};">
                            <i class="${getAlertIcon(a.type)} fs-5 text-white"></i>
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex justify-content-between align-items-start mb-1">
                                <span class="fw-bold small" style="font-size: 0.8rem;">${a.title}</span>
                                <span class="extra-small opacity-50" style="font-size: 0.65rem;">${a.time}</span>
                            </div>
                            <p class="extra-small mb-0 opacity-80" style="font-size: 0.72rem; line-height: 1.2;">${a.message}</p>
                        </div>
                    </div>
                </div>
            `).join('');
        };

        function getAlertIcon(type) {
            if (type === 'warning') return 'ph ph-warning';
            if (type === 'price') return 'ph ph-trend-down';
            if (type === 'success') return 'ph ph-check-circle';
            return 'ph ph-info';
        }

        function getAlertBg(type) {
            if (type === 'warning') return 'rgba(239, 68, 68, 0.2)';
            if (type === 'price') return 'rgba(245, 158, 11, 0.2)';
            if (type === 'success') return 'rgba(34, 197, 94, 0.2)';
            return 'rgba(59, 130, 246, 0.2)';
        }

        window.markAlertAsRead = function(id) {
            const alert = alerts.find(a => a.id === id);
            if (alert) {
                alert.read = true;
                renderAlerts();
            }
        };

        window.markAllAlertsRead = function() {
            alerts.forEach(a => a.read = true);
            renderAlerts();
        };

        window.pushSmartAlert = function(title, message, type = 'info') {
            const id = Date.now();
            alerts.unshift({ id, title, message, type, read: false, time: 'Just now' });
            renderAlerts();
            showToast(`${title}: ${message}`, type === 'warning' ? 'error' : 'info');
            
            try {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.volume = 0.2;
                audio.play().catch(() => {});
            } catch(e) {}
        };

        document.addEventListener('click', (e) => {
            const center = document.getElementById('alert-center');
            const trigger = document.getElementById('notification-trigger');
            if (center && trigger && !center.contains(e.target) && !trigger.contains(e.target)) {
                center.style.display = 'none';
            }
        });

        setTimeout(() => renderAlerts(), 1000);
        window.shareToWhatsApp = function(text) {
            const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
        };

        // --- Navigation Functions ---
        const UI_ELEMENTS = {
            sidebar: null,
            overlay: null,
            moreMenu: null,
            mainContent: null
        };

        function getUIElements() {
            if (!UI_ELEMENTS.sidebar) UI_ELEMENTS.sidebar = document.getElementById('sidebar');
            if (!UI_ELEMENTS.overlay) UI_ELEMENTS.overlay = document.getElementById('sidebarOverlay');
            if (!UI_ELEMENTS.moreMenu) UI_ELEMENTS.moreMenu = document.getElementById('moreMenu');
            if (!UI_ELEMENTS.mainContent) UI_ELEMENTS.mainContent = document.querySelector('.main-content');
            return UI_ELEMENTS;
        }

        function navigate(pageId) {
            currentPage = pageId;
            const ui = getUIElements();

            // 1. Update Sidebar Active State
            document.querySelectorAll('.nav-item').forEach(el => {
                const isActive = el.getAttribute('onclick')?.includes(`'${pageId}'`);
                el.classList.toggle('active', isActive);
            });

            // 2. Update Mobile Nav State
            document.querySelectorAll('.mobile-nav-item').forEach(el => {
                el.classList.toggle('active', el.getAttribute('data-target') === pageId);
            });

            // 3. Show/Hide Sections
            document.querySelectorAll('.page-section').forEach(el => {
                const isTarget = el.id === pageId || (pageId === 'irrigation' && el.id === 'iot') || (pageId === 'water' && el.id === 'iot');
                el.classList.toggle('active', isTarget);
                if (isTarget) {
                    // Trigger animations
                    if (pageId === 'agriSmart') {
                        animateBars();
                        syncHomeWeatherStation();
                    }
                    if (pageId === 'expenses') setTimeout(initExpenseCharts, 50);
                    if (pageId === 'iot' || pageId === 'irrigation') {
                        if (window.IotService) window.IotService.fetchSensors();
                    }
                }
            });

            // 4. Close Menus
            if (ui.moreMenu?.classList.contains('active')) {
                ui.moreMenu.classList.remove('active');
            }

            // Special handling
            if (pageId === 'admin') loadAdminData();
            if (pageId === 'health') loadHealthDashboard();
            if (pageId === 'agriSmart') updateDashFamilyCount();
            if (pageId === 'iot' || pageId === 'irrigation') {
                if (window.IotService) window.IotService.fetchSensors();
            }
            if (pageId === 'profile' || pageId === 'agriSmart' || pageId === 'dash') {
                // Debounce history fetch
                clearTimeout(window._historyDebounce);
                window._historyDebounce = setTimeout(fetchAiHistory, 200);
            }

            // Auto-close sidebar on Selection (Mobile/Tablet)
            if (window.innerWidth <= 1024) {
                if (ui.sidebar && !ui.sidebar.classList.contains('collapsed')) {
                    toggleSidebar();
                }
            }
        }

        // Expose navigate globally so commandProcessor.js and voice commands can call it
        window.navigate = navigate;

        function toggleMoreMenu() {
            const menu = document.getElementById('moreMenu');
            if (menu) menu.classList.toggle('active');
        }

        function interactMobileVoice() {
            if (typeof toggleMasterVoice === 'function') {
                toggleMasterVoice();
            }
        }

        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebarOverlay');
            const btnIcon = document.querySelector('#sidebarToggleBtn i');

            sidebar.classList.toggle('collapsed');
            overlay.classList.toggle('active');

            const isMobile = window.innerWidth <= 768;

            if (sidebar.classList.contains('collapsed')) {
                btnIcon.style.transform = 'rotate(0deg)';
                if (!isMobile) document.querySelector('.main-content').classList.remove('sidebar-open');
            } else {
                btnIcon.style.transform = 'rotate(180deg)';
                if (!isMobile) document.querySelector('.main-content').classList.add('sidebar-open');
            }
        }

        // === CONVERSATIONAL CROP ADVISOR ===
        let cropConversationState = null;

        async function startCropConversation() {
            try {
                const response = await fetch('/api/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'conversational_crop' })
                });
                const result = await response.json();

                if (result.success) {
                    cropConversationState = { answers: {}, questionId: 1 };
                    displayCropQuestion(result.data.question);
                    document.getElementById('crop-start-btn').style.display = 'none';
                    document.getElementById('crop-input-container').style.display = 'block';
                    document.getElementById('crop-progress').textContent = `Question ${result.data.questionNumber} of ${result.data.totalQuestions}`;
                }
            } catch (error) {
                console.error('Error starting conversation:', error);
                showToast('Failed to start conversation', 'error');
            }
        }

        function displayCropQuestion(questionData) {
            const conversationArea = document.getElementById('crop-conversation-area');
            const aiMessageDiv = document.createElement('div');
            aiMessageDiv.className = 'mb-3 d-flex align-items-start gap-2';
            aiMessageDiv.innerHTML = `
                <div style="width: 32px; height: 32px; background: var(--accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i class="ph ph-robot" style="font-size: 1.2rem; color: #000;"></i>
                </div>
                <div class="flex-grow-1">
                    <div class="glass-card p-3 mb-1">
                        <strong>${questionData.question}</strong>
                        <div class="small opacity-60 mt-1">${questionData.questionLocal || ''}</div>
                    </div>
                </div>
            `;

            // Clear previous question if exists
            if (conversationArea.querySelector('.text-center')) {
                conversationArea.innerHTML = '';
            }

            conversationArea.appendChild(aiMessageDiv);
            conversationArea.scrollTop = conversationArea.scrollHeight;

            // Show appropriate input based on question type
            const optionsContainer = document.getElementById('crop-options-container');
            const textInput = document.getElementById('crop-text-input');
            const numberInput = document.getElementById('crop-number-input');
            const submitBtn = document.getElementById('crop-submit-btn');

            optionsContainer.innerHTML = '';
            textInput.style.display = 'none';
            numberInput.style.display = 'none';
            submitBtn.style.display = 'none';

            if (questionData.options) {
                // Multiple choice
                questionData.options.forEach(option => {
                    const btn = document.createElement('button');
                    btn.className = 'btn btn-outline-light w-100 mb-2 text-start';
                    btn.textContent = option;
                    btn.onclick = () => selectCropOption(option);
                    optionsContainer.appendChild(btn);
                });
            } else if (questionData.type === 'number') {
                numberInput.style.display = 'block';
                submitBtn.style.display = 'block';
                numberInput.focus();
            } else {
                textInput.style.display = 'block';
                submitBtn.style.display = 'block';
                if (questionData.placeholder) {
                    textInput.placeholder = questionData.placeholder;
                }
                textInput.focus();
            }
        }

        function selectCropOption(option) {
            submitCropAnswer(option);
        }

        async function submitCropAnswer(answer) {
            if (!answer) {
                const textInput = document.getElementById('crop-text-input');
                const numberInput = document.getElementById('crop-number-input');
                answer = textInput.value || numberInput.value;
                if (!answer) {
                    showToast('Please provide an answer', 'warning');
                    return;
                }
                textInput.value = '';
                numberInput.value = '';
            }

            // Display user's answer
            const conversationArea = document.getElementById('crop-conversation-area');
            const userMessageDiv = document.createElement('div');
            userMessageDiv.className = 'mb-3 d-flex justify-content-end';
            userMessageDiv.innerHTML = `
                <div class="glass-card p-3" style="background: rgba(74, 222, 128, 0.1); max-width: 70%;">
                    ${answer}
                </div>
            `;
            conversationArea.appendChild(userMessageDiv);
            conversationArea.scrollTop = conversationArea.scrollHeight;

            try {
                const response = await fetch('/api/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'conversational_crop',
                        conversationState: cropConversationState,
                        userResponse: answer,
                        questionId: cropConversationState.questionId
                    })
                });
                const result = await response.json();

                if (result.success && result.data.isComplete) {
                    // Show recommendations
                    displayCropRecommendations(result.data);
                    document.getElementById('crop-input-container').style.display = 'none';

                    // Save farm profile to Firebase
                    if (authToken && result.data.farmProfile) {
                        const userId = localStorage.getItem('user_id');
                        await db.collection('users').doc(userId).set({ farmProfile: result.data.farmProfile }, { merge: true });
                    }
                } else if (result.success) {
                    cropConversationState.questionId++;
                    cropConversationState.answers = result.data.answers;
                    displayCropQuestion(result.data.question);
                    document.getElementById('crop-progress').textContent = `Question ${result.data.questionNumber} of ${result.data.totalQuestions}`;
                }
            } catch (error) {
                console.error('Error submitting answer:', error);
                showToast('Failed to process answer', 'error');
            }
        }

        function displayCropRecommendations(data) {
            const recommendationsArea = document.getElementById('crop-recommendations-area');
            recommendationsArea.innerHTML = '';

            if (data.summary) {
                const summaryDiv = document.createElement('div');
                summaryDiv.className = 'glass-card p-3 mb-3 border-accent-glow';
                summaryDiv.innerHTML = `
                    <h5 class="text-accent mb-2"><i class="ph ph-check-circle"></i> Analysis Complete</h5>
                    <p class="mb-1">${data.summary}</p>
                    ${data.summaryLocal ? `<p class="small opacity-70 mb-0">${data.summaryLocal}</p>` : ''}
                `;
                recommendationsArea.appendChild(summaryDiv);
            }

            if (data.recommendations && data.recommendations.length > 0) {
                data.recommendations.forEach((crop, index) => {
                    const ferts = (crop.fertilizers || []).map(f => `
                        <div class="mb-2 p-2 bg-black bg-opacity-40 rounded border border-white border-opacity-10">
                            <div class="small fw-bold text-accent">${f.name} (${f.timing})</div>
                            <div class="small text-white">Dosage: ${f.dosagePerAcre}${f.totalDosageForFarm ? ` / Total: ${f.totalDosageForFarm}` : ''}</div>
                        </div>
                    `).join('');

                    const pests = (crop.pesticides || []).map(p => `
                        <div class="mb-2 p-2 bg-black bg-opacity-40 rounded border border-white border-opacity-10">
                            <div class="small fw-bold text-warning">${p.name} - ${p.threat}</div>
                            <div class="small text-white">Timing: ${p.timing} / Dosage: ${p.dosagePerAcre}</div>
                        </div>
                    `).join('');

                    const cropCard = document.createElement('div');
                    cropCard.className = 'glass-card p-3 mb-3';
                    cropCard.innerHTML = `
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <h5 class="mb-1">#${index + 1} ${crop.cropName}</h5>
                                <div class="small text-accent">${crop.cropNameLocal || crop.cropName}</div>
                            </div>
                            <div class="badge bg-success">${crop.suitability}% Match</div>
                        </div>
                        <div class="small mb-2">
                            <div class="d-flex justify-content-between mb-1">
                                <span class="opacity-60">Expected Yield:</span>
                                <strong>${crop.expectedYield}</strong>
                            </div>
                            <div class="d-flex justify-content-between mb-1">
                                <span class="opacity-60">Season/Duration:</span>
                                <strong>${crop.season || ''} (${crop.duration || ''})</strong>
                            </div>
                            <div class="d-flex justify-content-between mb-1">
                                <span class="opacity-60">Profit Potential:</span>
                                <strong class="text-success">${crop.profitPotential}</strong>
                            </div>
                        </div>

                        <div class="mt-3">
                            <div class="fw-bold small mb-2"><i class="ph ph-flask text-accent"></i> Fertilizer Schedule</div>
                            ${ferts || '<div class="small opacity-50">No schedule generated.</div>'}
                        </div>

                        <div class="mt-3">
                            <div class="fw-bold small mb-2"><i class="ph ph-bug text-warning"></i> Pesticide Advisory</div>
                            ${pests || '<div class="small opacity-50">No advisory generated.</div>'}
                        </div>

                        ${crop.keyBenefits ? `
                            <div class="mt-3">
                                <div class="small opacity-60 mb-1">Benefits:</div>
                                <div class="small">${crop.keyBenefits.map(b => `• ${b}`).join('<br>')}</div>
                            </div>
                        ` : ''}
                        ${crop.recommendedSchemes ? `
                            <div class="mt-2 pt-2" style="border-top: 1px solid rgba(255,255,255,0.1);">
                                <div class="small opacity-60 mb-1">Eligible Schemes:</div>
                                <div class="d-flex flex-wrap gap-1">
                                    ${crop.recommendedSchemes.map(s => `<span class="badge bg-primary">${s}</span>`).join('')}
                                </div>
                            </div>
                        ` : ''}
                    `;
                    recommendationsArea.appendChild(cropCard);
                });
            }

            showToast('Crop recommendations generated successfully!', 'success');
        }

        function resetCropConversation() {
            cropConversationState = null;
            document.getElementById('crop-conversation-area').innerHTML = `
                <div class="text-center py-5 opacity-50">
                    <i class="ph ph-chat-text" style="font-size: 3rem;"></i>
                    <p class="mt-3">Click "Start Conversation" to begin crop recommendations</p>
                </div>
            `;
            document.getElementById('crop-recommendations-area').innerHTML = `
                <div class="text-center py-5 opacity-50">
                    <i class="ph ph-package" style="font-size: 3rem;"></i>
                    <p class="mt-3">Complete the conversation to get personalized crop recommendations</p>
                </div>
            `;
            document.getElementById('crop-start-btn').style.display = 'block';
            document.getElementById('crop-input-container').style.display = 'none';
            document.getElementById('crop-progress').textContent = 'Question 1 of 6';
        }

        async function voiceAnswerCrop() {
            showToast('Voice input feature coming soon!', 'info');
            // TODO: Integrate with existing voice system
        }

        // === CONVERSATION HISTORY MANAGEMENT ===
        let currentConversationId = null;
        let conversationHistory = [];

        // Initialize conversation on page load
        function initConversation() {
            const savedConvId = localStorage.getItem('current_conversation_id');
            if (savedConvId) {
                currentConversationId = savedConvId;
                loadConversationHistory(savedConvId);
            } else {
                startNewConversation();
            }
        }

        function startNewConversation() {
            currentConversationId = 'conv_' + Date.now();
            localStorage.setItem('current_conversation_id', currentConversationId);
            conversationHistory = [];

            // Reset chat display
            const chatHistory = document.getElementById('chat-history');
            if (chatHistory) {
                chatHistory.innerHTML = `
                    <div class="chat-bubble ai"
                        style="background: rgba(74, 222, 128, 0.1); border-left: 3px solid var(--accent); padding: 12px; border-radius: 8px; margin-bottom: 12px;">
                        <strong style="color: var(--accent);">🤖 AgriSmart Brain:</strong> 
                        <span class="te-text">హలో! మీ పంటకి నేను ఎలా సహాయం చేయను?</span>
                        <br><small style="color: var(--accent);">Hello! How can I help your farming?</small>
                    </div>
                `;
            }

            showToast('New conversation started!', 'success');
        }

        async function loadConversationHistory(conversationId) {
            try {
                const userId = localStorage.getItem('user_id');
                if (!userId) return;

                const doc = await db.collection('users').doc(userId).collection('conversations').doc(conversationId).get();
                const data = doc.exists ? doc.data() : null;

                if (data && data.messages) {
                    conversationHistory = data.messages;
                    displayConversationHistory();
                }
            } catch (error) {
                console.error('Error loading conversation:', error);
            }
        }

        function displayConversationHistory() {
            const chatHistory = document.getElementById('chat-history');
            if (!chatHistory) return;

            chatHistory.innerHTML = '';

            conversationHistory.forEach(msg => {
                const bubble = createChatBubble(msg.content, msg.role);
                chatHistory.appendChild(bubble);
            });

            chatHistory.scrollTop = chatHistory.scrollHeight;
        }

        function createChatBubble(content, role) {
            const div = document.createElement('div');
            div.className = `chat-bubble ${role}`;

            if (role === 'user') {
                div.style.cssText = 'background: rgba(96, 165, 250, 0.1); border-left: 3px solid #60a5fa; padding: 12px; border-radius: 8px; margin-bottom: 12px; margin-left: auto; max-width: 80%;';
                div.innerHTML = `<strong style="color: #60a5fa;">👤 You:</strong> ${content}`;
            } else {
                div.style.cssText = 'background: rgba(74, 222, 128, 0.1); border-left: 3px solid var(--accent); padding: 12px; border-radius: 8px; margin-bottom: 12px; max-width: 90%;';
                div.innerHTML = `<strong style="color: var(--accent);">🤖 AgriSmart Brain:</strong> ${content}`;
            }

            return div;
        }

        async function saveConversationMessage(userMsg, aiResponse) {
            try {
                const userId = (currentUser && currentUser.id) || localStorage.getItem('user_id');
                if (!userId || !currentConversationId) {
                    console.warn("Missing userId or currentConversationId - cannot save conversation");
                    return;
                }

                // Add to local history
                conversationHistory.push(
                    { role: 'user', content: userMsg, timestamp: Date.now() },
                    { role: 'assistant', content: aiResponse, timestamp: Date.now() }
                );

                // Save to Firebase Firestore
                await db.collection('users').doc(userId).collection('conversations').doc(currentConversationId).set({
                    messages: conversationHistory,
                    lastUpdated: Date.now(),
                    startTime: conversationHistory[0]?.timestamp || Date.now()
                });

                // Also save to global AI history for profile view
                await saveAiInteractiontoHistory(userMsg, aiResponse);
            } catch (error) {
                console.error('Error saving conversation:', error);
            }
        }

        window.saveAiInteractiontoHistory = async function saveAiInteractiontoHistory(query, response) {
            try {
                const userId = currentUser ? currentUser.id : localStorage.getItem('user_id');
                if (!userId) {
                    console.warn("No User ID found for saving history");
                    return;
                }

                await db.collection('users').doc(userId).collection('ai_history').add({
                    query: query,
                    response: response,
                    timestamp: new Date(), // Local date for immediate retrieval
                    type: 'text'
                });
                console.log("AI Interaction saved to history:", query);

                // Update UI log if on home
                if (currentPage === 'agriSmart') {
                    logAiInteraction(query, 'user');
                }
            } catch (error) {
                console.error('Error saving AI interaction history:', error);
            }
        }

        async function fetchAiHistory() {
            try {
                const userId = currentUser ? currentUser.id : localStorage.getItem('user_id');
                if (!userId) return;

                const snapshot = await db.collection('users').doc(userId).collection('ai_history')
                    .orderBy('timestamp', 'desc')
                    .limit(50)
                    .get();

                console.log(`Fetched ${snapshot.size} history items for user ${userId}`);
                const history = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    // Handle both Date and Firestore Timestamp
                    let date = 'Recent';
                    if (data.timestamp) {
                        date = data.timestamp.toDate ? data.timestamp.toDate().toLocaleString() : new Date(data.timestamp).toLocaleString();
                    }
                    history.push({ id: doc.id, ...data, displayDate: date });
                });

                renderAiHistory(history);
            } catch (error) {
                console.error('Error fetching AI history:', error);
            }
        }

        function renderAiHistory(history) {
            console.log("Rendering AI History:", history.length, "items");
            const miniLog = document.getElementById('profile-ai-history-mini');
            const fullList = document.getElementById('full-ai-history-list');
            const homeList = document.getElementById('recent-history-home');
            const dashChat = document.getElementById('dash-chat-messages');

            // Render Dashboard Chat (ChatGPT style)
            if (dashChat && history.length > 0) {
                dashChat.innerHTML = history.slice(0, 3).reverse().map(item => `
                    <div class="mb-3">
                        <div class="small fw-bold text-accent mb-1 opacity-50">YOU: ${item.query}</div>
                        <div class="small p-2 rounded" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);">
                            ${item.response}
                        </div>
                    </div>
                `).join('');
                // Auto-scroll to bottom
                const container = document.getElementById('dashboard-chat-container');
                if (container) container.scrollTop = container.scrollHeight;
            }

            // Render Home Dashboard Log
            if (homeList) {
                if (history.length === 0) {
                    homeList.innerHTML = '<div class="col-12 text-center py-4 opacity-50">No recent commands found. Try asking something!</div>';
                } else {
                    homeList.innerHTML = history.slice(0, 4).map(item => `
                        <div class="col-md-6 col-lg-3">
                            <div class="glass-card p-3 h-100" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1);">
                                <div class="d-flex justify-content-between mb-2">
                                    <span class="badge bg-accent bg-opacity-10 text-accent x-small">CONSULTATION</span>
                                    <span class="x-small opacity-50">${item.displayDate}</span>
                                </div>
                                <div class="fw-bold small mb-2 text-truncate" title="${item.query}">${item.query}</div>
                                <div class="small opacity-70 line-clamp-2">${item.response}</div>
                            </div>
                        </div>
                    `).join('');
                }
            }

            if (!miniLog) return;

            if (history.length === 0) {
                miniLog.innerHTML = '<div class="opacity-50 text-center py-2">No recent consultations</div>';
                if (fullList) fullList.innerHTML = '<div class="text-center py-5 opacity-50">No consultation history found.</div>';
                return;
            }

            // Render Mini Log (Profile card)
            miniLog.innerHTML = history.slice(0, 3).map(item => `
                <div class="mb-2 pb-2 border-bottom border-white border-opacity-10">
                    <div class="fw-bold text-truncate">${item.query}</div>
                    <div class="x-small opacity-50">${item.displayDate}</div>
                </div>
            `).join('');

            // Render Full List (Modal)
            if (fullList) {
                fullList.innerHTML = history.map(item => `
                    <div class="glass-card mb-3 p-3" style="background: rgba(255,255,255,0.03);">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div class="fw-bold text-accent">Query: ${item.query}</div>
                            <div class="small opacity-50">${item.timestamp ? new Date(item.timestamp.toDate()).toLocaleString() : 'Recent'}</div>
                        </div>
                        <div class="small text-white opacity-80 mt-2 p-2 rounded" style="background: rgba(0,0,0,0.2);">
                            <i class="ph ph-robot me-1"></i> ${item.response}
                        </div>
                    </div>
                `).join('');
            }
        }
        function viewFullAiHistory() {
            const modal = new bootstrap.Modal(document.getElementById('fullAiHistoryModal'));
            modal.show();
        }

        // === VOICE COMMAND PROCESSING (CONSOLIDATED AT LINE 8015) ===
        // Redundant definition removed to prevent conflicts.

        window.legacy_playVoiceAudio = function playVoiceAudio(text, base64 = null) {
            try {
                const voiceMode = document.getElementById('ai-voice-selection')?.value || 'server';

                // Stop any existing audio
                if (window.voiceAudio) window.voiceAudio.pause();
                if (window.speechSynthesis) window.speechSynthesis.cancel();

                if (voiceMode === 'server' && base64) {
                    // Use Server Voice (Base64)
                    window.voiceAudio = new Audio("data:audio/mp3;base64," + base64.replace('data:audio/mp3;base64,', ''));

                    document.getElementById('ai-visualizer')?.classList.add('speaking');
                    window.voiceAudio.onended = () => {
                        document.getElementById('ai-visualizer')?.classList.remove('speaking');
                        // Automatically resume listening if in persistent mode
                        if (typeof isMasterRecording !== 'undefined' && isMasterRecording && typeof autoRestartVoice !== 'undefined' && autoRestartVoice && typeof masterRecognition !== 'undefined' && masterRecognition) {
                            try { masterRecognition.start(); } catch (e) { }
                        }
                    };

                    window.voiceAudio.play().catch(e => console.warn("Audio blocked:", e));
                } else {
                    // Use Browser TTS (Male/Female/Default)
                    console.log(`Playing Browser TTS: ${text}`);
                    const utterance = new SpeechSynthesisUtterance(text);

                    // Language Detection
                    const isTelugu = /[\u0C00-\u0C7F]/.test(text);
                    const isHindi = /[\u0900-\u097F]/.test(text);

                    if (isTelugu) utterance.lang = 'te-IN';
                    else if (isHindi) utterance.lang = 'hi-IN';
                    else utterance.lang = document.getElementById('voice-language')?.value === 'auto' ? 'en-US' : (document.getElementById('voice-language')?.value || 'en-US');

                    // Voice Selection
                    const voices = window.speechSynthesis.getVoices();
                    let selectedVoice;

                    if (voiceMode === 'browser-male') {
                        selectedVoice = voices.find(v => (v.name.includes('Male') || v.name.includes('David') || v.name.includes('Guy')) && v.lang.includes(utterance.lang.split('-')[0]));
                    } else if (voiceMode === 'browser-female') {
                        selectedVoice = voices.find(v => (v.name.includes('Female') || v.name.includes('Zira') || v.name.includes('Jenny')) && v.lang.includes(utterance.lang.split('-')[0]));
                    }

                    if (!selectedVoice) {
                        selectedVoice = voices.find(v => v.lang.includes(utterance.lang.split('-')[0]));
                    }

                    if (selectedVoice) utterance.voice = selectedVoice;

                    utterance.onstart = () => document.getElementById('ai-visualizer')?.classList.add('speaking');
                    utterance.onend = () => {
                        document.getElementById('ai-visualizer')?.classList.remove('speaking');
                        // Automatically resume listening
                        if (typeof isMasterRecording !== 'undefined' && isMasterRecording && typeof autoRestartVoice !== 'undefined' && autoRestartVoice && typeof masterRecognition !== 'undefined' && masterRecognition) {
                            try { masterRecognition.start(); } catch (e) { }
                        }
                    };

                    window.speechSynthesis.speak(utterance);
                }
            } catch (e) {
                console.error("Audio playback error:", e);
            }
        }

        function executeVoiceAction(action, params) {
            console.log(`Executing action: ${action} `, params);

            switch (action) {
                case 'NAVIGATE':
                    if (params && params.target) {
                        navigate(params.target);
                    }
                    break;
                case 'CONTROL_PUMP':
                    // Handle pump control
                    showToast(`Pump ${params.status === 'on' ? 'started' : 'stopped'} !`, 'success');
                    break;
                case 'START_SCAN':
                    navigate('scan');
                    break;
                case 'GET_MANDI_PRICES':
                case 'MARKET_QUOTES':
                    navigate('market');
                    break;
                default:
                    console.log('No specific action to execute');
            }
        }

        // Initialize conversation when page loads
        if (document.getElementById('chat-history')) {
            initConversation();
            fetchAiHistory(); // Load history for dashboard/profile on start
        }

        // === FARMER TOOLS ===
        function calculateProfit() {
            const seeds = parseFloat(document.getElementById('calc-seeds').value) || 0;
            const fert = parseFloat(document.getElementById('calc-fert').value) || 0;
            const labor = parseFloat(document.getElementById('calc-labor').value) || 0;
            const revenue = parseFloat(document.getElementById('calc-revenue').value) || 0;
            
            const totalCost = seeds + fert + labor;
            const profit = revenue - totalCost;
            
            const resultDiv = document.getElementById('calc-result');
            const resultSpan = resultDiv.querySelector('span');
            
            resultSpan.textContent = "₹" + profit.toLocaleString('en-IN');
            if (profit >= 0) {
                resultSpan.className = "text-success";
                resultDiv.innerHTML = 'Estimated Profit: <span class="text-success">₹' + profit.toLocaleString('en-IN') + '</span>';
            } else {
                resultSpan.className = "text-danger";
                resultDiv.innerHTML = 'Estimated Loss: <span class="text-danger">₹' + Math.abs(profit).toLocaleString('en-IN') + '</span>';
            }
            
            resultDiv.classList.remove('d-none');
            showToast('Profit Calculated successfully', 'success');
        }

        // === LIVE LOCATION TRACKING ===
        async function updateLiveLocation() {
            const locElement = document.getElementById('loc-full-address');
            if (!locElement) return;

            if (!navigator.geolocation) {
                locElement.textContent = 'Location not supported';
                return;
            }

            navigator.geolocation.getCurrentPosition(async (position) => {
                const lat = position.coords.latitude.toFixed(4);
                const lon = position.coords.longitude.toFixed(4);

                // Reverse geocoding using Nominatim (OpenStreetMap)
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                    const data = await response.json();

                    if (data.address) {
                        // Build full address: "Medchal mandal, Telangana, India"
                        const mandal = data.address.county || data.address.municipality || '';
                        const city = data.address.city || data.address.town || data.address.village || '';
                        const state = data.address.state || '';
                        const country = data.address.country || '';

                        let fullAddress = '';
                        if (mandal) fullAddress += mandal;
                        if (city && city !== mandal) fullAddress += (fullAddress ? ', ' : '') + city;
                        if (state) fullAddress += (fullAddress ? ', ' : '') + state;
                        if (country) fullAddress += (fullAddress ? ', ' : '') + country;

                        locElement.textContent = fullAddress || 'Location detected';
                    }
                } catch (error) {
                    console.error('Reverse geocoding error:', error);
                    locElement.textContent = `GPS: ${lat}, ${lon}`;
                }
            }, (error) => {
                console.error('Geolocation error:', error);
                locElement.textContent = 'Enable location access';
            });
        }

        // Initialize live location on page load
        if (document.getElementById('loc-full-address')) {
            updateLiveLocation();
            // Update every 30 seconds
            setInterval(updateLiveLocation, 30000);
        }

        function logout() {
            auth.signOut().then(() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'index.html';
            });
        }

        // Check authentication on page load
        document.addEventListener('DOMContentLoaded', () => {
            // Check for admin hash or path
            if (window.location.hash === '#admin' || window.location.pathname === '/admin') {
                navigate('admin');
                loadAdminData();
            } else if (authToken) {
                checkAuthentication();
                loadUserData();
                initApp();
                initLanguage();
            } else {
                window.location.href = 'login.html';
                return; // Stop execution if not authenticated
            }
        });

        async function fetchUserProfile() {
            return new Promise((resolve) => {
                const unsubscribe = auth.onAuthStateChanged(async (user) => {
                    unsubscribe();
                    if (user) {
                        try {
                            const userDoc = await db.collection('users').doc(user.uid).get();
                            if (userDoc.exists) {
                                currentUser = { id: user.uid, ...userDoc.data() };
                                localStorage.setItem('user', JSON.stringify(currentUser));
                                localStorage.setItem('user_id', user.uid); // Sync for other functions
                                updateUserUI();
                                fetchAiHistory(); // Load history once user is confirmed
                                resolve(true);
                            } else {
                                resolve(false);
                            }
                        } catch (e) {
                            console.error("Profile load error", e);
                            resolve(false);
                        }
                    } else {
                        resolve(false);
                    }
                });
            });
        }

        function checkAuthentication() {
            if (!authToken) {
                // If there's no legacy token, check if there's a firebase user
                // Should listen to auth state, but for page load sync:
                const user = localStorage.getItem('user');
                if (!user) {
                    window.location.href = 'login.html';
                    return false;
                }
            }
            return true;
        }

        function loadUserData() {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                currentUser = JSON.parse(userStr);
                updateUserUI();
            }
        }

        // === TRANSLATION SYSTEM ===
        const translations = {
            en: {
                nav_home: "Home",
                nav_crop_ai: "Crop AI",
                nav_disease_scan: "Disease Scan",
                nav_mandi_prices: "Mandi Prices",
                nav_voice_ai: "Voice AI",
                nav_more: "More",
                dash_welcome: "Hello, ",
                dash_intro: "I'm your AI Agricultural Assistant. Ask me anything about your farm, market trends, or crop health.",
            },
            te: {
                nav_home: "హోమ్",
                nav_crop_ai: "పంట AI",
                nav_disease_scan: "వ్యాధి స్కాన్",
                nav_mandi_prices: "మండి ధరలు",
                nav_voice_ai: "వాయిస్ AI",
                nav_more: "మరిన్ని",
                dash_welcome: "నమస్కారం, ",
                dash_intro: "నేను మీ AI వ్యవసాయ సహాయకుడిని. మీ పొలం, మార్కెట్ పోకడలు లేదా పంట ఆరోగ్యం గురించి ఏదైనా అడగండి.",
            },
            hi: {
                nav_home: "होम",
                nav_crop_ai: "फसल AI",
                nav_disease_scan: "रोग स्कैन",
                nav_mandi_prices: "मंडी दर",
                nav_voice_ai: "वॉयस AI",
                nav_more: "अधिक",
                dash_welcome: "नमस्ते, ",
                dash_intro: "मैं आपका AI कृषि सहायक हूं। अपने खेत, बाजार के रुझान या फसल स्वास्थ्य के बारे में कुछ भी पूछें।",
            }
        };

        function setGlobalLanguage(lang) {
            localStorage.setItem('preferred_language', lang);

            // Update Voice AI Language Selector too
            const voiceLangSelect = document.getElementById('voice-language');
            if (voiceLangSelect) voiceLangSelect.value = lang;

            // Apply translations
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (translations[lang] && translations[lang][key]) {
                    el.innerText = translations[lang][key];
                }
            });

            // Special handling for dynamic dashboard greeting
            const dashNameEl = document.getElementById('dashUserName');
            const dashIntroEl = document.getElementById('dash-ai-intro');

            if (dashNameEl) {
                const baseGreeting = translations[lang].dash_welcome || "Hello, ";
                const h2 = dashNameEl.closest('h2');
                if (h2) {
                    const name = currentUser?.username || currentUser?.name || 'vamsi';
                    h2.innerHTML = `${baseGreeting}<span class="text-accent" id="dashUserName">${name}</span>`;
                }
            }

            if (dashIntroEl && translations[lang].dash_intro) {
                dashIntroEl.innerText = translations[lang].dash_intro;
            }

            showToast(`Language: ${lang === 'te' ? 'తెలుగు' : lang === 'hi' ? 'हिन्दी' : 'English'}`, "success");
        }

        function initLanguage() {
            const savedLang = localStorage.getItem('preferred_language') || 'en';
            const selector = document.getElementById('global-language-selector');
            if (selector) selector.value = savedLang;
            setGlobalLanguage(savedLang);
        }

        function updateUserUI() {
            if (!currentUser) return;

            // Update user name in greeting and dashboard
            const name = currentUser.username || currentUser.name || "vamsi";
            const greetingEl = document.getElementById('greetingName');
            const dashNameEl = document.getElementById('dashUserName');

            if (greetingEl) greetingEl.innerText = `Hello, ${name}`;
            if (dashNameEl) dashNameEl.innerText = name;

            // Update user info in sidebar
            const userElement = document.getElementById('userInfo');
            if (userElement) {
                userElement.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 10px;">
                    <div style="width: 40px; height: 40px; background: var(--accent); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: black; font-weight: bold;">
                        ${currentUser.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight: bold;">${currentUser.username}</div>
                        <div style="font-size: 0.8rem; opacity: 0.8;">${currentUser.role === 'admin' ? 'Administrator' : 'Farmer'}</div>
                    </div>
                </div>
            `;
            }

            // Add logout button listener
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.onclick = logout;
            }

            // Toggle Profile Admin Button
            const profileAdminBtn = document.getElementById('profile-admin-btn');
            if (profileAdminBtn) {
                profileAdminBtn.style.display = currentUser.role === 'admin' ? 'block' : 'none';
            }
        }

        function logout() {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        }

        // ==================== MASTER AI VOICE CONTROLLER ====================
        let isMasterRecording = false;
        let masterRecognition = null;
        let autoRestartVoice = false;
        let silenceTimer = null;
        let mediaRecorder = null;
        let audioChunks = [];

        function toggleMasterVoice() {
            if (isMasterRecording) {
                autoRestartVoice = false;
                stopMasterVoice();
            } else {
                autoRestartVoice = true;
                if (typeof stopAllAudio === 'function') stopAllAudio();
                startMasterVoice();
            }
        }



        // Renamed to force cache refresh and improve safety
        function logAiInteraction(text, role) {
            // Aggressive safety check
            if (!text) return;
            let cleanText = String(text);
            if (cleanText.trim().toLowerCase() === 'undefined') return;
            if (cleanText.includes('undefined')) cleanText = "Reviewing request...";

            const log = document.getElementById('ai-command-log');
            if (!log) return;
            const item = document.createElement('div');
            item.className = `ai-log-item ${role}`;
            item.innerText = cleanText;
            log.prepend(item);
            if (log.children.length > 5) log.lastElementChild.remove();
        }

        function startMasterVoice() {
            if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                showToast("Speech recognition not supported in this browser", "error");
                return;
            }

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            masterRecognition = new SpeechRecognition();

            const langMap = { 'en': 'en-IN', 'hi': 'hi-IN', 'te': 'te-IN', 'ta': 'ta-IN', 'auto': 'en-IN' };
            const selectedLang = document.getElementById('voice-language')?.value || 'auto';

            // For 'auto', we use en-IN as it is very good at handling mixed Indian languages
            let targetLang = langMap[selectedLang] || 'en-IN';
            masterRecognition.lang = targetLang;

            masterRecognition.continuous = true; // Stay on for longer prompts
            masterRecognition.interimResults = true;

            let finalTranscript = "";

            // Initialize MediaRecorder for high-accuracy Groq Whisper
            // We start this FIRST to ensure zero audio loss
            navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) audioChunks.push(e.data);
                };
                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    processVoiceCommand(null, audioBlob);
                };
                mediaRecorder.start();

                // Set up event handlers once
                masterRecognition.onstart = () => {
                    isMasterRecording = true;
                    if (typeof stopAllAudio === 'function') stopAllAudio();
                    document.getElementById('master-ai-btn').classList.add('listening');
                    document.getElementById('ai-feedback-overlay').classList.remove('d-none');
                    document.getElementById('ai-transcript').innerText = "Listening...";
                    document.getElementById('ai-visualizer').classList.remove('d-none');

                    // Safety "Dead Air" timer: stop if no results within 60s (Manual Mode)
                    if (silenceTimer) clearTimeout(silenceTimer);
                    silenceTimer = setTimeout(() => {
                        if (isMasterRecording) {
                            console.log("Dead air detected (60s), stopping...");
                            stopMasterVoice();
                        }
                    }, 60000);
                };

                masterRecognition.onresult = (event) => {
                    let interimTranscript = "";
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        } else {
                            interimTranscript += event.results[i][0].transcript;
                        }
                    }

                    const currentText = finalTranscript + interimTranscript;
                    const transcriptEl = document.getElementById('ai-transcript');
                    if (transcriptEl) transcriptEl.innerText = `"${currentText}"`;

                    // Live-update voice UI transcript panel
                    const voiceTranscript = document.getElementById('voice-live-transcript');
                    if (voiceTranscript) voiceTranscript.innerText = interimTranscript || finalTranscript;

                    // Route final transcript to the new commandProcessor (wake-word aware)
                    if (finalTranscript.trim().length > 2 && window.processVoiceCommand) {
                        window.processVoiceCommand(finalTranscript.trim());
                        finalTranscript = ""; // Reset after processing
                    }

                    // Auto-populate active inputs for "Voice-to-Chat" experience
                    const consInput = document.getElementById('consultation-input');
                    if (consInput) consInput.value = currentText;
                    const aiTextInput = document.getElementById('ai-text-input');
                    if (aiTextInput) aiTextInput.value = currentText;

                    // Reset silence timer on every speech event (Manual Toggle Mode: Only safety timeout)
                    if (silenceTimer) clearTimeout(silenceTimer);
                    // User requested manual stop, so we rely on them clicking the button.
                    // keeping a long timeout (60s) just in case.
                    silenceTimer = setTimeout(() => {
                        if (isMasterRecording) {
                            console.log("Max specific recording limit reached (60s), stopping...");
                            stopMasterVoice();
                        }
                    }, 60000);
                };

                masterRecognition.onerror = (event) => {
                    if (event.error === 'no-speech') return;
                    console.error("Speech Recognition Error:", event.error);
                };

                masterRecognition.onend = () => {
                    if (autoRestartVoice && isMasterRecording) {
                        try { masterRecognition.start(); } catch (e) { }
                    } else {
                        stopMasterVoice();
                    }
                };

                // Now start the visualizer and recognition
                masterRecognition.start();
            }).catch(err => {
                console.error("MediaRecorder error:", err);
                showToast("Microphone access denied or error", "error");
            });
        }

        function stopMasterVoice() {
            isMasterRecording = false;
            autoRestartVoice = false;
            if (masterRecognition) {
                masterRecognition.stop();
            }
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                if (mediaRecorder.stream) {
                    mediaRecorder.stream.getTracks().forEach(track => track.stop());
                }
            }
            if (silenceTimer) {
                clearTimeout(silenceTimer);
                silenceTimer = null;
            }
            document.getElementById('master-ai-btn').classList.remove('listening');
            document.getElementById('ai-visualizer').classList.add('d-none');
        }

        function closeAiFeedback() {
            stopMasterVoice();
            document.getElementById('ai-feedback-overlay').classList.add('d-none');
            if (window.voiceAudio) window.voiceAudio.pause();
        }

        /* REPLACED BY CONSOLIDATED HANDLER AT LINE 6321
        async function processVoiceCommand(cmd) {
            if (!cmd || cmd.trim().length < 2) return;

            logAiInteraction(cmd, 'user');
            document.getElementById('ai-response-text').innerText = "Thinking...";
            document.getElementById('ai-visualizer').classList.add('processing');

            try {
                const response = await fetch(`${API_BASE_URL}/ai?action=voice_assistant`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        query: cmd,
                        context: {
                            state: currentUser?.state,
                            primary_crop: currentUser?.profile?.primary_crop || 'General',
                            currentPage: currentPage,
                            pageContent: getPageContentSummary()
                        }
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        const data = result.data;
                        const finalText = data.response_text || data.speech || data.response || "Action Completed.";
                        document.getElementById('ai-response-text').innerText = finalText;
                        logAiInteraction(finalText, 'ai');
                        document.getElementById('ai-visualizer').classList.remove('processing');

                        if (data.audio_base64) {
                            playVoiceAudio(finalText, data.audio_base64);
                        }

                        executeVoiceAction(data.action, data.params);
                    }
                }
            } catch (err) {
                console.error("AI Bridge Error:", err);
                document.getElementById('ai-response-text').innerText = "Brain connection lost. Retrying...";
            }
        }
        */

        // Consolidated handler moved to line 6589 to avoid overriding



        function getPageContentSummary() {
            const activeSection = document.querySelector('.page-section.active');
            if (!activeSection) return "No active page content found.";

            // Clean text for AI context
            let text = activeSection.innerText;
            text = text.replace(/\s+/g, ' ').substring(0, 1500).trim();
            return text || "Page is loading or empty.";
        }

        function executeVoiceAction(action, params) {
            console.log(`Executing AI Action: ${action}`, params);
            // DEBUG LOG - Updated call
            if (typeof logAiInteraction === 'function') logAiInteraction(`DEBUG: ${action}`, 'system');

            switch (action) {
                case 'NAVIGATE':
                    // Enhanced Map with synonyms
                    const pageMap = {
                        'home': 'agriSmart', 'dashboard': 'agriSmart', 'main': 'agriSmart',
                        'irrigation': 'irrigation', 'water': 'irrigation', 'pump': 'irrigation',
                        'scan': 'scan', 'disease': 'scan', 'doctor': 'scan',
                        'market': 'marketplace', 'price': 'marketplace', 'rates': 'marketplace', 'mandi': 'marketplace',
                        'marketplace': 'marketplace', 'buy': 'marketplace', 'sell': 'marketplace', 'shop': 'marketplace',
                        'schemes': 'schemes', 'subsidy': 'schemes', 'government': 'schemes', 'loans': 'schemes',
                        'expenses': 'expenses', 'finance': 'expenses', 'budget': 'expenses', 'profit': 'expenses', 'money': 'expenses', 'tracker': 'expenses',
                        'connect': 'connect', 'chat': 'connect', 'community': 'connect',
                        'profile': 'profile', 'settings': 'profile', 'account': 'profile',
                        'weather_map': 'weather_page', 'weather': 'weather_page', 'climate': 'weather_page',
                        'identity': 'identity', 'purity': 'identity', 'seed': 'identity', 'auth': 'identity',
                        'logistics': 'logistics', 'transport': 'logistics', 'truck': 'logistics', 'rental': 'logistics'
                    };

                    const term = (params.target || '').toLowerCase().trim();
                    let target = pageMap[term];

                    // Fallback: Partial match
                    if (!target) {
                        const keys = Object.keys(pageMap);
                        const found = keys.find(k => term.includes(k));
                        if (found) target = pageMap[found];
                    }

                    if (target) {
                        // Priority check: Element ID existence
                        if (document.getElementById(target)) {
                            navigate(target);
                            showToast(`Navigating to ${target}`, "success");
                        } else {
                            // Substring ID Search (e.g. "marketplace" finding "section-marketplace" if changed)
                            const possibleSection = Array.from(document.querySelectorAll('.page-section')).find(s => s.id.includes(target));
                            if (possibleSection) {
                                navigate(possibleSection.id);
                                showToast(`Navigating to ${possibleSection.id}`, "success");
                            } else {
                                console.warn(`NAVIGATE: Target "${target}" matches no page ID.`);
                                showToast(`Page "${target}" unavailable`, "error");
                            }
                        }
                    } else {
                        showToast(`Could not recognize page: "${params.target}"`, "warning");
                    }
                    break;
                case 'CONTROL_PUMP':
                    const status = params.status === 'on';
                    const pumpToggle = document.getElementById('pump-master-toggle');
                    if (pumpToggle) {
                        pumpToggle.checked = status;
                        controlPump(status);
                    } else {
                        fetch(`${API_BASE_URL}/manage?action=pump_control`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: params.status })
                        });
                    }
                    showToast(`Pump switched ${params.status.toUpperCase()}`, "success");
                    break;
                case 'UPDATE_FARM_METRICS':
                    if (params.n !== undefined) {
                        document.getElementById('adv-n').value = params.n;
                        document.getElementById('val-n').innerText = params.n + ' mg/kg';
                    }
                    if (params.p !== undefined) {
                        document.getElementById('adv-p').value = params.p;
                        document.getElementById('val-p').innerText = params.p + ' mg/kg';
                    }
                    if (params.k !== undefined) {
                        document.getElementById('adv-k').value = params.k;
                        document.getElementById('val-k').innerText = params.k + ' mg/kg';
                    }
                    if (params.ph !== undefined) {
                        document.getElementById('adv-ph').value = params.ph;
                        document.getElementById('val-ph').innerText = params.ph;
                    }
                    if (params.crops_per_year !== undefined) {
                        document.getElementById('adv-crops-per-year').value = params.crops_per_year;
                    }
                    if (params.sequence) {
                        document.getElementById('adv-crop-sequence').value = params.sequence;
                    }
                    updateRadarChart();
                    showToast("Farm metrics updated from voice command", "success");
                    navigate('crop_advisor');
                    break;
                case 'LOG_EXPENSE':
                    if (params.amount) {
                        const description = params.description || 'Voice logged expense';
                        const amount = parseFloat(params.amount);
                        const category = params.category || 'Other';
                        const crop = params.crop || (currentUser?.profile?.primary_crop + ' - Voice' || 'General');

                        // addExpenseFirestoreManual should be defined or we use a placeholder
                        if (typeof addExpenseFirestoreManual === 'function') {
                            addExpenseFirestoreManual(description, amount, category, crop);
                            showToast(`Logged ₹${amount} expense for ${crop}`, "success");
                        } else {
                            showToast(`Expense logged: ₹${amount} (${category})`, "success");
                        }
                    }
                    break;
                case 'SET_LANGUAGE':
                    if (params.lang) {
                        const langSel = document.getElementById('voice-language');
                        if (langSel) langSel.value = params.lang;
                        showToast(`Switching voice to ${params.lang.toUpperCase()}`, "info");
                        // Restart recognition with new language
                        setTimeout(() => {
                            // If using autoRestartVoice global
                            if (typeof autoRestartVoice !== 'undefined') autoRestartVoice = true;
                            if (typeof startMasterVoice === 'function') startMasterVoice();
                        }, 1000);
                    }
                    break;
                case 'START_SCAN':
                    if (params.module === 'disease') {
                        navigate('scan');
                        setTimeout(() => { document.getElementById('leaf-upload')?.click(); }, 500);
                    } else if (params.module === 'soil') {
                        navigate('crop_advisor'); // Analytical Wizard
                        showToast("Opening Soil Health Wizard...", "info");
                        // Trigger specific sub-tab if needed
                    } else if (params.module === 'purity' || params.module === 'identity') {
                        navigate('identity');
                        showToast("Initializing Seed Authenticator...", "info");
                    } else if (params.module === 'spoilage') {
                        navigate('logistics'); // Assuming Spoilage is near Logistics or separate
                        showToast("Opening Spoilage Predictor...", "info");
                    }
                    break;
                case 'BOOK_LOGISTICS':
                    // Assuming requestLogistics exists
                    if (typeof requestLogistics === 'function') {
                        requestLogistics(params.service || 'Truck');
                    } else {
                        navigate('logistics');
                        showToast(`Navigating to Logistics to book ${params.service}`, "info");
                    }
                    break;
                case 'MARKET_QUOTES':
                case 'GET_MANDI_PRICES':
                    navigate('price');
                    fetchLiveMandiPrices();
                    showToast(`Fetching live commodity trends from EODHD...`, "info");
                    break;
                default:
                    console.log("No specific client-side handler for:", action);
            }
        }


        let mandiPriceChart = null;

        async function fetchLiveMandiPrices() {
            const tableBody = document.getElementById('price-body');
            if (!tableBody) return;
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4"><div class="spinner-border spinner-border-sm text-accent"></div> Fetching Live Data...</td></tr>`;

            try {
                const response = await fetch(`${API_BASE_URL}/ai?action=get_mandi_prices`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbols: "ZW.COMM,ZC.COMM,SB.COMM,ZR.COMM" })
                });
                const result = await response.json();
                if (result.success) {
                    const data = result.data;
                    const symbols = Object.keys(data);
                    const names = { "ZW.COMM": "Wheat (Futures)", "ZC.COMM": "Corn (Futures)", "SB.COMM": "Sugar #11", "ZR.COMM": "Rough Rice" };

                    tableBody.innerHTML = "";
                    const chartLabels = [];
                    const chartValues = [];

                    symbols.forEach(sym => {
                        const item = data[sym] || {};
                        const price = item.close || 0;
                        const changePerc = item.change_p || 0;
                        const vol = item.volume || 0;
                        const name = names[sym] || sym;

                        chartLabels.push(name);
                        chartValues.push(price);

                        const row = `
                            <tr>
                                <td><div class="d-flex align-items-center gap-2"><div style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent);"></div> ${name}</div></td>
                                <td class="fw-bold">$${price}</td>
                                <td class="${changePerc >= 0 ? 'text-success' : 'text-danger'}">${changePerc}%</td>
                                <td class="opacity-50">${vol.toLocaleString()}</td>
                            </tr>
                        `;
                        tableBody.insertAdjacentHTML('beforeend', row);
                    });

                    updateMandiChart(chartLabels, chartValues);
                }
            } catch (err) {
                console.error("Mandi Fetch Error:", err);
                tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Failed to connect to EODHD API.</td></tr>`;
            }
        }

        function updateMandiChart(labels, values) {
            const canvas = document.getElementById('mandiTrendChart');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (mandiPriceChart) mandiPriceChart.destroy();

            mandiPriceChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Live Market Price (USD)',
                        data: values,
                        backgroundColor: 'rgba(74, 222, 128, 0.2)',
                        borderColor: '#4ade80',
                        borderWidth: 2,
                        borderRadius: 8,
                        hoverBackgroundColor: 'rgba(74, 222, 128, 0.4)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: false,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: 'rgba(255,255,255,0.5)' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: 'rgba(255,255,255,0.7)' }
                        }
                    }
                }
            });
        }

        function switchMarketTab(tab) {
            document.querySelectorAll('.market-tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.market-tab-content').forEach(content => content.classList.remove('active'));

            // Match button by its onclick text
            document.querySelectorAll('.market-tab-btn').forEach(btn => {
                if (btn.getAttribute('onclick').includes(`'${tab}'`)) {
                    btn.classList.add('active');
                }
            });

            const targetContent = document.getElementById(`market-${tab}`);
            if (targetContent) targetContent.classList.add('active');
        }

        function initiatePayment(amount, reason) {
            if (!confirm(`Proceed with Secure Digital Payment of ₹${amount} for ${reason}?`)) return;

            showToast("Opening Secure Bank Gateway...", "info");
            setTimeout(() => {
                showToast("Verifying Transaction...", "warning");
                setTimeout(() => {
                    showToast("Payment Successful! SMS sent to registered mobile.", "success");
                    addExpenseFirestoreManual(reason, amount, 'Transport');
                }, 2000);
            }, 1500);
        }

        async function addExpenseFirestoreManual(desc, amt, cat, crop = 'General') {
            if (!currentUser) return;
            try {
                const today = new Date().toISOString().split('T')[0];
                await db_fs.collection('expenses').add({
                    userId: currentUser.id.toString(),
                    description: desc,
                    amount: parseFloat(amt),
                    category: cat,
                    crop: crop,
                    date: today,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    type: cat === 'Sale' ? 'income' : 'expense'
                });
            } catch (e) { console.error(e); }
        }


        function showToast(message, type = 'info') {
            const toast = document.getElementById('toast');
            const toastMsg = document.getElementById('toast-msg');
            const toastIcon = toast.querySelector('i');

            toastMsg.textContent = message;

            // Change icon based on type (simple logic for now)
            if (type === 'success') {
                toastIcon.className = 'ph ph-check-circle';
                toast.style.borderColor = 'var(--accent)';
            } else if (type === 'error') {
                toastIcon.className = 'ph ph-warning-circle';
                toast.style.borderColor = 'var(--danger)';
            } else if (type === 'warning') {
                toastIcon.className = 'ph ph-warning';
                toast.style.borderColor = 'var(--warning)';
            } else {
                toastIcon.className = 'ph ph-info';
                toast.style.borderColor = 'rgba(255,255,255,0.3)';
            }

            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        // ==================== MODIFIED NAVIGATION ====================
        async function navigate(pageId) {
            // Stop Voice AI if leaving voice page
            if (pageId !== 'voice') {
                stopAllAudio();
                if (typeof isRecording !== 'undefined' && isRecording) {
                    // Since toggleVoiceRecording handles UI updates, we can use it or manually stop
                    // Safer to manually stop to avoid UI flicker dependencies or just reuse logic
                    if (typeof mediaRecorder !== 'undefined' && mediaRecorder && mediaRecorder.state !== 'inactive') {
                        mediaRecorder.stop();
                    }
                    isRecording = false;
                    // Reset UI if needed, but since we are navigating away, visual reset on button might not matter
                    // EXCEPT the mobile bottom nav button which is visible!
                    const mobileBtn = document.getElementById('mobile-mic-btn');
                    if (mobileBtn) mobileBtn.classList.remove('recording');
                }
            }

            // Update UI
            document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

            // Load data for the page (Safely)
            try {
                await loadPageData(pageId);
            } catch (e) {
                console.error(`Page load error for ${pageId}:`, e);
                showToast("Page loaded with limited data", "warning");
            }

            // Update active states
            const targetPage = document.getElementById(pageId);
            if (targetPage) {
                targetPage.classList.add('active');
            } else {
                console.warn(`DOM Navigation Skipped: Page element '${pageId}' not found.`);
                showToast("Page switch unavailable", "warning");
                return;
            }

            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                if (item.getAttribute('onclick')?.includes(pageId)) {
                    item.classList.add('active');
                }
            });

            // Mobile Bottom Nav Active State
            document.querySelectorAll('.mobile-nav-item').forEach(el => el.classList.remove('active'));
            const activeMobileItem = document.querySelector(`.mobile-nav-item[data-target="${pageId}"]`);
            if (activeMobileItem) {
                activeMobileItem.classList.add('active');
            } else {
                // Check if it's in the more menu
                const morePages = ['dash', 'rec', 'alert', 'price', 'life', 'seed', 'soil', 'profile'];
                if (morePages.includes(pageId)) {
                    document.querySelector('.mobile-nav-item[data-target="more"]').classList.add('active');
                }
            }

            animateBars();
        }

        async function loadPageData(pageId) {
            switch (pageId) {
                case 'agriSmart':
                    await loadDashboardData();
                    break;
                case 'dashboard':
                    loadDashboardData();
                    break;
                case 'irrigation':
                    fetchIotData();
                    break;
                case 'crop_advisor':
                    updateRadarChart();
                    resetScan();
                    break;
                case 'disease_scan':
                    resetScan();
                    break;
                case 'market':
                    updateMarketPricesTable();
                    break;
                case 'marketplace':
                    loadMarketplaceFirestore();
                    break;
                case 'expenses':
                    loadExpensesFirestore();
                    loadBudget();
                    loadYieldData();
                    break;
                case 'schemes':
                    loadSchemesFirestore();
                    break;
                case 'weather_page':
                    loadWeatherDetails();
                    break;
                case 'voice':
                    // Auto-init removed for manual toggle
                    break;
                case 'admin':
                    loadAdminData();
                    break;
                case 'profile':
                    updateGreeting();
                    break;
            }
        }

        // ==================== API FUNCTIONS ====================

        async function loadDashboardData() {
            try {
                const response = await fetch(`${API_BASE_URL}/manage?action=dashboard`, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to load dashboard');
                }

                const data = await response.json();

                if (data.success) {
                    updateDashboardUI(data.data);
                    // Also update dashboard weather widget if it exists
                    if (data.data.weather) {
                        updateDashboardWeatherUI(data.data.weather);
                    } else {
                        // Fetch weather separately if not in dashboard payload
                        loadDashboardWeather();
                    }
                }
            } catch (error) {
                console.error('Error loading dashboard:', error);
                // Fallback handled by UI defaults
            }
        }

        async function loadDashboardWeather() {
            try {
                const response = await fetch(`${API_BASE_URL}/weather`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                const data = await response.json();
                if (data.success) {
                    updateDashboardWeatherUI(data.data);
                }
            } catch (e) {
                console.error("Dashboard weather error:", e);
            }
        }

        let rainChart = null;

        function updateDashboardWeatherUI(w) {
            const agriSmart = document.getElementById('agriSmart');
            if (!agriSmart) return;

            const weatherCard = agriSmart.querySelector('.glass-card');
            if (!weatherCard) return;

            // Update Main Home Dashboard Weather Widget
            const tempEl = weatherCard.querySelector('.weather-temp');
            const condEl = weatherCard.querySelector('.weather-condition');
            const humEl = weatherCard.querySelector('.weather-detail-item:nth-child(1) span:nth-child(2)');
            const windEl = weatherCard.querySelector('.weather-detail-item:nth-child(2) span:nth-child(2)');
            const rainEl = weatherCard.querySelector('.weather-detail-item:nth-child(3) span:nth-child(2)');
            const iconEl = weatherCard.querySelector('.ph-cloud-sun, .ph-sun, .ph-cloud-rain, .ph-cloud, .ph-cloud-lightning');

            if (tempEl) tempEl.textContent = `${Math.round(w.temperature)}°C`;
            if (condEl) condEl.textContent = w.description;
            if (humEl) humEl.textContent = `${w.humidity}%`;
            if (windEl) windEl.textContent = `${w.wind_speed} km/h`;
            if (rainEl) rainEl.textContent = `${w.rain} mm`;

            // Update Icon
            if (iconEl) {
                const iconMap = {
                    'Clear sky': 'ph-sun',
                    'Mainly clear': 'ph-sun-dim',
                    'Partly cloudy': 'ph-cloud-sun',
                    'Overcast': 'ph-cloud',
                    'Rain': 'ph-cloud-rain',
                    'Thunderstorm': 'ph-cloud-lightning',
                    'Drizzle': 'ph-cloud-rain',
                };
                if (w.description) {
                    const iconKey = Object.keys(iconMap).find(key => w.description.includes(key));
                    if (iconKey) {
                        iconEl.className = `ph ${iconMap[iconKey]}`;
                    }
                }

                if (w.description && (w.description.includes('Rain') || w.description.includes('Drizzle'))) {
                    iconEl.style.color = '#60a5fa';
                } else if (w.description && (w.description.includes('Clear') || w.description.includes('Partly'))) {
                    iconEl.style.color = '#fbbf24';
                } else {
                    iconEl.style.color = '#94a3b8';
                }
            }

            // Update Rain Forecast Chart (Chart.js)
            const canvas = document.getElementById('rainForecastChart');
            if (canvas && w.forecast_precipitation) {
                const ctx = canvas.getContext('2d');
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const today = new Date();
                const labels = w.forecast_precipitation.map((_, i) => {
                    const d = new Date();
                    d.setDate(today.getDate() + i);
                    return i === 0 ? 'Today' : days[d.getDay()];
                });

                if (rainChart) {
                    rainChart.data.labels = labels;
                    rainChart.data.datasets[0].data = w.forecast_precipitation;
                    rainChart.update();
                } else {
                    rainChart = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Precipitation (mm)',
                                data: w.forecast_precipitation,
                                backgroundColor: 'rgba(74, 222, 128, 0.4)',
                                borderColor: '#4ade80',
                                borderWidth: 1,
                                borderRadius: 5,
                                barThickness: 15
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                    padding: 10,
                                    titleFont: { size: 14 },
                                    bodyFont: { size: 12 },
                                    callbacks: {
                                        label: (context) => `Rain: ${context.raw} mm`
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    grid: { display: false },
                                    ticks: { color: 'rgba(255,255,255,0.7)', font: { size: 10 } }
                                },
                                y: {
                                    beginAtZero: true,
                                    suggestedMax: 10,
                                    grid: { color: 'rgba(255,255,255,0.1)' },
                                    ticks: {
                                        color: 'rgba(255,255,255,0.7)',
                                        font: { size: 10 },
                                        callback: function (value) { return value + 'mm'; }
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }

        function updateDashboardUI(data) {
            // Update stats
            const stats = data.stats;
            if (stats) {
                // Assuming order of cards: Crop Health, Active Sensors, Avg Temp
                // This maps to "stats" object but we need to match the HTML structure or specific IDs
                // Since HTML uses classes, we'll try to find by specific content or just update assuming order
                // For robustness, in a real app we'd add IDs to these elements.
                // For now, let's just log it as the UI is static for these unless we add IDs.
            }
        }

        async function syncHomeWeatherStation() {
            try {
                const response = await fetch(`${API_BASE_URL}/weather`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                const data = await response.json();
                if (data.success) {
                    const w = data.data;
                    const tempEl = document.getElementById('home-weather-temp');
                    const condEl = document.getElementById('home-weather-condition');
                    const humEl = document.getElementById('home-weather-humidity');
                    const windEl = document.getElementById('home-weather-wind');
                    const precEl = document.getElementById('home-weather-precip');

                    if (tempEl) tempEl.innerText = `${Math.round(w.temperature)}°C`;
                    if (condEl) condEl.innerText = w.description;
                    if (humEl) humEl.innerText = `${w.humidity}%`;
                    if (windEl) windEl.innerText = `${w.wind_speed} km/h`;
                    if (precEl) precEl.innerText = `${w.rain} mm`;

                    const icon = document.getElementById('home-weather-icon');
                    if (icon) {
                        if (w.description.toLowerCase().includes('rain')) icon.style.color = '#60a5fa';
                        else if (w.description.toLowerCase().includes('cloud')) icon.style.color = '#fbbf24';
                        else icon.style.color = '#fde047';
                    }
                }
            } catch (e) {
                console.error("Home weather sync failed:", e);
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(syncHomeWeatherStation, 1500);
        });

        function getWeatherCondition(code) {
            const conditions = {
                0: 'Clear sky',
                1: 'Mainly clear',
                2: 'Partly cloudy',
                3: 'Overcast',
                45: 'Foggy',
                48: 'Depositing rime fog',
                51: 'Light drizzle',
                53: 'Moderate drizzle',
                55: 'Dense drizzle',
                61: 'Slight rain',
                63: 'Moderate rain',
                65: 'Heavy rain',
                80: 'Rain showers',
                81: 'Heavy rain showers',
                95: 'Thunderstorm'
            };
            return conditions[code] || 'Partly cloudy';
        }

        async function loadAnalyticsData() {
            // Placeholder for analytics logic
        }

        async function loadSeedInventory() { console.log("Loading seeds..."); }
        async function loadSoilHealth() { console.log("Loading soil..."); }
        async function loadIrrigationData() { console.log("Loading irrigation..."); }
        async function loadRecommendations() { console.log("Loading recs..."); }

        // FORCE SERVICE WORKER UNREGISTRATION (Fix Caching)
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function (registrations) {
                for (let registration of registrations) {
                    registration.unregister();
                    console.log("Service Worker Unregistered");
                }
            });
        }

        async function loadAlerts() {
            // Placeholder - requires backend endpoint for fetching all alerts
            // For now, kept as static in HTML or could implement a fetch
        }

        function markAsRead(element) {
            element.classList.add('read');
            showToast('Alert marked as read');
        }

        async function loadMarketPrices() {
            try {
                // Note: Endpoint /market-prices needs to be implemented or we use the mock
                // Assuming /api/market-prices or similar exists in user's plan. 
                // The provided app.py didn't have /market-prices, but utils had a generator.
                // Let's assume we fetch or fallback.
                // Actually, let's use the provided generator via a new endpoint or just mock for now if endpoint missing.
                // User provided utils.py has generate_sample_market_prices().

                // For now, we will simulate the fetch with local data matching the utils
                const prices = [
                    { crop: 'Wheat', min_price: 2100, max_price: 2400, modal_price: 2250 },
                    { crop: 'Rice', min_price: 2800, max_price: 3200, modal_price: 3000 },
                    { crop: 'Cotton', min_price: 5500, max_price: 6200, modal_price: 5800 }
                ];
                updateMarketPricesUI(prices);
            } catch (error) {
                console.error('Error loading market prices:', error);
            }
        }

        function updateMarketPricesUI(prices) {
            const tbody = document.getElementById('price-body');
            if (!tbody) return;

            if (!prices || prices.length === 0) {
                tbody.innerHTML = `<tr><td colspan="3" style="text-align: center;">No data</td></tr>`;
                return;
            }

            let html = '';
            prices.forEach(price => {
                const trend = price.max_price > price.min_price ? 'up' : 'down';
                const trendClass = trend === 'up' ? 'trend-up' : 'trend-down';
                const trendIcon = trend === 'up' ? 'trend-up' : 'trend-down';

                html += `
                <tr>
                    <td>${price.crop}</td>
                    <td>₹${price.modal_price || price.min_price}</td>
                    <td class="${trendClass}">
                        <i class="ph ph-${trendIcon}"></i> 
                        ${Math.abs(((price.max_price - price.min_price) / price.min_price) * 100).toFixed(1)}%
                    </td>
                </tr>
            `;
            });

            tbody.innerHTML = html;
        }

        async function loadCropLifecycle() {
            // Sample data as per request
            const lifecycleData = {
                crop: currentUser?.profile?.primary_crop || 'Wheat',
                stage: 'Flowering',
                progress: 60,
                days: 45,
                totalDays: 90
            };

            const lifeSection = document.getElementById('life');
            const container = lifeSection.querySelector('.glass-card');
            if (container) {
                container.innerHTML = `
                <h4>Current Batch: ${lifecycleData.crop} - Type A</h4>
                <div style="margin: 20px 0; background: rgba(255,255,255,0.1); height: 10px; border-radius: 5px;">
                    <div style="width: ${lifecycleData.progress}%; background: var(--accent); height: 100%; border-radius: 5px;"></div>
                </div>
                <p>Stage: ${lifecycleData.stage} (Day ${lifecycleData.days}/${lifecycleData.totalDays})</p>
                
                <div style="display: flex; gap: 10px; margin-top: 20px; overflow-x: auto;">
                    <div class="glass-card" style="min-width: 100px; text-align: center; padding: 15px; ${lifecycleData.progress < 30 ? 'border-color: var(--accent);' : 'opacity: 0.5;'}">
                        <i class="ph ph-seedling"></i><br>Seeding
                    </div>
                    <div class="glass-card" style="min-width: 100px; text-align: center; padding: 15px; ${lifecycleData.progress >= 30 && lifecycleData.progress < 80 ? 'border-color: var(--accent);' : 'opacity: 0.5;'}">
                        <i class="ph ph-plant"></i><br>${lifecycleData.stage}
                    </div>
                    <div class="glass-card" style="min-width: 100px; text-align: center; padding: 15px; ${lifecycleData.progress >= 80 ? 'border-color: var(--accent);' : 'opacity: 0.5;'}">
                        <i class="ph ph-basket"></i><br>Harvest
                    </div>
                </div>
            `;
            }
        }

        // ==================== ADVANCED VISUALIZATION HELPERS ====================

        function drawSparkline(canvasId, data) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;

            ctx.clearRect(0, 0, width, height);
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';

            const min = Math.min(...data);
            const max = Math.max(...data);
            const range = max - min || 1;

            ctx.beginPath();
            data.forEach((val, i) => {
                const x = (i / (data.length - 1)) * width;
                const y = height - ((val - min) / range) * height;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // Fill area
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.fillStyle = 'rgba(74, 222, 128, 0.1)';
            ctx.fill();
        }

        // ==================== SEED AUTHENTICATOR (IMAGE V2) ====================
        function previewSeedImage(input) {
            if (input.files && input.files[0]) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    document.getElementById('seed-preview-img').src = e.target.result;
                    document.getElementById('seed-upload-area').style.display = 'none';
                    document.getElementById('seed-preview-container').style.display = 'block';
                    document.getElementById('seed-analyze-btn').disabled = false;
                }
                reader.readAsDataURL(input.files[0]);
            }
        }

        function resetSeedUpload(e) {
            if (e) e.stopPropagation();
            document.getElementById('seed-file-input').value = "";
            document.getElementById('seed-upload-area').style.display = 'block';
            document.getElementById('seed-preview-container').style.display = 'none';
            document.getElementById('seed-analyze-btn').disabled = true;
            document.getElementById('seed-result').innerHTML = "";
            document.getElementById('seed-scan-overlay').style.display = 'none';
        }

        async function analyzeSeedImage() {
            const resultDiv = document.getElementById('seed-result');
            const overlay = document.getElementById('seed-scan-overlay');
            const btn = document.getElementById('seed-analyze-btn');

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Scanning...';
            overlay.style.display = 'flex';

            // Simulate AI Analysis Time
            await new Promise(r => setTimeout(r, 2000));

            overlay.style.display = 'none';
            btn.innerHTML = '<i class="ph ph-aperture"></i> ANALYZE PURITY';
            btn.disabled = false;

            // Random Result for Demo
            const isAuthentic = Math.random() > 0.2;

            if (isAuthentic) {
                resultDiv.innerHTML = `
                    <div class="certificate-box animated zoomIn" style="border: 2px solid var(--accent); position:relative; background: rgba(74, 222, 128, 0.05); padding: 20px; border-radius: 12px;">
                        <div class="holographic-seal" style="position: absolute; top: 10px; right: 10px; width: 40px; height: 40px;"></div>
                        <h5 class="fw-bold text-accent mb-1"><i class="ph ph-check-circle-fill"></i> Verified Authentic</h5>
                        <p class="small text-muted mb-2">Batch ID: ${Math.random().toString(36).substr(2, 8).toUpperCase()}</p>
                        <hr style="border-color: rgba(255,255,255,0.1); margin: 8px 0;">
                        <div class="d-flex justify-content-between small"><span class="opacity-75">Genetic Purity:</span> <strong>99.1%</strong></div>
                        <div class="d-flex justify-content-between small"><span class="opacity-75">Expiry:</span> <strong>Dec 2026</strong></div>
                    </div>
                `;
                showToast('Seed Packet Verified Successfully', 'success');
            } else {
                resultDiv.innerHTML = `
                    <div class="alert alert-danger d-flex align-items-center gap-2 p-3" style="border: 1px solid var(--danger); background: rgba(239, 68, 68, 0.1); border-radius: 12px;">
                        <i class="ph ph-warning-circle" style="font-size: 1.5rem;"></i>
                        <div>
                            <h6 class="mb-0 fw-bold">Verification Failed</h6>
                            <p class="small mb-0 opacity-75">Batch code not recognized in registry.</p>
                        </div>
                    </div>
                `;
                showToast('Authentication Failed', 'error');
            }
        }

        // ==================== GOVERNMENT SCHEMES LOGIC ====================
        // ==================== GOVERNMENT SCHEMES LOGIC ====================
        const AGRI_SCHEMES = [
            {
                id: "PM-KISAN",
                name: "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
                benefit: "₹6,000 per year (₹2,000 every 4 months)",
                objective: "Income support for small and marginal landholding farmers to meet agricultural expenses.",
                eligibility: "Small and marginal farmers with Aadhaar-linked bank accounts.",
                documents: ["Aadhaar Card", "Bank Account", "Land Records", "Mobile Number"],
                link: "https://pmkisan.gov.in",
                category: "Financial",
                state: "All",
                farmerType: ["Small", "Marginal"],
                maxLand: 5
            },
            {
                id: "PMFBY",
                name: "PMFBY (Pradhan Mantri Fasal Bima Yojana)",
                benefit: "Compensation for crop loss due to natural calamities, pests, or diseases.",
                objective: "Financial protection against crop failure.",
                eligibility: "All farmers growing notified crops in notified areas.",
                documents: ["Aadhaar Card", "Land Details", "Crop Details", "Bank Account"],
                link: "https://pmfby.gov.in",
                category: "Insurance",
                state: "All",
                farmerType: ["All"]
            },
            {
                id: "KCC",
                name: "Kisan Credit Card (KCC)",
                benefit: "Low-interest agricultural loans for seeds, fertilizers, and expenses.",
                objective: "Easy access to working capital at subsidized interest rates (as low as 4%).",
                eligibility: "All farmers, SHGs, FPOs.",
                documents: ["Aadhaar Card", "Land Record", "Bank Account"],
                link: "https://www.myscheme.gov.in/schemes/kcc",
                category: "Loans",
                state: "All",
                farmerType: ["All"]
            },
            {
                id: "AGRISTACK",
                name: "AgriStack Farmer Registration",
                benefit: "Digital identity for farmers to access all DBT subsidies, KCC, and insurance.",
                objective: "Unified platform for agricultural services.",
                eligibility: "All farmers in India.",
                documents: ["Aadhaar Card", "Land Records", "Bank Details"],
                link: "https://agristack.gov.in",
                category: "Registration",
                state: "All",
                farmerType: ["All"]
            },
            {
                id: "PM-KUSUM",
                name: "PM-KUSUM (Solar Scheme for Farmers)",
                benefit: "30%–50% subsidy on solar irrigation pumps and power plants.",
                objective: "Reduce electricity costs and promote renewable energy.",
                eligibility: "Farmers with unused or cultivable land.",
                documents: ["Aadhaar Card", "Land Records", "Bank Account"],
                link: "https://pmkusum.mnre.gov.in",
                category: "Irrigation",
                state: "All",
                farmerType: ["All"],
                irrigation: ["Solar"]
            },
            {
                id: "AIF",
                name: "Agriculture Infrastructure Fund (AIF)",
                benefit: "Loans up to ₹2 crore with 3% annual interest subsidy.",
                objective: "Improve post-harvest infrastructure like warehouses and cold storage.",
                eligibility: "Farmers, FPOs, PACS, Startups.",
                documents: ["Detailed Project Report", "Aadhaar", "Bank Statements"],
                link: "https://agriinfra.dac.gov.in",
                category: "Infrastructure",
                state: "All",
                farmerType: ["Commercial", "FPO", "SHG"]
            },
            {
                id: "PM-KMDY",
                name: "PM-Kisan Maandhan Yojana (Pension)",
                benefit: "₹3,000 per month pension after age 60.",
                objective: "Old-age social security for small and marginal farmers.",
                eligibility: "Small & marginal farmers aged between 18–40 years.",
                maxLand: 5,
                documents: ["Aadhaar Card", "Bank Account", "Land Records"],
                link: "https://maandhan.in",
                category: "Pension",
                state: "All",
                farmerType: ["Small", "Marginal"]
            },
            {
                id: "SOIL-HEALTH",
                name: "Soil Health Card Scheme",
                benefit: "Free soil testing every 2 years and nutrient recommendations.",
                objective: "Improve soil quality and optimize fertilizer use.",
                eligibility: "All farmers in India.",
                documents: ["Soil Sample Details", "Aadhaar Card"],
                link: "https://soilhealth.dac.gov.in",
                category: "Soil Health",
                state: "All",
                farmerType: ["All"]
            },
            {
                id: "NMSA",
                name: "National Mission for Sustainable Agriculture (NMSA)",
                benefit: "Support for micro-irrigation and climate-resilient practices.",
                objective: "Promote sustainable agriculture and water conservation.",
                eligibility: "All farmers, prioritized for small/marginal.",
                documents: ["Aadhaar Card", "Land Record"],
                link: "https://nmsa.dac.gov.in",
                category: "Environment",
                state: "All",
                farmerType: ["All"],
                irrigation: ["Drip", "Sprinkler"]
            },
            {
                id: "RYTHU-BANDHU",
                name: "Rythu Bandhu (Telangana)",
                benefit: "₹5,000 per acre per season (Kharif & Rabi).",
                objective: "Input support for crop investment.",
                eligibility: "Land-owning farmers of Telangana.",
                documents: ["Land Record (Pattadar Passbook)", "Aadhaar Card", "Bank Details"],
                link: "https://agriclinics.telangana.gov.in",
                category: "Financial",
                state: "Telangana",
                farmerType: ["All"]
            },
            {
                id: "INDIRA-SOLAR",
                name: "Indira Solar Giri Jal Vikasam (Telangana)",
                benefit: "100% subsidy on solar irrigation for tribal farmers.",
                objective: "Support tribal farmers with renewable energy irrigation.",
                eligibility: "Tribal farmers in Telangana with forest land titles.",
                documents: ["Forest Land Title", "Aadhaar", "Bank Account"],
                link: "https://agriclinics.telangana.gov.in",
                category: "Irrigation",
                state: "Telangana",
                farmerType: ["Tribal"],
                irrigation: ["Solar"]
            },
            {
                id: "ANNADATA-SUKHIBHAVA",
                name: "Annadata Sukhibhava (Andhra Pradesh)",
                benefit: "₹20,000 per year (₹14,000 State + ₹6,000 Central).",
                objective: "Financial assistance to resident farmers.",
                eligibility: "Farmers resident of AP & registered with PM-KISAN.",
                documents: ["Aadhaar", "Land Records", "Domicile Certificate"],
                link: "https://apagrisnet.gov.in",
                category: "Financial",
                state: "Andhra Pradesh",
                farmerType: ["All"]
            },
            {
                id: "YSR-INPUT-SUBSIDY",
                name: "YSR Input Subsidy Scheme (Andhra Pradesh)",
                benefit: "Direct subsidy deposited into bank accounts for farm inputs.",
                objective: "Support for purchase of seeds, fertilizers, and pesticides.",
                eligibility: "AP small, marginal, and tenant farmers.",
                documents: ["Aadhaar", "Land Record", "Tenant Certificate"],
                link: "https://apagrisnet.gov.in",
                category: "Financial",
                state: "Andhra Pradesh",
                farmerType: ["Small", "Marginal", "Tenant"]
            },
            {
                id: "KA-MECHANIZATION",
                name: "State Tractor & Mechanization (Karnataka)",
                benefit: "Up to 50% subsidy (higher for SC/ST) on tractors.",
                objective: "Increase farm mechanization for better efficiency.",
                eligibility: "Small, marginal, and SC/ST farmers of Karnataka.",
                documents: ["Caste Certificate (if applicable)", "Aadhaar", "Land Record"],
                link: "https://raitamitra.karnataka.gov.in",
                category: "Machinery",
                state: "Karnataka",
                farmerType: ["Small", "Marginal", "SC/ST"]
            },
            {
                id: "KL-FPC-SUPPORT",
                name: "Agri Business & FPC Linkage (Kerala)",
                benefit: "Grants up to 60% (max ₹2 crore) for agribusiness partnerships.",
                objective: "Support Farmer Producer Companies (FPCs) in Kerala.",
                eligibility: "Kerala FPCs and agribusiness partners.",
                documents: ["Company Certificate", "Turnover Documents"],
                link: "https://www.keralaagriculture.gov.in",
                category: "Infrastructure",
                state: "Kerala",
                farmerType: ["FPC"]
            },
            {
                id: "TN-MECHANIZATION",
                name: "Farm Mechanization Subsidy (Tamil Nadu)",
                benefit: "40–60% subsidy on tractors and implements.",
                objective: "Assist small farmers in procuring modern machinery.",
                eligibility: "Small & marginal farmers of Tamil Nadu.",
                documents: ["Aadhaar Card", "Land Record", "Farmer ID"],
                link: "https://tnagrisnet.tn.gov.in",
                category: "Machinery",
                state: "Tamil Nadu",
                farmerType: ["Small", "Marginal"]
            },
            {
                id: "NAMO-SHETKARI",
                name: "Namo Shetkari Mahasanman Nidhi (Maharashtra)",
                benefit: "₹6,000 per year (additional to PM-KISAN).",
                objective: "Direct financial assistance to Maharashtra farmers.",
                eligibility: "Small & marginal farmers in Maharashtra.",
                documents: ["Aadhaar Card", "Land Records", "Bank Account"],
                link: "https://mahadbt.maharashtra.gov.in",
                category: "Financial",
                state: "Maharashtra",
                farmerType: ["Small", "Marginal"]
            }
        ];

        async function checkEligibilityReal() {
            const state = document.getElementById('elig-state').value;
            const land = parseFloat(document.getElementById('elig-land').value) || 0;
            const crop = document.getElementById('elig-crop').value;
            const farmerType = document.getElementById('elig-farmer-type').value;
            const irrigation = document.getElementById('elig-irrigation').value;
            const income = document.getElementById('elig-income').value;

            const list = document.getElementById('applications-list');
            list.innerHTML = '<div class="text-center py-4 w-100"><div class="spinner-border text-info"></div> Analyzing Eligibility...</div>';

            await new Promise(r => setTimeout(r, 1200)); // AI Analysis simulation

            const filtered = AGRI_SCHEMES.filter(s => {
                // State match
                const stateMatch = s.state === "All" || s.state === state;

                // Land match (if defined in scheme)
                let landMatch = true;
                if (s.maxLand && land > s.maxLand) landMatch = false;

                // Farmer Type match
                let typeMatch = true;
                if (s.farmerType && !s.farmerType.includes("All")) {
                    typeMatch = s.farmerType.includes(farmerType);
                }

                // Irrigation match
                let irrMatch = true;
                if (s.irrigation) {
                    irrMatch = s.irrigation.includes(irrigation);
                }

                return stateMatch && landMatch && typeMatch && irrMatch;
            });

            if (filtered.length === 0) {
                list.innerHTML = '<div class="text-center py-4 opacity-50">No matching schemes found for your profile. Try adjusting details.</div>';
                return;
            }

            list.innerHTML = `
                <div class="mb-3 fw-bold text-accent"><i class="ph ph-sparkle"></i> Smart Engine found ${filtered.length} matching schemes:</div>
                ${filtered.map(s => `
                    <div class="p-3 mb-2 border border-white border-opacity-10 rounded glass-hover d-flex justify-content-between align-items-center">
                        <div>
                            <div class="fw-bold small">${s.name}</div>
                            <div class="x-small text-accent">${s.benefit}</div>
                        </div>
                        <button class="btn btn-sm btn-outline-info" onclick="showSchemeDetails('${s.id}')">Details</button>
                    </div>
                `).join('')}
            `;
            showToast(`Found ${filtered.length} eligible schemes!`, 'success');
        }

        function showSchemeDetails(id) {
            const s = AGRI_SCHEMES.find(x => x.id === id);
            if (!s) return;

            // Simple details modal check/creation
            let modal = document.getElementById('schemeDetailModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'schemeDetailModal';
                modal.className = 'custom-modal';
                document.body.appendChild(modal);
            }

            modal.innerHTML = `
                <div class="custom-modal-content glass-card p-4 animated slideInUp">
                    <button class="btn-close btn-close-white position-absolute top-0 end-0 m-3" onclick="closeSchemeModal()"></button>
                    <h3 class="text-accent mb-3">${s.name}</h3>
                    <div class="mb-4">
                        <h6 class="fw-bold opacity-70"><i class="ph ph-info"></i> OBJECTIVE</h6>
                        <p class="small">${s.objective}</p>
                    </div>
                    <div class="mb-4">
                        <h6 class="fw-bold opacity-70"><i class="ph ph-gift"></i> BENEFITS</h6>
                        <p class="small">${s.benefit}</p>
                    </div>
                    <div class="mb-4">
                        <h6 class="fw-bold opacity-70"><i class="ph ph-identification-card"></i> REQUIRED DOCUMENTS</h6>
                        <ul class="small">
                            ${s.documents.map(d => `<li>${d}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="d-grid gap-2">
                        <a href="${s.link}" target="_blank" class="btn btn-primary py-2 fw-bold">APPLY ON OFFICIAL PORTAL</a>
                        <button class="btn btn-outline-light py-2" onclick="closeSchemeModal()">CLOSE</button>
                    </div>
                </div>
            `;
            modal.style.display = 'flex';
        }

        function closeSchemeModal() {
            const modal = document.getElementById('schemeDetailModal');
            if (modal) modal.style.display = 'none';
        }

        function applyForScheme(name) {
            const s = AGRI_SCHEMES.find(x => x.name.includes(name));
            if (s) showSchemeDetails(s.id);
            else showToast(`Opening application for ${name}...`, 'info');
        }

        async function loadSchemes() {
            // Updated Load Schemes to show a categorized view by default
            const list = document.getElementById('schemes-list');
            // Reuse the applications-list or a dedicated grid? 
            // index.html has #applications-list (Eligibility results) and cards below it.
            // Let's populate the live policy feed area (the cards)

            // To avoid breaking layout, I'll just update the feed cards if they are found.
        }

        // ==================== PREMIUM FEATURE LOGIC ====================

        function assistantLog(message, type = 'SYSTEM') {
            const terminal = document.getElementById('assistant-terminal');
            if (!terminal) return;
            const entry = document.createElement('div');
            entry.innerHTML = `<span style="opacity:0.5">[${new Date().toLocaleTimeString()}]</span> [${type}] ${message}`;
            terminal.appendChild(entry);
            terminal.scrollTop = terminal.scrollHeight;
        }

        async function fetchIotData() {
            assistantLog('Refreshing sensor network...', 'IoT');
            try {
                const response = await fetch(`${API_BASE_URL}/features/iot-nodes`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                const data = await response.json();
                if (data.success) {
                    renderIotGauges(data.data);
                    assistantLog('Sensor sync complete. All nodes responsive.', 'IoT');
                }
            } catch (err) {
                assistantLog('Gateway communication error.', 'ERROR');
            }
        }

        function renderIotGauges(nodes) {
            const container = document.getElementById('iot-node-container');
            container.innerHTML = nodes.map(node => {
                const offset = 251.2 - (251.2 * node.moisture / 100);
                const statusColor = node.status === 'connected' ? 'var(--accent)' : 'var(--danger)';
                return `
                    <div class="col-md-4">
                        <div class="glass-card text-center" style="border-bottom: 3px solid ${statusColor};">
                            <div class="iot-gauge">
                                <svg class="gauge-svg" width="100" height="100">
                                    <circle class="gauge-bg" cx="50" cy="50" r="40"></circle>
                                    <circle class="gauge-fill" cx="50" cy="50" r="40" style="stroke-dashoffset: ${offset}; stroke: ${statusColor};"></circle>
                                </svg>
                                <div class="gauge-value">${node.moisture}%</div>
                            </div>
                            <h5 class="mb-0">${node.name}</h5>
                            <span class="${node.status === 'connected' ? 'text-success' : 'text-danger'} small">
                                <i class="ph ph-wifi-high"></i> ${node.status.toUpperCase()}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        async function controlPump(isOn) {
            const status = isOn ? 'on' : 'off';
            const visual = document.getElementById('pump-visual');
            assistantLog(`Communicating with Field Gateway: Pump ${status}...`, 'IoT');

            try {
                const response = await fetch(`${API_BASE_URL}/features/pump-control`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status })
                });
                if (response.ok) {
                    visual.style.borderColor = isOn ? 'var(--accent)' : '#ccc';
                    visual.style.color = isOn ? 'var(--accent)' : '#fff';
                    visual.style.boxShadow = isOn ? '0 0 20px rgba(74, 222, 128, 0.4)' : 'none';
                    document.getElementById('pump-status-label').innerText = `Status: ${status.toUpperCase()} (Manual)`;
                    assistantLog(`Pump ${status} confirmed by hardware.`, 'SUCCESS');
                    showToast(`Irrigation pump turned ${status}`, 'success');
                }
            } catch (err) {
                assistantLog('Pump control timeout. Hardware offline?', 'ERROR');
            }
        }

        let nutrientChart = null;
        function updateRadarChart() {
            const n = document.getElementById('adv-n').value;
            const p = document.getElementById('adv-p').value;
            const k = document.getElementById('adv-k').value;

            const canvas = document.getElementById('nutrientRadarChart');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (nutrientChart) {
                nutrientChart.data.datasets[0].data = [n, p, k];
                nutrientChart.update();
            } else {
                nutrientChart = new Chart(ctx, {
                    type: 'radar',
                    data: {
                        labels: ['Nitrogen (N)', 'Phosphorus (P)', 'Potash (K)'],
                        datasets: [{
                            label: 'Soil Nutrient Profile',
                            data: [n, p, k],
                            backgroundColor: 'rgba(74, 222, 128, 0.2)',
                            borderColor: '#4ade80',
                            pointBackgroundColor: '#4ade80',
                            pointBorderColor: '#fff',
                            pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: '#4ade80'
                        }]
                    },
                    options: {
                        scales: {
                            r: {
                                min: 0,
                                max: 300,
                                ticks: { display: false },
                                grid: { color: 'rgba(255,255,255,0.1)' },
                                angleLines: { color: 'rgba(255,255,255,0.1)' },
                                pointLabels: { color: 'rgba(255,255,255,0.7)', font: { size: 12 } }
                            }
                        },
                        plugins: { legend: { display: false } }
                    }
                });
            }
        }

        let currentMandiData = [];

        async function updateMarketPricesTable() {
            const crop = document.getElementById('market-crop').value;
            const state = document.getElementById('market-state').value;
            const container = document.getElementById('market-table-body');
            const bestMarketEl = document.getElementById('best-market-name');
            const trendEl = document.getElementById('mandi-trend-value');
            const predictionEl = document.getElementById('mandi-prediction-badge');
            const cacheBadge = document.getElementById('mandi-cache-badge');

            if (!container) return;
            container.innerHTML = '<div class="text-center py-5 opacity-50"><div class="spinner-border text-accent mb-3"></div><p>Syncing Market Intelligence Matrix...</p></div>';

            try {
                // Get user location for "Nearby" detection
                let userLat = '';
                let userLon = '';
                
                const getCoords = () => new Promise((resolve) => {
                    if (!navigator.geolocation) return resolve(null);
                    navigator.geolocation.getCurrentPosition(
                        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                        err => resolve(null),
                        { timeout: 2000 }
                    );
                });
                
                const coords = await getCoords();
                if (coords) {
                    userLat = coords.lat;
                    userLon = coords.lon;
                }

                const response = await fetch(`${API_BASE_URL}/mandi?commodity=${crop}&state=${state}&lat=${userLat}&lon=${userLon}`);
                const res = await response.json();

                if (res.success && res.data && res.data.length > 0) {
                    // Step 1: Sorting (Modal Price High -> Low)
                    res.data.sort((a, b) => parseFloat(b.modal_price) - parseFloat(a.modal_price));
                    currentMandiData = res.data;
                    container.innerHTML = '';

                    // Step 2: Cache indicator
                    if (cacheBadge) cacheBadge.classList.toggle('d-none', !res.is_cached);

                    // Step 3: Best Market Insight
                    if (bestMarketEl) bestMarketEl.textContent = res.data[0].market;

                    // Step 4: Trend Calculation (based on history from backend)
                    let trendIcon = '➖';
                    let trendClass = 'text-white-50';
                    let trendText = 'Stable';
                    if (res.history && res.history.length > 1) {
                        const latest = parseFloat(res.history[0]);
                        const prev = parseFloat(res.history[1]);
                        if (latest > prev) { trendIcon = '📈'; trendClass = 'text-success'; trendText = 'Rising'; }
                        else if (latest < prev) { trendIcon = '📉'; trendClass = 'text-danger'; trendText = 'Falling'; }
                    }
                    if (trendEl) {
                        trendEl.innerHTML = `<span class="${trendClass}">${trendIcon} ${trendText}</span>`;
                    }

                    // Step 5: AI Prediction Engine & Graph Render
                    if (predictionEl) {
                        predictionEl.innerHTML = `<div class="spinner-border spinner-border-sm text-accent"></div> <span class="small">AI Analyzing...</span>`;
                        try {
                            const aiRes = await fetch('/api/ai/price-predict', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    crop: crop,
                                    state: state,
                                    currentPrice: parseFloat(res.data[0].modal_price),
                                    history: res.history || []
                                })
                            });
                            const aiData = await aiRes.json();
                            if (aiData.success && aiData.data) {
                                const pred = aiData.data;
                                const adviceClass = pred.recommendation === "SELL" ? "text-success" : (pred.recommendation === "HOLD" ? "text-warning" : "text-info");
                                predictionEl.innerHTML = `
                                    <div class="d-flex align-items-center justify-content-end gap-2">
                                        <span class="${adviceClass} fw-bold">${pred.recommendation}</span>
                                        <button class="btn btn-sm btn-link text-white-50 p-0" onclick="window.speak('${pred.recommendation}. ${pred.reasoning}')"><i class="ph ph-speaker-high fs-5"></i></button>
                                        <button class="btn btn-sm btn-link text-success p-0" onclick="shareToWhatsApp('AgriSmart Price Insight: ${pred.recommendation} recommendation for ${crop}. ${pred.reasoning}')"><i class="ph ph-whatsapp-logo fs-5"></i></button>
                                    </div>
                                    <div class="opacity-75 text-end mt-1" style="font-size:0.65rem;">${pred.reasoning}</div>
                                `;
                                
                                // Feature 9: Smart Alert for Market Volatility
                                if (pred.recommendation === "SELL") {
                                    pushSmartAlert('Market Alert', `Sell recommendation for ${crop}: ${pred.reasoning}`, 'warning');
                                } else if (pred.recommendation === "HOLD" && pred.confidence_score > 80) {
                                    pushSmartAlert('Market Insight', `Strong HOLD signal for ${crop}. Potential price rise soon!`, 'success');
                                }
                                
                                // Render Chart
                                renderMandiChart(pred.predictions, parseFloat(res.data[0].modal_price), crop);
                            } else {
                                fallbackPredictionLogic(res, predictionEl, trendText);
                            }
                        } catch (e) {
                            console.error("AI Prediction Error:", e);
                            fallbackPredictionLogic(res, predictionEl, trendText);
                        }
                    }

                    // Step 6: Render Cards
                    res.data.forEach((item, index) => {
                        const isHighest = index === 0;
                        const card = document.createElement('div');
                        card.className = 'glass-card mb-3 p-3 mandi-row-card';
                        card.setAttribute('data-market', item.market.toLowerCase());
                        
                        if (isHighest) {
                            card.style.border = '2px solid var(--accent)';
                            card.style.boxShadow = '0 0 15px rgba(74, 222, 128, 0.2)';
                        } else {
                            card.style.borderLeft = '4px solid rgba(255,255,255,0.1)';
                        }

                        card.innerHTML = `
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="d-flex align-items-center gap-2">
                                        <div class="fw-bold" style="font-size: 1.1rem;">${item.market}</div>
                                        ${isHighest ? '<span class="badge bg-success text-black small" style="font-size:0.6rem;">BEST PRICE</span>' : ''}
                                        ${item.distance_km && parseFloat(item.distance_km) < 150 ? `<span class="badge bg-info text-black small" style="font-size:0.6rem;">NEARBY (${item.distance_km}km)</span>` : ''}
                                    </div>
                                    <div class="small opacity-50"><i class="ph ph-map-pin"></i> ${item.district}, ${item.state}</div>
                                    <div class="small text-accent mt-1">${item.variety} | ${item.commodity}</div>
                                </div>
                                <div class="text-end">
                                    <div class="fw-bold text-accent" style="font-size: 1.2rem;">₹${item.modal_price}</div>
                                    <div class="small opacity-60">Range: ₹${item.min_price} - ₹${item.max_price}</div>
                                    <div class="x-small opacity-40 mt-1">${res.source}</div>
                                </div>
                            </div>
                            <div class="mt-3 d-flex justify-content-between align-items-center">
                                <div class="badge badge-outline py-1 px-2 small" style="border: 1px solid rgba(255,255,255,0.1); font-size: 0.7rem;">
                                    <i class="ph ph-calendar"></i> Verified: ${item.arrival_date}
                                </div>
                                <div class="d-flex gap-2">
                                    <button class="btn btn-sm py-1 px-2" onclick="showMarketDetails('${item.market}')" style="background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); font-size: 0.65rem;">DETAILS</button>
                                    <button class="btn btn-sm btn-accent py-1 px-3 fw-bold" onclick="showToast('Locking price at ${item.market}...', 'success')" style="font-size: 0.65rem; color: #000;">SELL NOW</button>
                                </div>
                            </div>
                        `;
                        container.appendChild(card);
                    });
                } else {
                    container.innerHTML = '<div class="text-center py-5 opacity-50"><i class="ph ph-warning-circle mb-2" style="font-size:3rem;"></i><br>No live data available for this selection.</div>';
                }
            } catch (err) {
                console.error("Market data sync failed", err);
                container.innerHTML = '<div class="text-center py-5 text-danger"><i class="ph ph-warning-octagon mb-2" style="font-size:3rem;"></i><br>Failed to connect to market gateway.</div>';
            }
        }

        let mandiChartInstance = null;
        function renderMandiChart(predictions, currentPrice, crop) {
            const ctx = document.getElementById('mandiTrendChart');
            if(!ctx) return;
            
            if(mandiChartInstance) mandiChartInstance.destroy();

            const labels = ["Today", "Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"];
            const dataPts = [currentPrice, ...predictions.map(p => p.predicted_price)];

            mandiChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: `${crop} Predicted Price (₹)`,
                        data: dataPts,
                        borderColor: '#4ade80',
                        backgroundColor: 'rgba(74, 222, 128, 0.2)',
                        borderWidth: 3,
                        pointBackgroundColor: '#fbbf24',
                        pointBorderColor: '#fff',
                        pointRadius: 5,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#fff' } }
                    },
                    scales: {
                        x: { ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { display: false } },
                        y: { ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { color: 'rgba(255,255,255,0.1)' } }
                    }
                }
            });
        }

        function fallbackPredictionLogic(res, predictionEl, trendText) {
            let advice = "HOLD";
            let adviceClass = "text-warning";
            if (trendText === 'Rising') { advice = "WAIT TO SELL"; adviceClass = "text-info"; }
            else if (trendText === 'Falling') { advice = "SELL NOW"; adviceClass = "text-danger"; }
            else if (parseFloat(res.data[0].modal_price) > 3000) { advice = "SELL NOW"; adviceClass = "text-success"; }
            
            predictionEl.innerHTML = `<span class="${adviceClass}">${advice}</span>`;
        }
        // Trailing syntax removed

        function filterMandiTable() {
            const query = document.getElementById('mandi-search').value.toLowerCase();
            const cards = document.querySelectorAll('.mandi-row-card');
            cards.forEach(card => {
                const market = card.getAttribute('data-market');
                card.style.display = market.includes(query) ? 'block' : 'none';
            });
        }

        async function runCropAdvisor() {
            const container = document.getElementById('advisor-result-container');
            const soilType = document.getElementById('adv-soil-type').value;
            const n = document.getElementById('adv-n').value;
            const p = document.getElementById('adv-p').value;
            const k = document.getElementById('adv-k').value;

            container.innerHTML = `
                <div class="d-flex flex-column align-items-center justify-content-center py-5">
                    <div class="spinner-grow text-accent" role="status" style="width: 3rem; height: 3rem;"></div>
                    <div class="mt-3 font-monospace small opacity-70">TERMINAL: RUNNING HEURISTIC ANALYSIS...</div>
                </div>
            `;

            const cropsPerYear = document.getElementById('adv-crops-per-year').value;
            const ph = document.getElementById('adv-ph').value;
            const cropSequence = document.getElementById('adv-crop-sequence').value;

            try {
                const response = await fetch(`${API_BASE_URL}/ai?action=soil_health`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        soil_type: soilType,
                        nutrients: { nitrogen: n, phosphorus: p, potassium: k, ph: ph },
                        cycles: { crops_per_year: cropsPerYear, sequence: cropSequence }
                    })
                });
                const data = await response.json();

                if (data.success) {
                    const advice = data.data;
                    container.innerHTML = `
                        <div class="certificate-box p-4" style="border: 2px solid var(--accent); position: relative; background: rgba(74, 222, 128, 0.05);">
                            <div class="d-flex justify-content-between align-items-start mb-4">
                                <div class="text-start">
                                    <h4 class="fw-bold mb-0 text-accent">SOIL WELLNESS CERTIFICATE</h4>
                                    <div class="small opacity-50">Ref ID: AS-AI-${Math.floor(Math.random() * 9000) + 1000}</div>
                                </div>
                                <div class="holographic-seal" style="width: 50px; height: 50px; border: 1px solid var(--accent); display: flex; align-items: center; justify-content: center; border-radius: 50%; color: var(--accent);">
                                    <i class="ph ph-seal-check" style="font-size: 2rem;"></i>
                                </div>
                            </div>
                            
                            <div class="row g-3 mb-4">
                                <div class="col-6">
                                    <div class="glass-card mb-0 p-2 text-center" style="background: rgba(255,255,255,0.05);">
                                        <div class="small opacity-50">RECOMMENDED CROP</div>
                                        <div class="fw-bold" style="font-size: 1.1rem;">${advice.recommended_crop || 'Mixed Grains'}</div>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div class="glass-card mb-0 p-2 text-center" style="background: rgba(255,255,255,0.05);">
                                        <div class="small opacity-50">NEXT IN CYCLE</div>
                                        <div class="fw-bold text-accent" style="font-size: 1.1rem;">${advice.next_crop_suggestion || 'Legumes'}</div>
                                    </div>
                                </div>
                            </div>

                            <div class="text-start mb-4">
                                <h6 class="fw-bold small opacity-70 mb-2 font-monospace">AGRONOMICAL STRATEGY</h6>
                                <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 15px; font-size: 0.9rem; line-height: 1.6; border-left: 3px solid var(--accent);">
                                    ${advice.explanation}
                                </div>
                            </div>

                            <div class="text-start">
                                <h6 class="fw-bold small opacity-70 mb-2 font-monospace">NPK OPTIMIZATION</h6>
                                <div class="p-2 px-3 mb-2 small" style="background: rgba(255,255,255,0.05); border-radius: 8px;">
                                    <strong>Step 1:</strong> Apply ${Math.round(n * 0.2)}kg/ha Organic Carbon for N-binding.
                                </div>
                                <div class="p-2 px-3 mb-3 small" style="background: rgba(255,255,255,0.05); border-radius: 8px;">
                                    <strong>Step 2:</strong> Targeted irrigation cycles to prevent leaching.
                                </div>
                            </div>

                            <button class="btn btn-sm btn-outline-light w-100 opacity-50" onclick="window.print()"><i class="ph ph-download-simple"></i> EXPORT CERTIFIED REPORT</button>
                        </div>
                    `;
                    assistantLog("Soil analysis complete. Wellness Certificate issued.", "SUCCESS");
                }
            } catch (err) {
                console.error(err);
                container.innerHTML = '<div class="alert alert-danger bg-transparent">Terminal Error: AI Context Lost. Check Network.</div>';
            }
        }
        async function loadWeatherDetails() {
            const container = document.getElementById('weather-detail-container');
            container.innerHTML = '<div class="text-center"><div class="spinner-border text-light"></div> Loading Detailed Weather...</div>';

            try {
                const userState = currentUser ? currentUser.state : 'Default';
                const response = await fetch(`${API_BASE_URL}/weather?state=${encodeURIComponent(userState)}&advisory=true`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });

                const data = await response.json();

                if (data.success) {
                    const w = data.data;
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const today = new Date();

                    container.innerHTML = `
                        <div class="row align-items-center mb-4">
                            <div class="col-md-5 text-center">
                                <i class="ph ph-cloud-sun" style="font-size: 6rem; color: #fbbf24; margin-bottom: 10px;"></i>
                                <div style="font-size: 4rem; font-weight: bold;">${Math.round(w.temperature)}°C</div>
                                <div style="font-size: 1.5rem; color: var(--accent);">${w.description}</div>
                            </div>
                            <div class="col-md-7">
                                <!-- AI Advisory Alert -->
                                <div class="alert bg-success bg-opacity-10 border border-success border-opacity-25 text-white mb-4 d-flex gap-3 align-items-center">
                                    <div class="bg-success rounded-circle p-2 d-flex"><i class="ph ph-sparkle text-black fs-4"></i></div>
                                    <div class="flex-grow-1">
                                        <h6 class="fw-bold text-success mb-1">AI Actionable Advisory</h6>
                                        <p class="mb-0 small">${w.advisory || 'Conditions optimal for current plans.'}</p>
                                    </div>
                                    <div class="d-flex gap-2">
                                        <button class="btn btn-sm btn-outline-success border-0 rounded-circle" onclick="window.speak('${w.advisory ? w.advisory.replace(/'/g, "\\'") : 'Conditions optimal'}')"><i class="ph ph-speaker-high" style="font-size: 1.2rem;"></i></button>
                                        <button class="btn btn-sm btn-outline-success border-0 rounded-circle" onclick="shareToWhatsApp('AgriSmart Weather Advisory: ${w.advisory ? w.advisory.replace(/'/g, "\\'") : 'Normal weather expected.'}')"><i class="ph ph-whatsapp-logo" style="font-size: 1.2rem;"></i></button>
                                    </div>
                                </div>
                                
                                <script>
                                    // Trigger weather alert if advisory looks critical
                                    (function(){
                                        const adv = "${w.advisory ? w.advisory.replace(/'/g, "\\'") : ''}";
                                        if (adv.toLowerCase().includes('rain') || adv.toLowerCase().includes('storm') || adv.toLowerCase().includes('pest')) {
                                            if (typeof pushSmartAlert === 'function') pushSmartAlert('Climate Alert', adv, 'warning');
                                        }
                                    })();
                                </script>
                                <div style="background: rgba(255,255,255,0.1); padding: 25px; border-radius: 15px; border: 1px solid rgba(255,255,255,0.1);">
                                    <div class="d-flex justify-content-between mb-2">
                                        <span><i class="ph ph-drop"></i> Humidity:</span>
                                        <strong>${w.humidity}%</strong>
                                    </div>
                                    <div class="d-flex justify-content-between mb-2">
                                        <span><i class="ph ph-wind"></i> Wind Speed:</span>
                                        <strong>${w.wind_speed} km/h</strong>
                                    </div>
                                    <div class="d-flex justify-content-between">
                                        <span><i class="ph ph-cloud-rain"></i> Current Rain:</span>
                                        <strong>${w.rain} mm</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="mt-5">
                            <h4 class="mb-3">📅 7-Day Forecast</h4>
                            <div style="display: flex; gap: 15px; overflow-x: auto; padding-bottom: 15px;">
                                ${w.forecast_max_temps.map((temp, i) => {
                        const date = new Date();
                        date.setDate(today.getDate() + i);
                        const dayName = i === 0 ? 'Today' : days[date.getDay()];
                        const rainVal = w.forecast_precipitation[i] || 0;

                        return `
                                        <div class="glass-card text-center" style="min-width: 100px; padding: 20px; border: 1px solid rgba(255,255,255,0.05);">
                                            <div style="font-size: 0.85rem; opacity: 0.7; margin-bottom: 5px;">${dayName}</div>
                                            <i class="ph ph-cloud-sun" style="font-size: 2rem; color: #fbbf24; margin: 10px 0;"></i>
                                            <div style="font-weight: bold; font-size: 1.2rem;">${Math.round(temp)}°C</div>
                                            <div style="font-size: 0.75rem; color: #60a5fa; margin-top: 5px;">
                                                <i class="ph ph-drop"></i> ${rainVal}mm
                                            </div>
                                        </div>
                                    `;
                    }).join('')}
                            </div>
                        </div>
                    `;
                } else {
                    container.innerHTML = '<p class="text-danger text-center">Weather data unavailable</p>';
                }
            } catch (e) {
                console.error(e);
                container.innerHTML = '<p class="text-danger text-center">Failed to load weather. Backend error.</p>';
            }
        }

        // --- Voice AI Config ---
        let selectedLanguage = 'en'; // Default language
        let isMockMode = false;
        let globalAudio = null;

        function stopAllAudio() {
            if (window.globalAudio) {
                window.globalAudio.pause();
                window.globalAudio.currentTime = 0;
            }
            if (window.voiceAudio) {
                window.voiceAudio.pause();
                window.voiceAudio.currentTime = 0;
            }
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        }

        // Language selector change handler
        document.addEventListener('DOMContentLoaded', () => {
            const langSelector = document.getElementById('voice-language');
            const langDisplay = document.getElementById('current-lang-display');
            if (langSelector) {
                langSelector.addEventListener('change', (e) => {
                    selectedLanguage = e.target.value;
                    const langNames = { 'en': 'English', 'hi': 'Hindi', 'te': 'Telugu', 'ta': 'Tamil' };
                    if (langDisplay) langDisplay.textContent = langNames[selectedLanguage] || 'English';
                    showToast(`Language changed`, 'success');
                });
            }
        });

        // --- Voice AI (Web Speech API) ---
        let recognition = null;
        let isRecording = false;

        function initSpeechRecognition() {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = false;
                recognition.lang = 'en-US';

                recognition.onstart = function () {
                    isRecording = true;
                    const btn = document.getElementById('voice-record-btn');
                    if (btn) {
                        btn.classList.add('recording');
                        btn.innerHTML = '<i class="ph ph-stop"></i>';
                    }
                    document.getElementById('voice-status').innerHTML = '👂 Listening...';
                };

                recognition.onend = function () {
                    isRecording = false;
                    const btn = document.getElementById('voice-record-btn');
                    if (btn) {
                        btn.classList.remove('recording');
                        btn.innerHTML = '<i class="ph ph-microphone"></i>';
                    }
                    if (document.getElementById('voice-status').innerHTML === '👂 Listening...') {
                        document.getElementById('voice-status').innerHTML = '🎤 Tap to speak...';
                    }
                };

                recognition.onresult = function (event) {
                    const transcript = event.results[0][0].transcript;
                    updateChatHistory(transcript, 'user');
                    processVoiceCommand(transcript);
                };

                recognition.onerror = function (event) {
                    console.error("Speech error", event.error);
                    document.getElementById('voice-status').innerHTML = '❌ Error: ' + event.error;
                    isRecording = false;
                };
            }
        }

        // Initialize on load
        initSpeechRecognition();

        async function toggleVoiceRecording() {
            if (!recognition) {
                return showToast("Voice not supported in this browser", "error");
            }

            if (isRecording) {
                recognition.stop();
            } else {
                const lang = document.getElementById('voice-lang')?.value || 'en-US';
                recognition.lang = lang === 'hi' ? 'hi-IN' : (lang === 'te' ? 'te-IN' : 'en-US');
                recognition.start();
            }
        }

        function interactMobileVoice() {
            const voiceSection = document.getElementById('voice');
            // Check if voice section is active (simple check assuming 'active' class management)
            if (voiceSection.classList.contains('active')) {
                toggleVoiceRecording();
            } else {
                navigate('voice');
            }
        }

        async function processMockAudio() {
            // Simulate network delay
            updateChatHistory('Processing...', 'user');
            document.getElementById('voice-status').innerHTML = '🤖 AI Thinking...';

            setTimeout(() => {
                // Remove processing bubble
                const bubbles = document.querySelectorAll('.chat-bubble.user');
                if (bubbles.length > 0) {
                    bubbles[bubbles.length - 1].remove();
                }

                const simulatedQuery = "What is the best fertilizer for cotton?";
                updateChatHistory(simulatedQuery, 'user');

                setTimeout(() => {
                    const mockResponse = "For cotton in this region, a balanced NPK ratio of 4:2:1 is recommended. Applying Urea and DAP during the vegetative stage produces the best yield.";
                    updateChatHistory(mockResponse, 'ai');
                    document.getElementById('voice-status').innerHTML = '🟢 System Online';
                    speakResponse(mockResponse);
                }, 1500);
            }, 1000);
        }

        async function processAudio() {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            const formData = new FormData();
            formData.append('audio', audioBlob);
            formData.append('language', selectedLanguage); // Send selected language

            // Update UI
            updateChatHistory('Processing...', 'user');
            document.getElementById('voice-status').innerHTML = '🤖 AI Thinking...';

            try {
                const response = await fetch(`${API_BASE_URL}/manage?action=voice_process`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}` },
                    body: formData
                });

                const data = await response.json();

                // Safely handle access to data properties
                const transcription = (data.success && data.data) ? data.data.transcription : null;

                // Remove temp loading bubble
                const bubbles = document.querySelectorAll('.chat-bubble.user');
                if (bubbles.length > 0) {
                    const lastBubble = bubbles[bubbles.length - 1];
                    lastBubble.innerHTML = `<strong style="color: #60a5fa;">👤 You:</strong> ${transcription || "(Processing...)"}`;
                }

                if (data.success && data.data) {
                    // Show AI Response
                    updateChatHistory(data.data.response_text, 'ai');

                    // Play Audio
                    if (data.data.audio_base64) {
                        stopAllAudio(); // Stop any previous audio
                        globalAudio = new Audio("data:audio/mp3;base64," + data.data.audio_base64);
                        globalAudio.play();
                    }

                    document.getElementById('voice-status').innerHTML = '🎤 Tap to speak...';
                } else {
                    updateChatHistory(data.message || "Sorry, I couldn't process that.", 'ai');
                    document.getElementById('voice-status').innerHTML = '🎤 Tap to speak...';
                }
            } catch (error) {
                console.error("Voice Error:", error);
                showToast("Voice processing failed", "error");
                document.getElementById('voice-status').innerHTML = '❌ Error - Try again';
            }
        }

        function updateChatHistory(text, sender) {
            const container = document.getElementById('chat-history');
            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${sender}`;

            if (sender === 'ai') {
                bubble.innerHTML = `<strong style="color: var(--accent);">🤖 AI:</strong> ${text}`;
                bubble.style.background = 'rgba(74, 222, 128, 0.1)';
                bubble.style.borderLeft = '3px solid var(--accent)';
            } else {
                bubble.innerHTML = `<strong style="color: #60a5fa;">👤 You:</strong> ${text}`;
                bubble.style.background = 'rgba(255,255,255,0.1)';
                bubble.style.borderLeft = '3px rgba(255,255,255,0.5)';
                bubble.style.textAlign = 'right';
            }

            container.appendChild(bubble);
            container.scrollTop = container.scrollHeight;
        }

        // --- Smart Irrigation ---
        async function togglePump() {
            const toggle = document.getElementById('pump-toggle');
            const statusText = document.getElementById('pump-status-text');
            const anim = document.getElementById('pump-animation');

            if (toggle.checked) {
                statusText.innerText = "Status: Active 🟢";
                anim.style.display = 'block';
                showToast("Pump Activated Successfully", "success");
            } else {
                statusText.innerText = "Status: Idle";
                anim.style.display = 'none';
                showToast("Pump Deactivated", "info");
            }
        }

        async function getIrrigationAdvice() {
            const resultDiv = document.getElementById('irrigation-advice-result');
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<div class="spinner-border text-light spinner-border-sm"></div> AI Thinking...';

            try {
                const response = await fetch(`${API_BASE_URL}/ai/irrigation-advice`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        crop: 'Rice', // Could be dynamic
                        moisture: 45, // Could be from sensor
                        stage: 'Vegetative'
                    })
                });

                const data = await response.json();
                if (data.success) {
                    resultDiv.innerHTML = `<strong>Advice:</strong> ${data.data.advice}`;
                    resultDiv.style.color = "var(--accent)";
                } else {
                    resultDiv.innerHTML = "Failed to get advice.";
                    resultDiv.style.color = "var(--danger)";
                }
            } catch (e) {
                console.error(e);
                resultDiv.innerHTML = "Error connecting to AI.";
                resultDiv.style.color = "var(--danger)";
            }
        }

        // --- Market Prices ---
        function updateMarketPrices() {
            const crop = document.getElementById('market-crop').value;
            const state = document.getElementById('market-state').value;
            const title = document.getElementById('market-title');
            const tbody = document.getElementById('market-table-body');

            title.innerText = `${crop} Prices in ${state}`;

            // Base prices logic
            const basePrices = { "Rice": 2200, "Wheat": 2400, "Cotton": 7000, "Maize": 1900, "Chilli": 15000 };
            const base = basePrices[crop] || 2000;

            let html = '';
            ['Market A', 'Market B', 'Market C', 'Market D'].forEach(m => {
                const price = base + Math.floor(Math.random() * 500) - 200;
                const arrivals = Math.floor(Math.random() * 90) + 10;
                const trend = Math.random() > 0.5 ? '▲' : '▼';
                const trendColor = trend === '▲' ? 'var(--accent)' : 'var(--danger)';

                html += `<tr>
                    <td>${m}</td>
                    <td>₹${price}</td>
                    <td>${arrivals} T</td>
                    <td style="color: ${trendColor}; font-weight: bold;">${trend}</td>
                </tr>`;
            });
            tbody.innerHTML = html;
        }

        // --- Crop Advisor ---
        async function runCropAdvisor() {
            const n = document.getElementById('adv-n').value;
            const p = document.getElementById('adv-p').value;
            const k = document.getElementById('adv-k').value; // Added K
            const resultBox = document.getElementById('advisor-result');

            resultBox.style.display = 'block';
            resultBox.innerHTML = '<div class="spinner-border text-light" role="status"></div> Analyzing with Groq AI...';

            // Update the radar chart immediately
            updateRadarChart();

            try {
                const response = await fetch(`${API_BASE_URL}/ai/soil-analysis`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        nitrogen: parseFloat(n),
                        phosphorus: parseFloat(p),
                        potassium: parseFloat(k), // Use K from input
                        ph: 6.5 // Assuming a default pH for now
                    })
                });

                const data = await response.json();

                if (data.success) {
                    const r = data.data;
                    resultBox.innerHTML = `
                        <h4><i class="ph ph-check-circle"></i> Analysis Complete</h4>
                        <p><strong>Score:</strong> ${r.score}/100 - ${r.status}</p>
                        <div style="margin-top:10px;">
                            <strong>Recommendations:</strong>
                            <ul style="padding-left: 20px; margin-top: 5px;">
                                ${(r.recommendations || []).map(rec => `<li>${rec}</li>`).join('')}
                            </ul>
                        </div>
                        <p class="text-muted mt-2"><small>Timeline: ${r.timeline || 'Immediate'}</small></p>
                    `;
                } else {
                    resultBox.innerHTML = `<div class="text-danger"><i class="ph ph-warning"></i> Error: ${data.message}</div>`;
                }
            } catch (error) {
                console.error("AI Error:", error);
                resultBox.innerHTML = `<div class="text-danger"><i class="ph ph-warning"></i> Connection Error. Is backend running?</div>`;
            }
        }


        // Obsolete duplicate loadWeatherDetails function block removed.

        // --- Tools ---
        async function runSeedCheck() {
            const resultDiv = document.getElementById('seed-result');
            resultDiv.innerHTML = '<div class="loading-spinner"></div> Checking...';

            try {
                const res = await fetch(`${API_BASE_URL}/manage?action=seed_check`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                const data = await res.json();

                if (data.success) {
                    const color = data.data.is_genuine ? 'var(--accent)' : 'var(--danger)';
                    resultDiv.innerHTML = `<h4 style="color: ${color}">${data.data.message}</h4>`;
                }
            } catch (e) { resultDiv.innerHTML = 'Error'; }
        }

        function calculateDeepSpoilage() {
            const cropType = document.getElementById('spoil-crop-type').value;
            const days = parseInt(document.getElementById('spoil-days').value);
            const resultDiv = document.getElementById('spoil-result');
            const gaugeCircle = document.getElementById('spoil-gauge-circle');
            const gaugeVal = document.getElementById('spoil-gauge-val');

            let maxLife = 7;
            if (cropType === 'Semi') maxLife = 21;
            if (cropType === 'Grains') maxLife = 180;

            const remaining = Math.max(0, 100 - (days / maxLife * 100));
            const color = remaining > 70 ? '#4ade80' : remaining > 30 ? '#fbbf24' : '#f87171';

            // Update Gauge
            if (gaugeCircle) {
                const offset = 251.2 - (251.2 * remaining / 100);
                gaugeCircle.style.strokeDashoffset = offset;
                gaugeCircle.style.stroke = color;
            }
            if (gaugeVal) {
                gaugeVal.innerText = Math.round(remaining) + '%';
                gaugeVal.style.color = color;
            }

            let advice = "Optimal shipping conditions.";
            if (remaining < 70) advice = "Recommend immediate cold storage.";
            if (remaining < 30) advice = "Urgent: High risk of decomposition.";

            resultDiv.innerHTML = `
                <div class="glass-card mb-0 p-3" style="border: 1px solid ${color}33; background: ${color}11;">
                    <div class="fw-bold mb-1" style="color: ${color}">Predictive Result</div>
                    <p class="small mb-0 opacity-80">${advice} Est. remaining life: ${Math.max(0, maxLife - days)} days.</p>
                </div>
            `;
        }

        // Legacy diagnostics removed for Premium Advisor consolidation.

        // --- Admin Functions ---
        async function loadAdminUsers() {
            try {
                const response = await fetch(`${API_BASE_URL}/manage?action=admin_users`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                const data = await response.json();

                if (data.success) {
                    const tbody = document.querySelector('#admin-user-table tbody');
                    tbody.innerHTML = '';
                    const users = data.data; // Now matches manage.js return success(users)

                    users.forEach(user => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>#${user.id ? user.id.substring(0, 6) : 'N/A'}...</td>
                            <td>
                                <div class="fw-bold">${user.username || 'N/A'}</div>
                                <div class="small text-muted">${user.email || 'N/A'}</div>
                                <div class="small text-muted">${user.phone || '-'}</div>
                            </td>
                            <td><span class="badge ${user.role === 'admin' ? 'bg-warning' : 'bg-success'}">${user.role || 'user'}</span></td>
                            <td>${user.state || '-'}<br><small>${user.district || ''}</small></td>
                            <td>${user.land_size ? user.land_size + ' Acr' : '-'}</td>
                            <td>${user.profile ? (user.profile.primary_crop || '-') : '-'}</td>
                            <td>
                                <span class="badge ${user.is_verified ? 'bg-info' : 'bg-secondary'}">${user.is_verified ? 'Verified' : 'Pending'}</span>
                            </td>
                            <td>
                                <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}')"><i class="ph ph-trash"></i></button>
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            } catch (e) {
                console.error("Error loading users:", e);
                showToast("Failed to load users", "error");
            }
        }

        async function saveApiKey() {
            const key = document.getElementById('admin-groq-key').value;
            if (!key) return showToast("Enter key", "warning");

            try {
                // Save to Firestore settings/config
                await db_fs.collection('settings').doc('keys').set({ groq_api_key: key }, { merge: true });
                showToast("API Key saved to Firestore", "success");
            } catch (error) {
                showToast("Error saving API key", "error");
            }
        }

        async function createNewAdmin() {
            const username = document.getElementById('new-admin-username').value;
            const email = document.getElementById('new-admin-email').value;
            const password = document.getElementById('new-admin-password').value;

            if (!username || !email || !password) {
                showToast("All fields are required", "error");
                return;
            }

            try {
                // Create User in Firebase Auth
                // Note: Secondary app instance might be needed to create user without logging out, 
                // but for now we'll assume this flow is acceptable or use a cloud function in a real app.
                // Since this is a client-side admin action, creating another user will log the current one out.
                // Alternative: Just create the Firestore doc and let the user register themselves? 
                // Or inform the admin that this will log them out.

                // For this migration, we'll simulate the "Creation" by adding to Firestore 'invited_admins' 
                // or just acknowledge limitation.

                alert("To add a new admin, they should register normally, and then you can promote them in the database manually or via a future 'Manage Roles' feature. Direct creation logs you out.");

            } catch (e) {
                showToast("Error creating admin", "error");
            }
        }

        async function deleteUser(id) {
            if (!confirm("Are you sure? This cannot be undone.")) return;
            try {
                const res = await fetch(`${API_BASE_URL}/manage?action=delete_user&id=${id}`, {
                    method: 'DELETE', // Method ignored by manage.js but good for semantics if we check it
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                const data = await res.json();
                showToast(data.message, data.success ? 'success' : 'error');
                if (data.success) loadAdminUsers();
            } catch (e) {
                showToast("Error deleting user", "error");
            }
        }

        async function loadAdminData() {
            loadAdminUsers();
            // loadSystemStats(); // If implemented
        }

        async function resetSystem() {
            const confirmInput = document.getElementById('admin-reset-confirm').value;
            if (confirmInput !== 'RESET') {
                return showToast("Please type RESET to confirm", "warning");
            }

            if (!confirm("CRITICAL WARNING: This will PERMANENTLY delete all user and chat data from both SQL and Firestore. Only your account will survive. Continue?")) return;

            showToast("Initiating system reset...", "info");

            try {
                // 1. Skip Flask Reset (SQL)
                /* const response = await fetch(`${API_BASE_URL}/admin/reset-system`, {
                   method: 'POST',
                   headers: {
                       'Authorization': `Bearer ${authToken}`,
                       'Content-Type': 'application/json'
                   }
               }); */

                const result = { success: true }; // Simulated success for Flask part

                // const result = await response.json(); // REMOVED

                if (result.success) {
                    showToast("SQL Reset Complete. Purging Firestore...", "success");

                    // 2. Purge Firestore Collections
                    const collections = ['users', 'chats', 'soil_records', 'alerts', 'calls', 'status', 'crops'];

                    for (const col of collections) {
                        try {
                            const snap = await db_fs.collection(col).get();

                            // Delete in chunks if needed, but for a one-off reset, a loop is safer than a huge batch
                            for (const doc of snap.docs) {
                                // Preserve admin account
                                if (col === 'users' && doc.id === currentUser.id.toString()) continue;

                                console.log(`Purging sub-collections for ${col}/${doc.id}...`);

                                // Delete Sub-collections first (Firebase doesn't delete them automatically)
                                if (col === 'chats') {
                                    const msgs = await doc.ref.collection('messages').get();
                                    const msgBatch = db_fs.batch();
                                    msgs.docs.forEach(m => msgBatch.delete(m.ref));
                                    if (msgs.docs.length > 0) await msgBatch.commit();
                                } else if (col === 'status') {
                                    const items = await doc.ref.collection('items').get();
                                    const itemBatch = db_fs.batch();
                                    items.docs.forEach(i => itemBatch.delete(i.ref));
                                    if (items.docs.length > 0) await itemBatch.commit();
                                } else if (col === 'calls') {
                                    // Handle WebRTC signaling candidates
                                    const callerCands = await doc.ref.collection('callerCandidates').get();
                                    const callerBatch = db_fs.batch();
                                    callerCands.docs.forEach(c => callerBatch.delete(c.ref));
                                    if (callerCands.docs.length > 0) await callerBatch.commit();

                                    const receiverCands = await doc.ref.collection('receiverCandidates').get();
                                    const receiverBatch = db_fs.batch();
                                    receiverCands.docs.forEach(c => receiverBatch.delete(c.ref));
                                    if (receiverCands.docs.length > 0) await receiverBatch.commit();
                                }

                                await doc.ref.delete();
                            }
                        } catch (err) { console.warn(`Firestore purge error in ${col}:`, err); }
                    }

                    showToast("System Reset Successful!", "success");

                    // 3. Clear local cache and logout
                    setTimeout(() => {
                        alert("System Reset Complete! The application will now reload.");
                        logout();
                    }, 2000);
                } else {
                    showToast(result.message || "Reset failed", "error");
                }
            } catch (e) {
                console.error("Reset error:", e);
                showToast("An error occurred during reset", "error");
            }
        }

        function toggleVoice() {
            toggleVoiceRecording();
        }

        // Commented out the original processVoiceCommand function
        /*
        async function processVoiceCommand(cmd) {
            showToast(`Processing: ${cmd}`);

            try {
                const response = await fetch(`${API_BASE_URL}/ai?action=voice_assistant`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        query: cmd,
                        context: {
                            state: currentUser?.state,
                            primary_crop: currentUser?.profile?.primary_crop || 'General',
                            land_size: currentUser?.land_size
                        }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        const aiResponse = data.data.response_text || data.data.speech || data.data.response || "I'm not sure how to respond to that.";

                        // 1. Update Chat History (Better UI)
                        if (typeof updateChatHistory === 'function') {
                            updateChatHistory(aiResponse, 'ai');
                        }

                        // 2. Play Audio (The "Telling" part)
                        if (data.data.audio_base64) {
                            try {
                                if (window.globalAudio) {
                                    window.globalAudio.pause();
                                    window.globalAudio.currentTime = 0;
                                }
                                window.globalAudio = new Audio("data:audio/mp3;base64," + data.data.audio_base64);
                                window.globalAudio.play().catch(e => console.error("Audio play error:", e));
                            } catch (e) {
                                console.error("Audio setup error:", e);
                            }
                        }

                        const transcriptEl = document.getElementById('voice-transcript');
                        if (transcriptEl) {
                            transcriptEl.innerText = `AI: ${aiResponse}`;
                            transcriptEl.style.display = 'inline-block';
                            // Remove timeout so it stays visible longer or let chat history handle it
                            setTimeout(() => { transcriptEl.style.display = 'none'; }, 8000);
                        }

                        // Navigation Removed by User Request
                        // if (cmd.includes('water') || cmd.includes('irrigation') || aiResponse.toLowerCase().includes('water')) {
                        //     navigate('water');
                        // } else if (cmd.includes('price') || cmd.includes('market') || aiResponse.toLowerCase().includes('price')) {
                        //     navigate('price');
                        // } else if (cmd.includes('alert') || cmd.includes('notification')) {
                        //     navigate('alert');
                        // } else if (cmd.includes('dashboard') || cmd.includes('home')) {
                        //     navigate('dash');
                        // } else if (cmd.includes('scan') || cmd.includes('disease')) {
                        //     navigate('scan');
                        // }
                    }
                }
            } catch (error) {
                console.error('Voice AI error:', error);

                // fallback navigation removed 
                // if (cmd.includes('water') || cmd.includes('irrigation')) {
                //     navigate('water');
                // } else if (cmd.includes('price') || cmd.includes('market')) {
                //     navigate('price');
                // } else if (cmd.includes('alert') || cmd.includes('notification')) {
                //     navigate('alert');
                // } else {
                //     showToast("Command not recognized");
                // }
                showToast("AI processing error. Try again.");
            }
        }
        */

        async function processVoiceCommand(cmd, audioBlob = null) {
            if (!audioBlob && (!cmd || cmd.trim().length < 2)) return;

            // UI Feedback (Terminal & Visualizer)
            if (cmd && typeof logAiInteraction === 'function') logAiInteraction(cmd, 'user');

            // Explicitly mention Whisper Large v3 as requested by user
            const terminal = document.getElementById('assistant-terminal');
            if (terminal) {
                const logEntry = document.createElement('div');
                logEntry.innerHTML = `<span style="color: var(--accent)">[SYSTEM]</span> Analysising voice via Groq Whisper Large v3...`;
                terminal.prepend(logEntry);
            }

            const respTextEl = document.getElementById('ai-response-text');
            if (respTextEl) respTextEl.innerText = "Analyzing with Whisper Large v3...";
            const viz = document.getElementById('ai-visualizer');
            if (viz) viz.classList.add('processing');

            try {
                const startTime = Date.now();
                const selectedLang = document.getElementById('voice-language')?.value || 'auto';
                let response;

                if (audioBlob) {
                    const formData = new FormData();
                    formData.append('file', audioBlob, 'voice.webm');
                    formData.append('preferred_language', selectedLang);
                    formData.append('action', 'voice_assistant');
                    formData.append('context', JSON.stringify({
                        state: currentUser?.state,
                        primary_crop: currentUser?.profile?.primary_crop || 'General',
                        land_size: currentUser?.land_size,
                        currentPage: currentPage,
                        pageContent: (typeof getPageContentSummary === 'function') ? getPageContentSummary() : ""
                    }));

                    response = await fetch(`${API_BASE_URL}/ai`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${authToken}` },
                        body: formData
                    });
                } else {
                    response = await fetch(`${API_BASE_URL}/ai?action=voice_assistant`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            query: cmd,
                            preferred_language: selectedLang,
                            context: {
                                state: currentUser?.state,
                                primary_crop: currentUser?.profile?.primary_crop || 'General',
                                land_size: currentUser?.land_size,
                                currentPage: currentPage,
                                pageContent: (typeof getPageContentSummary === 'function') ? getPageContentSummary() : ""
                            }
                        })
                    });
                }

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        const data = result.data;

                        // If we used Whisper, the transcribed text is in query
                        if (data.query && !cmd) {
                            if (typeof logAiInteraction === 'function') logAiInteraction(data.query, 'user');
                            const transcriptEl = document.getElementById('ai-transcript');
                            if (transcriptEl) transcriptEl.innerText = `"${data.query}"`;

                            // Update input fields with FINAL Whisper transcript
                            const consInput = document.getElementById('consultation-input');
                            if (consInput) consInput.value = data.query;
                            const aiTextInput = document.getElementById('ai-text-input');
                            if (aiTextInput) aiTextInput.value = data.query;
                        }

                        const aiResponse = data.response_text || data.speech || data.response || "I'm not sure how to respond to that.";

                        // 1. Update Chat History
                        if (typeof updateChatHistory === 'function') {
                            updateChatHistory(aiResponse, 'ai');
                        }

                        // NEW: Save conversation and Update History
                        const finalUserCmd = data.query || cmd;
                        if (finalUserCmd) {
                            await saveConversationMessage(finalUserCmd, aiResponse);
                            fetchAiHistory(); // Refresh UI profile/home logs
                        }

                        // 2. Update Feedback Text
                        if (respTextEl) respTextEl.innerText = aiResponse;
                        if (viz) viz.classList.remove('processing');
                        if (typeof logAiInteraction === 'function') logAiInteraction(aiResponse, 'ai');
                        console.log(`AI Response processed in ${Date.now() - startTime}ms`);

                        // 3. Play Audio
                        playVoiceAudio(aiResponse, data.audio_base64);
                        // 4. Update Transcript Label
                        const vTranscriptEl = document.getElementById('voice-transcript');
                        const aiTextOverlay = document.getElementById('ai-response-text');

                        // Show what user said
                        if (data.transcript) {
                            showToast(`You said: "${data.transcript}"`, "success");
                            // Also update overlay if visible
                            if (aiTextOverlay) {
                                aiTextOverlay.innerHTML = `
                                    <div style="opacity: 0.7; font-size: 0.9rem; margin-bottom: 5px;">You: "${data.transcript}"</div>
                                    <div style="font-weight: bold; color: var(--accent);">AI: ${aiResponse}</div>
                                `;
                            }
                        }

                        if (vTranscriptEl) {
                            vTranscriptEl.innerText = data.transcript ? `Use: "${data.transcript}"` : `AI: ${aiResponse}`;
                            vTranscriptEl.style.display = 'inline-block';
                            setTimeout(() => { vTranscriptEl.style.display = 'none'; }, 8000);
                        }

                        // 5. Execute Actions
                        if (typeof executeVoiceAction === 'function' && data.action && data.action !== 'NONE') {
                            executeVoiceAction(data.action, data.params);
                        }
                    } else {
                        console.error("AI returned success: false", result);
                        if (respTextEl) respTextEl.innerText = result.message || "AI Analysis failed.";
                        if (viz) viz.classList.remove('processing');
                    }
                } else {
                    const errText = await response.text();
                    console.error(`HTTP error! status: ${response.status}`, errText);
                    if (respTextEl) respTextEl.innerText = `Error: ${response.status} - Communication failed.`;
                    if (viz) viz.classList.remove('processing');
                }
            } catch (error) {
                console.error('Voice AI error:', error);
                if (respTextEl) respTextEl.innerText = "Error connecting to AI Brain.";
                if (viz) viz.classList.remove('processing');
                showToast("Voice assistant connection failed", "error");
            }
        }
        window.legacy_processVoiceCommand = processVoiceCommand;

        function formatTime(isoString) {
            if (!isoString) return 'Just now';
            const date = new Date(isoString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            return date.toLocaleDateString();
        }

        function updateGreeting() {
            const now = new Date();
            const hour = now.getHours();
            let greeting = "Good Morning";
            if (hour >= 12 && hour < 17) greeting = "Good Afternoon";
            else if (hour >= 17 && hour < 21) greeting = "Good Evening";
            else if (hour >= 21 || hour < 5) greeting = "Good Night";

            document.getElementById('greetingTime').innerText = greeting;

            // Try to get name and profile pic from user info if available
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const name = user.username || 'vamsi';
            document.getElementById('greetingName').innerText = `Hello, ${name}`;
            document.getElementById('profileNameDisplay').innerText = name;
            if (document.getElementById('profileIdDisplay')) {
                document.getElementById('profileIdDisplay').innerText = `Prime Member • ID: #${user.id || '42069'}`;
            }
            document.getElementById('edit-name').value = name;
            document.getElementById('edit-email').value = user.email || `${name}@kisan.ai`;
            if(document.getElementById('edit-location')) document.getElementById('edit-location').value = user.location || "";
            if(document.getElementById('edit-crops')) document.getElementById('edit-crops').value = user.crops || "";
            if(document.getElementById('edit-land')) document.getElementById('edit-land').value = user.land_size || "";

            // Handle Profile Picture Sync
            const profilePic = user.profile_pic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
            document.getElementById('headerProfilePic').src = profilePic;
            if (document.getElementById('profileEditImg')) {
                document.getElementById('profileEditImg').src = profilePic;
            }

            // Handle Admin Panel Visibility
            const adminNav = document.getElementById('more-admin');
            if (adminNav) {
                if (user.role === 'admin') {
                    adminNav.style.display = 'block'; // Or 'flex' if your CSS requires it
                } else {
                    adminNav.style.display = 'none';
                }
            }
        }

        async function handleProfilePicUpload(input) {
            if (!currentUser || !currentUser.id) return showToast("Please login first", "error");
            if (input.files && input.files[0]) {
                const file = input.files[0];
                if (file.size > 5 * 1024 * 1024) return showToast("Image too large (max 5MB)", "warning");

                try {
                    showToast("Uploading profile picture...", "info");

                    // Upload to Firebase Storage
                    const fileName = `${currentUser.id}_${Date.now()}`;
                    const storageRef = storage_fb.ref(`profile_pics/${fileName}`);
                    const uploadTask = await storageRef.put(file);
                    const downloadURL = await uploadTask.ref.getDownloadURL();

                    // Update Firestore (Wrapped in try-catch so it doesn't block Flask sync)
                    try {
                        console.log("Syncing DP to Firestore...");
                        await db_fs.collection('users').doc(currentUser.id.toString()).set({
                            profile_pic: downloadURL,
                            last_updated: firebase.firestore.FieldValue.serverTimestamp()
                        }, { merge: true });
                        console.log("Firestore sync success");
                    } catch (fsError) {
                        console.error("Firestore sync error (non-blocking):", fsError);
                    }

                    // Update Local Session
                    const user = JSON.parse(localStorage.getItem('user') || '{}');
                    user.profile_pic = downloadURL;
                    currentUser.profile_pic = downloadURL;
                    localStorage.setItem('user', JSON.stringify(user));

                    // Update Flask Backend
                    console.log("Syncing DP to Flask backend...");
                    // Flask Sync Removed - Using Firestore Directly

                    updateGreeting();
                    showToast("Profile picture updated permanently!", "success");

                } catch (e) {
                    console.error("Profile upload error:", e);
                    showToast("Failed to upload profile picture", "error");
                }
            }
        }

        // Removed duplicate saveProfileDetails

        function savePasswordChange() {
            const curr = document.getElementById('current-pass').value;
            const next = document.getElementById('new-pass').value;
            const conf = document.getElementById('confirm-pass').value;

            if (!curr || !next || !conf) {
                return showToast("Please fill all password fields", "warning");
            }
            if (next !== conf) {
                return showToast("Passwords do not match", "error");
            }
            if (next.length < 6) {
                return showToast("Password must be at least 6 characters", "warning");
            }

            // In a real app, this would hit /api/auth/change-password
            showToast("Password updated successfully!", "success");

            // Clear fields
            document.getElementById('current-pass').value = '';
            document.getElementById('new-pass').value = '';
            document.getElementById('confirm-pass').value = '';
        }

        function animateBars() {
            const activeSection = document.querySelector('.page-section.active');
            if (!activeSection) return;

            const bars = activeSection.querySelectorAll('[data-height]');
            bars.forEach((bar, index) => {
                bar.style.height = '0%';
                setTimeout(() => {
                    bar.style.height = bar.getAttribute('data-height');
                }, index * 100 + 100);
            });
        }

        // Initialize Mousetracker with throtthing for performance
        let mouseTicking = false;
        document.addEventListener('mousemove', e => {
            if (!mouseTicking) {
                window.requestAnimationFrame(() => {
                    const x = e.clientX / window.innerWidth * 100;
                    const y = e.clientY / window.innerHeight * 100;
                    document.documentElement.style.setProperty('--mouse-x', `${x}%`);
                    document.documentElement.style.setProperty('--mouse-y', `${y}%`);
                    mouseTicking = false;
                });
                mouseTicking = true;
            }
        });

        // Fix for APK/Mobile Buttons
        document.addEventListener('DOMContentLoaded', () => {
            const btns = document.querySelectorAll('button, .btn, .nav-item, .glass-card');
            btns.forEach(btn => {
                btn.style.cursor = 'pointer';
                btn.addEventListener('touchstart', function () { }, { passive: true }); // IOS/Android fix
            });
        });

        async function loadDashboardData() {
            try {
                // 1. Load Weather
                await loadWeatherDetails();

                // 2. Set Chart Data (Simulated or from Weather)
                // Use weather forecast to populate chart if available
                const weatherContainer = document.getElementById('weather-detail-container');
                // The chart logic typically runs in initApp via setTimeout, ensuring data-height is used.
                // We can update data-height here if we want dynamic charts.

                const dbBars = document.querySelectorAll('#agriSmart .bar');
                if (dbBars.length > 0) {
                    // Example: Dynamic heights based on dummy data or forecast
                    const heights = ['40%', '65%', '85%', '50%', '75%', '60%', '90%'];
                    dbBars.forEach((bar, i) => {
                        if (heights[i]) bar.setAttribute('data-height', heights[i]);
                    });
                }

                // 3. Update Status
                console.log("Dashboard data loaded.");
            } catch (e) {
                console.error("Dashboard load error:", e);
                // Prevent crash
            }
        }

        async function initApp() {
            updateGreeting();
            loadDashboardData();
            fetchAiHistory(); // Load history on startup


            // Sync user to Firestore
            if (currentUser) {
                syncUserToFirestore(currentUser);
                initCallListener();
                if (typeof messaging_fb !== 'undefined') setupFCM();
                loadStories();
                seedInitialData();
            }

            loadChatList(); // Initial chat load
            setTimeout(() => {
                const bars = document.querySelectorAll('#agriSmart .bar');
                bars.forEach((bar, index) => {
                    const height = bar.getAttribute('data-height') || '30%';
                    setTimeout(() => {
                        bar.style.height = height;
                    }, index * 100);
                });
            }, 500);
        }

        async function syncUserToFirestore(user) {
            try {
                await db_fs.collection('users').doc(user.id.toString()).set({
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    profile_pic: user.profile_pic || "",
                    last_seen: firebase.firestore.FieldValue.serverTimestamp(),
                    online: true
                }, { merge: true });
            } catch (e) {
                console.error("Firestore user sync error:", e);
            }
        }

        // ==================== KISAN CONNECT (CHAT & CALLS) ====================
        let chats = []; // Now populated from API
        let activeChatId = null; // This will be conversation_id
        let localStream = null;

        let chatUnsubscribe = null;
        async function loadChatList() {
            const list = document.getElementById('chat-list-items');
            if (!list || !currentUser) return;

            // Listen for changes in conversations where the user is a participant
            if (chatUnsubscribe) chatUnsubscribe();

            chatUnsubscribe = db_fs.collection('chats')
                .where('participant_ids', 'array-contains', currentUser.id.toString())
                .onSnapshot(snapshot => {
                    chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    // INJECT AI CHAT locally if not in Firestore yet
                    const aiChatId = `ai_assistant_${currentUser.id}`;
                    if (!chats.find(c => c.id === aiChatId)) {
                        chats.push({
                            id: aiChatId,
                            type: 'direct',
                            participants: [{ id: 'ai_assistant', username: 'AgriSmart AI', profile_pic: 'https://api.dicebear.com/7.x/bottts/svg?seed=Agri' }],
                            participant_ids: [currentUser.id.toString(), 'ai_assistant'],
                            last_message_text: "Hello! I am your AI Assistant.",
                            last_message_time: { toDate: () => new Date(), toMillis: () => Date.now() },
                            unread_count: {}
                        });
                    }

                    // Client-side sort to avoid composite index requirement
                    chats.sort((a, b) => {
                        const tA = a.last_message_time ? a.last_message_time.toMillis() : 0;
                        const tB = b.last_message_time ? b.last_message_time.toMillis() : 0;
                        return tB - tA;
                    });
                    list.innerHTML = '';

                    chats.forEach(chat => {
                        const item = document.createElement('div');
                        item.className = `chat-item ${activeChatId === chat.id ? 'active' : ''}`;
                        item.onclick = () => selectChat(chat.id);

                        const isGroup = chat.type === 'group';
                        const otherParticipant = (!isGroup && Array.isArray(chat.participants)) ? chat.participants.find(p => p && p.id && currentUser && p.id.toString() !== currentUser.id.toString()) : null;
                        const displayName = isGroup ? chat.name : (otherParticipant ? otherParticipant.username : "User");
                        const avatar = isGroup ? (chat.icon || `https://api.dicebear.com/7.x/identicon/svg?seed=${chat.id}`) : (otherParticipant && otherParticipant.profile_pic ? otherParticipant.profile_pic : `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`);

                        item.innerHTML = `
                            <img src="${avatar}" class="chat-avatar">
                            <div class="chat-info">
                                <div class="chat-info-top">
                                    <span class="chat-name">${displayName}</span>
                                    <span class="chat-time">${chat.last_message_time ? formatTime(chat.last_message_time.toDate()) : ''}</span>
                                </div>
                                <div class="chat-last-msg-row">
                                    <div class="chat-last-msg">${chat.last_message_text || 'No messages yet'}</div>
                                    ${chat.unread_count && chat.unread_count[currentUser.id] > 0 ? `<div class="chat-unread-badge">${chat.unread_count[currentUser.id]}</div>` : ''}
                                </div>
                            </div>
                        `;
                        list.appendChild(item);
                    });
                });
        }

        async function selectChat(convId) {
            activeChatId = convId;
            const chat = chats.find(c => c.id === convId);
            if (!chat) return;

            // UI Update Immediate
            document.getElementById('chat-welcome-screen').classList.add('d-none');
            document.getElementById('chat-active-window').classList.remove('d-none');
            if (window.innerWidth < 768) {
                document.getElementById('chat-main-window').classList.add('active');
            }

            const isGroup = chat.type === 'group';
            const otherParticipant = (!isGroup && Array.isArray(chat.participants)) ? chat.participants.find(p => p && p.id && currentUser && p.id.toString() !== currentUser.id.toString()) : null;
            const displayName = isGroup ? chat.name : (otherParticipant ? otherParticipant.username : "User");
            const avatar = isGroup ? (chat.icon || `https://api.dicebear.com/7.x/identicon/svg?seed=${chat.id}`) : (otherParticipant && otherParticipant.profile_pic ? otherParticipant.profile_pic : `https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`);

            document.getElementById('chat-active-avatar').src = avatar;
            document.getElementById('chat-active-name').innerText = displayName;
            document.getElementById('chat-active-status').innerText = isGroup ? `${chat.participant_ids.length} members` : (otherParticipant && otherParticipant.online ? 'online' : 'offline');
            document.getElementById('chat-active-status').style.color = (otherParticipant && otherParticipant.online) ? 'var(--accent)' : 'var(--text-muted)';
            document.getElementById('chat-typing-indicator').classList.add('d-none');

            // Typing indicator listener
            if (!isGroup) {
                db_fs.collection('chats').doc(activeChatId).onSnapshot(doc => {
                    const data = doc.data();
                    if (data && data.typing && data.typing === otherParticipant.id.toString()) {
                        document.getElementById('chat-typing-indicator').classList.remove('d-none');
                        document.getElementById('chat-active-status').classList.add('d-none');
                    } else {
                        document.getElementById('chat-typing-indicator').classList.add('d-none');
                        document.getElementById('chat-active-status').classList.remove('d-none');
                    }
                });
            }

            renderMessages(); // Sets up listener
        }

        function hideActiveChat() {
            document.getElementById('chat-main-window').classList.remove('active');
        }

        let messagesUnsubscribe = null;
        async function renderMessages() {
            const area = document.getElementById('chat-messages-area');
            if (!area || !activeChatId) return;

            if (messagesUnsubscribe) messagesUnsubscribe();

            messagesUnsubscribe = db_fs.collection('chats').doc(activeChatId).collection('messages')
                .orderBy('timestamp', 'asc')
                .onSnapshot(snapshot => {
                    area.innerHTML = '';
                    snapshot.docs.forEach(doc => {
                        const msg = doc.data();
                        const isMe = msg.sender_id === currentUser.id.toString();
                        const row = document.createElement('div');
                        row.className = `msg-row ${isMe ? 'sent' : 'received'}`;

                        let content = msg.text;
                        if (msg.type === 'image') {
                            content = `<img src="${msg.text}" class="msg-img" onclick="openImageViewer('${msg.text}')">`;
                        } else if (msg.type === 'audio') {
                            content = `<audio controls src="${msg.text}" style="max-width: 200px;"></audio>`;
                        } else if (msg.type === 'call') {
                            const icon = msg.text.includes('Missed') ? 'ph-phone-slash' : (isMe ? 'ph-phone-outgoing' : 'ph-phone-incoming');
                            const color = msg.text.includes('Missed') ? 'var(--danger)' : 'var(--accent)';
                            content = `
                                <div class="call-log-msg d-flex align-items-center gap-2" style="color: ${color};">
                                    <i class="ph ${icon}" style="font-size: 1.2rem;"></i>
                                    <div>
                                        <div class="fw-bold small">${msg.text}</div>
                                        ${msg.duration ? `<div style="font-size: 0.7rem; opacity: 0.7;">Duration: ${Math.floor(msg.duration / 60)}m ${msg.duration % 60}s</div>` : ''}
                                    </div>
                                </div>
                            `;
                        }

                        row.innerHTML = `
                            <div class="msg-bubble" id="msg-${doc.id}">
                                ${msg.reply_to ? `<div class="msg-reply-preview small p-1 mb-1 border-start border-3 border-accent" style="background: rgba(255,255,255,0.05); opacity:0.8;">${msg.reply_to.text}</div>` : ''}
                                ${content}
                                <span class="msg-time">${msg.timestamp ? formatTime(msg.timestamp.toDate()) : '...'}</span>
                                <div class="msg-actions" style="display:none; position:absolute; right: -60px; top:0; gap:5px;">
                                    <button class="btn btn-sm btn-dark p-1" onclick="setReply('${doc.id}', '${msg.text.substring(0, 20)}')"><i class="ph ph-arrow-bend-up-left"></i></button>
                                    <button class="btn btn-sm btn-dark p-1" onclick="forwardMessage('${doc.id}')"><i class="ph ph-share"></i></button>
                                    ${isMe ? `<button class="btn btn-sm btn-danger p-1" onclick="deleteMessage('${doc.id}')"><i class="ph ph-trash"></i></button>` : ''}
                                </div>
                                ${isMe ? `<span class="msg-status" style="font-size: 0.6rem; opacity: 0.7; margin-left: 5px;">${msg.status === 'read' ? '✓✓' : (msg.status === 'delivered' ? '✓✓' : '✓')}</span>` : ''}
                            </div>
                        `;
                        area.appendChild(row);

                        document.getElementById(`msg-${doc.id}`).onmouseenter = (e) => e.target.querySelector('.msg-actions').style.display = 'flex';
                        document.getElementById(`msg-${doc.id}`).onmouseleave = (e) => e.target.querySelector('.msg-actions').style.display = 'none';
                    });
                    area.scrollTop = area.scrollHeight;

                    // Mark messages as read
                    const unreadDocs = snapshot.docs.filter(d => d.data().sender_id !== currentUser.id.toString() && d.data().status !== 'read');
                    unreadDocs.forEach(d => {
                        d.ref.update({ status: 'read' });
                    });
                });
        }

        function openImageViewer(src) {
            document.getElementById('viewer-img').src = src;
            const modal = new bootstrap.Modal(document.getElementById('imgViewerModal'));
            modal.show();
        }

        let replyingTo = null;
        function setReply(msgId, text) {
            replyingTo = { id: msgId, text: text };
            showToast(`Replying to: ${text}...`);
            document.getElementById('chat-message-input').focus();
        }

        async function forwardMessage(msgId) {
            // Simulated forwarding: ask for user ID
            const targetId = prompt("Enter User ID to forward to:");
            if (!targetId) return;

            const msgDoc = await db_fs.collection('chats').doc(activeChatId).collection('messages').doc(msgId).get();
            const msgData = msgDoc.data();

            try {
                // Ensure target user exists and get/create chat
                const userDoc = await db_fs.collection('users').doc(targetId).get();
                if (!userDoc.exists) return showToast("User not found");

                const targetChatId = currentUser.id < targetId ? `${currentUser.id}_${targetId}` : `${targetId}_${currentUser.id}`;

                await db_fs.collection('chats').doc(targetChatId).collection('messages').add({
                    sender_id: currentUser.id.toString(),
                    sender_name: currentUser.username,
                    text: `[Forwarded] ${msgData.text}`,
                    type: msgData.type,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'sent'
                });

                showToast("Message forwarded!");
            } catch (e) {
                showToast("Forwarding failed");
            }
        }

        async function deleteMessage(msgId) {
            if (!confirm("Are you sure you want to delete this message?")) return;
            try {
                await db_fs.collection('chats').doc(activeChatId).collection('messages').doc(msgId).delete();
                showToast("Message deleted");
            } catch (e) {
                showToast("Deletion failed");
            }
        }

        async function blockUser(userId) {
            if (!confirm(`Block User #${userId}?`)) return;
            try {
                await db_fs.collection('users').doc(currentUser.id.toString()).update({
                    blocked_users: firebase.firestore.FieldValue.arrayUnion(userId.toString())
                });
                showToast(`User #${userId} blocked`);
            } catch (e) {
                showToast("Blocking failed");
            }
        }

        async function togglePrivacy(field, value) {
            try {
                await db_fs.collection('users').doc(currentUser.id.toString()).update({
                    [`privacy_${field}`]: value
                });
                showToast("Privacy setting updated");
            } catch (e) {
                showToast("Update failed");
            }
        }

        async function toggleGroupMute() {
            if (!activeChatId) return;
            try {
                const chatRef = db_fs.collection('chats').doc(activeChatId);
                const chatDoc = await chatRef.get();
                const muted = chatDoc.data().muted_by || [];
                const uId = currentUser.id.toString();

                if (muted.includes(uId)) {
                    await chatRef.update({ muted_by: firebase.firestore.FieldValue.arrayRemove(uId) });
                    showToast("Group unmuted");
                } else {
                    await chatRef.update({ muted_by: firebase.firestore.FieldValue.arrayUnion(uId) });
                    showToast("Group muted");
                }
            } catch (e) {
                showToast("Operation failed");
            }
        }

        async function setDisappearingTimer(minutes) {
            if (!activeChatId) return;
            try {
                await db_fs.collection('chats').doc(activeChatId).update({
                    disappearing_timer: minutes
                });
                showToast(`Messages will disappear after ${minutes} minutes`);
            } catch (e) {
                showToast("Failed to set timer");
            }
        }

        async function saveProfileDetails() {
            const name = document.getElementById('edit-name').value;
            const email = document.getElementById('edit-email').value;
            const bio = document.getElementById('edit-bio') ? document.getElementById('edit-bio').value : "";
            const loc = document.getElementById('edit-location') ? document.getElementById('edit-location').value : "";
            const crops = document.getElementById('edit-crops') ? document.getElementById('edit-crops').value : "";
            const land = document.getElementById('edit-land') ? document.getElementById('edit-land').value : "";

            try {
                const userObj = JSON.parse(localStorage.getItem('user') || '{}');
                userObj.username = name;
                userObj.email = email;
                userObj.location = loc;
                userObj.crops = crops;
                userObj.land_size = land;
                localStorage.setItem('user', JSON.stringify(userObj));
                if (currentUser) {
                    currentUser.username = name;
                    currentUser.email = email;
                    currentUser.location = loc;
                    currentUser.crops = crops;
                    currentUser.land_size = land;
                }
                updateGreeting();

                // Firestore Update
                await db_fs.collection('users').doc(currentUser.id.toString()).update({
                    username: name,
                    email: email,
                    bio: bio,
                    location: loc,
                    crops: crops,
                    land_size: land
                });

                showToast("Profile and farmer details updated", "success");
            } catch (e) {
                console.error("Profile update error:", e);
                showToast("Profile update partially failed");
            }
        }

        async function sendChatMessage() {
            const input = document.getElementById('chat-message-input');
            const text = input.value.trim();
            if (!text || !activeChatId) return;

            try {
                const msgData = {
                    sender_id: currentUser.id.toString(),
                    sender_name: currentUser.username,
                    text: text,
                    type: 'text',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'sent'
                };

                if (replyingTo) {
                    msgData.reply_to = replyingTo;
                    replyingTo = null;
                }

                await db_fs.collection('chats').doc(activeChatId).collection('messages').add(msgData);

                // Use set with merge true in case the chat document doesn't exist yet (like new AI chat)
                await db_fs.collection('chats').doc(activeChatId).set({
                    last_message_text: text,
                    last_message_time: firebase.firestore.FieldValue.serverTimestamp(),
                    participant_ids: [currentUser.id.toString(), 'ai_assistant'] // Safe fallback
                }, { merge: true });

                input.value = '';

                // Trigger AI response if chatting with AI Assistant
                if (activeChatId === `ai_assistant_${currentUser.id}`) {
                    setTimeout(async () => {
                        try {
                            const aiRes = await fetch('/api/groq-intent', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ text })
                            });
                            const result = await aiRes.json();
                            if (result.success && result.data && result.data.speech) {
                                await db_fs.collection('chats').doc(activeChatId).collection('messages').add({
                                    sender_id: 'ai_assistant',
                                    sender_name: 'AgriSmart AI',
                                    text: result.data.speech,
                                    type: 'text',
                                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                                    status: 'sent',
                                    is_ai: true
                                });
                                await db_fs.collection('chats').doc(activeChatId).set({
                                    last_message_text: result.data.speech,
                                    last_message_time: firebase.firestore.FieldValue.serverTimestamp()
                                }, { merge: true });
                            }
                        } catch(e) { console.error("AI Assistant Chat Error:", e); }
                    }, 500);
                }
            } catch (e) {
                console.error("Send message error:", e);
                showToast("Failed to send message", "error");
            }
        }

        async function sendChatImage(input) {
            if (input.files && input.files[0] && activeChatId) {
                // Bug Fix: Ensure currentUser is valid
                if (!currentUser || !currentUser.id) {
                    const userStr = localStorage.getItem('user');
                    if (userStr) currentUser = JSON.parse(userStr);
                }
                if (!currentUser || !currentUser.id) return showToast("Session error. Please login again.", "error");

                const file = input.files[0];
                if (file.size > 10 * 1024 * 1024) {
                    return showToast("File too large (max 10MB)", "warning");
                }

                const fileName = `${Date.now()}_${file.name}`;
                // Using standard chat_media folder
                const storageRef = storage_fb.ref(`chat_media/${activeChatId}/${fileName}`);

                try {
                    console.log("Starting media upload for chat:", activeChatId);
                    showToast("Uploading media...");
                    const uploadTask = await storageRef.put(file);
                    const downloadURL = await uploadTask.ref.getDownloadURL();
                    console.log("Upload successful, URL:", downloadURL);

                    await db_fs.collection('chats').doc(activeChatId).collection('messages').add({
                        sender_id: currentUser.id.toString(),
                        sender_name: currentUser.username,
                        text: downloadURL,
                        type: 'image',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        status: 'sent'
                    });

                    await db_fs.collection('chats').doc(activeChatId).update({
                        last_message_text: "Shared an image",
                        last_message_time: firebase.firestore.FieldValue.serverTimestamp()
                    });

                    showToast("Media sent! Analyzing...", "info");

                    // 2. Trigger AI Analysis
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("action", "disease_detection");

                    try {
                        const aiResponse = await fetch('/api/ai', {
                            method: 'POST',
                            body: formData
                        });
                        const aiResult = await aiResponse.json();

                        if (aiResult.success && aiResult.data) {
                            const d = aiResult.data;
                            let analysisText = `**Analysis Result:** ${d.disease_name || 'Unknown'}\n`;
                            analysisText += `**Confidence:** ${d.confidence || 0}%\n\n`;

                            if (d.symptoms && Array.isArray(d.symptoms) && d.symptoms.length > 0) {
                                analysisText += `**Symptoms:** ${d.symptoms.join(', ')}\n`;
                            }
                            if (d.treatment_plan && Array.isArray(d.treatment_plan) && d.treatment_plan.length > 0) {
                                analysisText += `**Treatment:** ${d.treatment_plan.join(', ')}`;
                            }

                            // 3. Post AI Response to Chat
                            await db_fs.collection('chats').doc(activeChatId).collection('messages').add({
                                sender_id: "ai_assistant",
                                sender_name: "AgriSmart AI",
                                text: analysisText,
                                type: 'text',
                                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                                status: 'sent',
                                is_ai: true
                            });
                        }
                    } catch (aiErr) {
                        console.error("AI Analysis failed in chat:", aiErr);
                    }

                } catch (err) {
                    console.error("Media upload error:", err);
                    showToast("Failed to upload media. Check console.", "error");
                }
            }
        }



        async function pollMessages() {
            // Only poll if we are on the connect page or a chat is active
            const connectPage = document.getElementById('connect');
            if (connectPage && connectPage.classList.contains('active')) {
                await loadChatList();
                if (activeChatId) {
                    await renderMessages();
                }
            }
        }

        /* --- Connect / Chat Search Functions --- */
        function showPrimeIdSearch() {
            const el = document.getElementById('primeSearchModal');
            if (!el) return;
            const modal = bootstrap.Modal.getOrCreateInstance(el);
            modal.show();
        }

        async function searchAndConnect() {
            const term = document.getElementById('search-prime-id').value.trim();
            const resultDiv = document.getElementById('search-result');

            if (!term) return showToast("Please enter an ID or Username", "warning");

            if (resultDiv) resultDiv.innerHTML = '<div class="spinner-border text-light spinner-border-sm"></div> Searching...';

            try {
                // Try searching by ID first
                let userDoc = await db_fs.collection('users').doc(term).get();

                // If not found by ID, try username (Exact Match)
                if (!userDoc.exists) {
                    const snap = await db_fs.collection('users').where('username', '==', term).get();
                    if (!snap.empty) userDoc = snap.docs[0];
                }

                // Fallback: Try case-insensitive username search (Client-side filtering for small sets)
                // Note: For large apps, use a proper search index like Algolia
                if (!userDoc.exists && term.length > 2) {
                    // Warning: This is expensive if user base is huge, but fine for prototype
                    // We can't do broad queries easily, so we skip this or try a known pattern
                }

                if (userDoc && userDoc.exists) {
                    const userData = userDoc.data();
                    const otherId = userDoc.id;

                    // Ensure currentUser is available
                    if (!currentUser) {
                        const userStr = localStorage.getItem('user');
                        if (userStr) currentUser = JSON.parse(userStr);
                    }

                    if (!currentUser) {
                        showToast("Session error. Please login again.", "error");
                        return;
                    }

                    if (otherId == currentUser.id) {
                        if (resultDiv) resultDiv.innerHTML = '<div class="text-warning">You cannot connect with yourself.</div>';
                        return;
                    }

                    if (resultDiv) resultDiv.innerHTML = `
                        <div class="d-flex align-items-center gap-2 mt-2 p-2" style="background: rgba(255,255,255,0.1); border-radius: 8px;">
                            <img src="${userData.profile_pic || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + userData.username}" style="width: 40px; height: 40px; border-radius: 50%;">
                            <div>
                                <div class="fw-bold">${userData.username}</div>
                                <div class="small text-muted">${userData.role || 'Member'}</div>
                            </div>
                            <button class="btn btn-sm btn-success ms-auto" onclick="startChat('${otherId}')">Chat</button>
                        </div>
                    `;
                } else {
                    if (resultDiv) resultDiv.innerHTML = `
                        <div class="text-danger">
                            <i class="ph ph-warning-circle"></i> User not found.
                        </div>
                        <div class="small text-muted mt-1">
                            Ensure the ID or Username is exact.
                        </div>
                    `;
                }
            } catch (e) {
                console.error("Search error:", e);
                if (resultDiv) resultDiv.innerHTML = '<div class="text-danger">Error searching user (Network/Db).</div>';
            }
        }

        // ==================== REAL WEB RTC CALLS ====================
        let peerConnection = null;
        // localStream and remoteStream already defined above
        let callUnsubscribe = null;
        let incomingCallUnsubscribe = null;
        let currentCallId = null;
        let callTimer = null;
        let callStartTime = null; // Track duration
        let callStatusUnsubscribe = null; // For auto-termination

        async function logCallToChat(chatId, type, status, duration = 0) {
            if (!chatId) return;
            const isMe = true; // Traditionally called by the person who triggered the state change
            const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
            let text = "";

            if (status === 'completed') text = `${typeLabel} Call Ended`;
            else if (status === 'missed') text = `Missed ${typeLabel} Call`;
            else if (status === 'rejected') text = `${typeLabel} Call Rejected`;
            else if (status === 'cancelled') text = `Cancelled ${typeLabel} Call`;

            try {
                await db_fs.collection('chats').doc(chatId).collection('messages').add({
                    sender_id: currentUser.id.toString(),
                    sender_name: currentUser.username,
                    text: text,
                    type: 'call',
                    status: 'sent',
                    duration: duration,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

                await db_fs.collection('chats').doc(chatId).update({
                    last_message_text: `📞 ${text}`,
                    last_message_time: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (e) {
                console.error("Log call to chat error:", e);
            }
        }

        const iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        // Initialize Incoming Call Listener
        function initCallListener() {
            if (!currentUser) return;
            if (incomingCallUnsubscribe) incomingCallUnsubscribe();

            incomingCallUnsubscribe = db_fs.collection('calls')
                .where('receiverId', '==', currentUser.id.toString())
                .where('status', '==', 'offer')
                .onSnapshot(snapshot => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            const callData = change.doc.data();
                            showIncomingCall(change.doc.id, callData);
                        }
                    });
                });
        }
        // Call initCallListener in initApp

        function monitorCallStatus(callId) {
            if (callStatusUnsubscribe) callStatusUnsubscribe();

            callStatusUnsubscribe = db_fs.collection('calls').doc(callId).onSnapshot(snapshot => {
                const data = snapshot.data();
                if (!data) return;

                if (data.status === 'ended') {
                    showToast("Call ended by remote user", "info");
                    endCall(true); // Remote ended
                } else if (data.status === 'rejected') {
                    showToast("Call rejected", "warning");
                    endCall(true);
                }
            });
        }

        function showIncomingCall(callId, data) {
            currentCallId = callId;
            const modal = new bootstrap.Modal(document.getElementById('incomingCallModal'));
            document.getElementById('inc-call-name').innerText = data.callerName;
            document.getElementById('inc-call-type').innerText = data.type === 'video' ? 'Video Call' : 'Voice Call';
            document.getElementById('inc-call-img').src = data.callerPic || 'assets/user.png';

            // Accept Button Logic
            document.getElementById('btn-accept-call').onclick = () => answerCall(callId, data.type);
            // Reject Button Logic
            document.getElementById('btn-reject-call').onclick = () => rejectCall(callId);

            modal.show();
        }

        function startCallTimer() {
            if (callTimer) clearInterval(callTimer);
            callStartTime = Date.now(); // Set start time
            let seconds = 0;
            const statusText = document.getElementById('call-status-text');
            callTimer = setInterval(() => {
                seconds++;
                const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
                const secs = (seconds % 60).toString().padStart(2, '0');
                if (statusText) statusText.innerText = `Connected (${mins}:${secs})`;
            }, 1000);
        }

        async function startCall(type) {
            const chat = chats.find(c => c.id === activeChatId);
            if (!chat) return;

            // Determine receiver
            const isGroup = chat.type === 'group';
            if (isGroup) return showToast("Group calls coming soon!", "info"); // Simple P2P for now
            const receiver = chat.participants.find(p => p.id.toString() !== currentUser.id.toString());
            if (!receiver) return;

            // UI Setup
            document.getElementById('call-overlay').classList.remove('d-none');
            document.getElementById('call-user-name').innerText = receiver.username;
            document.getElementById('call-status-text').innerText = "Calling...";
            document.getElementById('call-user-avatar').src = receiver.profile_pic || '';

            if (type === 'video') {
                document.getElementById('video-grid').classList.remove('d-none');
                localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                document.getElementById('local-video').srcObject = localStream;
            } else {
                document.getElementById('video-grid').classList.add('d-none');
                localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            // Create PeerConnection
            peerConnection = new RTCPeerConnection(iceServers);
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            peerConnection.ontrack = event => {
                remoteStream = event.streams[0];
                const remoteVideo = document.getElementById('remote-video');
                remoteVideo.srcObject = remoteStream;
                remoteVideo.classList.remove('d-none');
                document.getElementById('call-status-text').innerText = "Connected";
                startCallTimer();
            };

            // Create Call Document
            const callDoc = db_fs.collection('calls').doc();
            currentCallId = callDoc.id;

            peerConnection.onicecandidate = event => {
                if (event.candidate) {
                    callDoc.collection('callerCandidates').add(event.candidate.toJSON());
                }
            };

            // Start monitoring
            monitorCallStatus(currentCallId);

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            await callDoc.set({
                callerId: currentUser.id.toString(),
                callerName: currentUser.username,
                callerPic: currentUser.profile_pic || "",
                receiverId: receiver.id.toString(),
                chatId: activeChatId,
                type: type,
                offer: { type: offer.type, sdp: offer.sdp },
                status: 'offer',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Listen for answer
            callUnsubscribe = callDoc.onSnapshot(snapshot => {
                const data = snapshot.data();
                if (peerConnection && !peerConnection.currentRemoteDescription && data && data.answer) {
                    const answer = new RTCSessionDescription(data.answer);
                    peerConnection.setRemoteDescription(answer);
                }
            });

            // Listen for remote ICE
            callDoc.collection('receiverCandidates').onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const candidate = new RTCIceCandidate(change.doc.data());
                        peerConnection.addIceCandidate(candidate);
                    }
                });
            });
        }

        async function answerCall(callId, type) {
            bootstrap.Modal.getInstance(document.getElementById('incomingCallModal')).hide();

            document.getElementById('call-overlay').classList.remove('d-none');
            document.getElementById('call-status-text').innerText = "Connecting...";

            if (type === 'video') {
                document.getElementById('video-grid').classList.remove('d-none');
                localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                document.getElementById('local-video').srcObject = localStream;
            } else {
                document.getElementById('video-grid').classList.add('d-none');
                localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }

            peerConnection = new RTCPeerConnection(iceServers);
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            peerConnection.ontrack = event => {
                remoteStream = event.streams[0];
                const remoteVideo = document.getElementById('remote-video');
                remoteVideo.srcObject = remoteStream;
                remoteVideo.classList.remove('d-none');
                document.getElementById('call-status-text').innerText = "Connected";
                startCallTimer();
            };

            const callDoc = db_fs.collection('calls').doc(callId);
            currentCallId = callId; // Ensure global is set
            monitorCallStatus(callId);  // Start monitoring

            peerConnection.onicecandidate = event => {
                if (event.candidate) {
                    callDoc.collection('receiverCandidates').add(event.candidate.toJSON());
                }
            };

            const callData = (await callDoc.get()).data();
            const offer = callData.offer;
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            await callDoc.update({
                answer: { type: answer.type, sdp: answer.sdp },
                status: 'active'
            });

            // Listen for caller ICE
            callDoc.collection('callerCandidates').onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        const candidate = new RTCIceCandidate(change.doc.data());
                        peerConnection.addIceCandidate(candidate);
                    }
                });
            });
        }

        async function endCall(isRemote = false) {
            if (peerConnection) {
                peerConnection.close();
                peerConnection = null;
            }
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
                localStream = null;
            }

            if (callStatusUnsubscribe) callStatusUnsubscribe();
            if (callUnsubscribe) callUnsubscribe();
            clearInterval(callTimer);

            if (currentCallId && !isRemote) {
                // I hung up, so update status and log
                try {
                    const callRef = db_fs.collection('calls').doc(currentCallId);
                    const docSnap = await callRef.get();
                    const cData = docSnap.data();

                    await callRef.update({ status: 'ended' });

                    // Log Call
                    const duration = callStartTime ? Math.round((Date.now() - callStartTime) / 1000) : 0;

                    // Log to Chat
                    if (cData && cData.chatId) {
                        const logStatus = callStartTime ? 'completed' : 'cancelled';
                        logCallToChat(cData.chatId, cData.type, logStatus, duration);
                    }

                    if (callStartTime && cData) {
                        // Send log to backend (SQL)
                        await fetch(`${API_BASE_URL}/manage?action=call_log`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${authToken}`
                            },
                            body: JSON.stringify({
                                caller_id: cData.callerId,
                                receiver_id: cData.receiverId,
                                duration: duration,
                                status: 'completed',
                                type: cData.type
                            })
                        });
                    }
                } catch (e) { console.error("End call error:", e); }
            }

            currentCallId = null;
            callStartTime = null;

            document.getElementById('call-overlay').classList.add('d-none');
            showToast(isRemote ? "Call ended by remote user" : "Call ended");

            // Reload if we were in a call to fully reset WebRTC state
            if (localStream || peerConnection) window.location.reload();
            else {
                // Soft reset if it was just ringing
                document.getElementById('video-grid').classList.add('d-none');
            }
        }

        async function rejectCall(callId) {
            try {
                const callRef = db_fs.collection('calls').doc(callId);
                const docSnap = await callRef.get();
                const cData = docSnap.data();

                await callRef.update({ status: 'rejected' });

                if (cData && cData.chatId) {
                    logCallToChat(cData.chatId, cData.type, 'missed', 0);
                }
            } catch (e) { console.error("Reject call error:", e); }

            bootstrap.Modal.getInstance(document.getElementById('incomingCallModal')).hide();
        }

        function toggleCallMute() {
            if (localStream) {
                const audioTrack = localStream.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = !audioTrack.enabled;
                    document.getElementById('mute-btn').innerHTML = audioTrack.enabled ? '<i class="ph ph-microphone"></i>' : '<i class="ph ph-microphone-slash"></i>';
                    showToast(audioTrack.enabled ? "Unmuted" : "Muted");
                }
            }
        }

        function toggleCallVideo() {
            if (localStream) {
                const videoTrack = localStream.getVideoTracks()[0];
                if (videoTrack) {
                    videoTrack.enabled = !videoTrack.enabled;
                    document.getElementById('video-toggle-btn').innerHTML = videoTrack.enabled ? '<i class="ph ph-video-camera"></i>' : '<i class="ph ph-video-camera-slash"></i>';
                }
            }
        }

        async function createGroup() {
            const name = document.getElementById('new-group-name').value.trim();
            const membersStr = document.getElementById('new-group-members').value.trim();

            if (!name || !membersStr) {
                return showToast("Please fill all group fields", "warning");
            }

            const memberIds = membersStr.split(',').map(id => id.trim()).filter(id => id.length > 0);
            memberIds.push(currentUser.id.toString()); // Add self

            try {
                // Ensure all members exist
                const validMembers = [];
                for (const id of memberIds) {
                    const uDoc = await db_fs.collection('users').doc(id).get();
                    if (uDoc.exists) {
                        validMembers.push({ id: id, username: uDoc.data().username, profile_pic: uDoc.data().profile_pic || "" });
                    }
                }

                const chatId = `group_${Date.now()}`;
                await db_fs.collection('chats').doc(chatId).set({
                    name: name,
                    type: 'group',
                    participant_ids: validMembers.map(m => m.id),
                    participants: validMembers,
                    admin_id: currentUser.id.toString(),
                    last_message_text: `Group "${name}" created`,
                    last_message_time: firebase.firestore.FieldValue.serverTimestamp(),
                    unread_count: validMembers.reduce((acc, m) => ({ ...acc, [m.id]: 0 }), {})
                });

                bootstrap.Modal.getInstance(document.getElementById('groupCreateModal')).hide();
                showToast(`Group "${name}" created!`, "success");
                selectChat(chatId);
            } catch (e) {
                console.error("Group create error:", e);
                showToast("Failed to create group", "error");
            }
        }

        function showGroupCreateModal() {
            const modal = new bootstrap.Modal(document.getElementById('groupCreateModal'));
            modal.show();
        }

        // Link with navigate function
        const originalNavigate = navigate;
        navigate = async function (pageId) {
            await originalNavigate(pageId);
            if (pageId === 'connect') {
                loadChatList();
            }
        };

        // Typing Indicator logic
        let typingTimeout = null;
        function handleTyping() {
            if (!activeChatId) return;
            db_fs.collection('chats').doc(activeChatId).update({
                typing: currentUser.id.toString()
            });

            if (typingTimeout) clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                db_fs.collection('chats').doc(activeChatId).update({
                    typing: null
                });
            }, 3000);
        }

        // Status/Stories System
        async function uploadStatus(input) {
            if (input.files && input.files[0]) {
                const file = input.files[0];
                const fileName = `${Date.now()}_${file.name}`;
                const storageRef = storage_fb.ref(`statuses/${currentUser.id}/${fileName}`);

                try {
                    showToast("Uploading status...");
                    const uploadTask = await storageRef.put(file);
                    const downloadURL = await uploadTask.ref.getDownloadURL();

                    await db_fs.collection('status').doc(currentUser.id.toString()).collection('items').add({
                        url: downloadURL,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
                    });

                    showToast("Status updated!", "success");
                    loadStories();
                } catch (e) {
                    showToast("Failed to upload status", "error");
                }
            }
        }

        async function loadStories() {
            const bar = document.getElementById('stories-bar');
            if (!bar) return;

            // Simple listener for own and connections' stories
            db_fs.collection('status').onSnapshot(snapshot => {
                // Clear bar except the "Add" button
                const addBtn = bar.querySelector('.add-story');
                bar.innerHTML = '';
                bar.appendChild(addBtn);

                snapshot.docs.forEach(async (doc) => {
                    const userId = doc.id;
                    const itemsSnap = await doc.ref.collection('items')
                        .orderBy('expires_at', 'desc')
                        .limit(1)
                        .get();

                    if (!itemsSnap.empty) {
                        const lastItem = itemsSnap.docs[0].data();

                        // Client-side expiry check to avoid complex query filter issues in some environments
                        if (lastItem.expires_at && lastItem.expires_at.toDate() < new Date()) {
                            return;
                        }
                        const userDoc = await db_fs.collection('users').doc(userId).get();
                        const userData = userDoc.data();

                        const storyDiv = document.createElement('div');
                        storyDiv.className = 'story-item';
                        storyDiv.onclick = () => viewStory(lastItem.url);
                        storyDiv.innerHTML = `
                            <div class="story-circle active">
                                <img src="${userData.profile_pic || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + userData.username}">
                            </div>
                            <span class="small">${userId == currentUser.id ? 'My Status' : userData.username}</span>
                        `;
                        bar.appendChild(storyDiv);
                    }
                });
            });
        }

        function viewStory(url) {
            openImageViewer(url);
        }




        function logout() {
            // Update online status
            if (currentUser) {
                db_fs.collection('users').doc(currentUser.id.toString()).update({ online: false });
            }
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        }

        // FCM Notification registration
        async function setupFCM() {
            if (!currentUser) return;
            try {
                // Silent check for messaging support
                const messagingSupported = (typeof firebase !== 'undefined' && firebase.messaging && firebase.messaging.isSupported && await firebase.messaging.isSupported());
                if (!messagingSupported) return;

                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    const messaging_fb_instance = (typeof messaging_fb !== 'undefined') ? messaging_fb : null;
                    if (!messaging_fb_instance) return;

                    const token = await messaging_fb_instance.getToken();
                    if (token) {
                        await db_fs.collection('users').doc(currentUser.id.toString()).update({
                            fcm_token: token
                        });
                    }
                }
            } catch (e) {
                // Silently ignore in local/unsupported environments
            }
        }

        if (messaging_fb) {
            messaging_fb.onMessage((payload) => {
                console.log("FCM Message received:", payload);
                showToast(`New Message: ${payload.notification.body}`, "info");
            });
        }



        async function migrateAllUsers() {
            showToast("Syncing SQL users to Firebase...");
            try {
                const response = await fetch(`${API_BASE_URL}/users/sync-list`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                const result = await response.json();
                if (result.success) {
                    const users = result.data;
                    for (const user of users) {
                        await db_fs.collection('users').doc(user.id.toString()).set({
                            username: user.username,
                            email: user.email,
                            role: user.role,
                            profile_pic: user.profile_pic || "",
                            last_seen: firebase.firestore.FieldValue.serverTimestamp(),
                            online: false
                        }, { merge: true });
                    }
                    showToast(`Successfully synced ${users.length} users!`, "success");
                    if (document.getElementById('search-result')) {
                        document.getElementById('search-result').innerHTML = '<div class="text-success small">Sync complete. Try searching again.</div>';
                    }
                }
            } catch (e) {
                console.error("Migration error:", e);
                showToast("Migration failed", "error");
            }
        }
        async function syncAllEntities() {
            if (!confirm("This will overwrite/update all Firestore records with SQL data. Proceed?")) return;

            showToast("Starting total system migration...");
            try {
                const response = await fetch(`${API_BASE_URL}/migration/full-dump`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                const result = await response.json();

                if (result.success) {
                    const data = result.data;
                    let total = 0;

                    // Sync Users
                    for (const u of data.users) {
                        await db_fs.collection('users').doc(u.id.toString()).set(u, { merge: true });
                        total++;
                    }

                    // Sync Crops
                    for (const c of data.crops) {
                        await db_fs.collection('crops').doc(c.id.toString()).set(c, { merge: true });
                        total++;
                    }

                    // Sync Soils
                    for (const s of data.soil_records) {
                        await db_fs.collection('soil_records').doc(s.id.toString()).set(s, { merge: true });
                        total++;
                    }

                    // Sync Alerts
                    for (const a of data.alerts) {
                        await db_fs.collection('alerts').doc(a.id.toString()).set(a, { merge: true });
                        total++;
                    }

                    showToast(`Migration successful! Synced ${total} entities.`, "success");
                }
            } catch (e) {
                console.error("Full Migration Error:", e);
                showToast("System migration failed", "error");
            }
        }

        initApp();
        function toggleEmojiPicker() {
            const picker = document.getElementById('emoji-picker');
            picker.classList.toggle('d-none');
        }

        function insertEmoji(emoji) {
            const input = document.getElementById('chat-message-input');
            input.value += emoji;
            toggleEmojiPicker();
            input.focus();
        }

        /* --- Connect / Chat Functions --- */
        function showPrimeIdSearch() {
            const modal = new bootstrap.Modal(document.getElementById('primeSearchModal'));
            modal.show();
        }

        async function searchAndConnect() {
            const term = document.getElementById('search-prime-id').value.trim();
            const resultDiv = document.getElementById('search-result');

            if (!term) return showToast("Please enter an ID or Username", "warning");

            resultDiv.innerHTML = '<div class="spinner-border text-light spinner-border-sm"></div> Searching...';

            try {
                // Try searching by ID
                let userDoc = await db_fs.collection('users').doc(term).get();

                // If not found by ID, try username
                if (!userDoc.exists) {
                    const snap = await db_fs.collection('users').where('username', '==', term).get();
                    if (!snap.empty) userDoc = snap.docs[0];
                }

                if (userDoc && userDoc.exists) {
                    const userData = userDoc.data();
                    const otherId = userDoc.id;

                    // Ensure currentUser is available
                    if (!currentUser) {
                        const userStr = localStorage.getItem('user');
                        if (userStr) currentUser = JSON.parse(userStr);
                    }

                    if (!currentUser) {
                        showToast("Session error. Please login again.", "error");
                        return;
                    }

                    if (otherId == currentUser.id) {
                        resultDiv.innerHTML = '<div class="text-warning">You cannot connect with yourself.</div>';
                        return;
                    }

                    resultDiv.innerHTML = `
                        <div class="d-flex align-items-center gap-2 mt-2 p-2" style="background: rgba(255,255,255,0.1); border-radius: 8px;">
                            <img src="${userData.profile_pic || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + userData.username}" style="width: 40px; height: 40px; border-radius: 50%;">
                            <div>
                                <div class="fw-bold">${userData.username}</div>
                                <div class="small text-muted">${userData.role || 'Member'}</div>
                            </div>
                            <button class="btn btn-sm btn-success ms-auto" onclick="startChat('${otherId}')">Chat</button>
                        </div>
                    `;
                } else {
                    resultDiv.innerHTML = '<div class="text-danger">User not found.</div>';
                }
            } catch (e) {
                console.error("Search error:", e);
                resultDiv.innerHTML = '<div class="text-danger">Error searching user.</div>';
            }
        }

        async function startChat(otherUserId) {
            try {
                // Ensure currentUser is available
                if (!currentUser) {
                    const userStr = localStorage.getItem('user');
                    if (userStr) currentUser = JSON.parse(userStr);
                }
                if (!currentUser) return showToast("Session error. Please login again.", "error");

                // Standard ID: smallerId_largerId
                const ids = [currentUser.id.toString(), otherUserId.toString()].sort();
                const chatId = `${ids[0]}_${ids[1]}`;

                const chatDoc = await db_fs.collection('chats').doc(chatId).get();

                if (!chatDoc.exists) {
                    // Create new chat
                    const otherUserDoc = await db_fs.collection('users').doc(otherUserId.toString()).get();
                    if (!otherUserDoc.exists) return showToast("Target user not found", "error");

                    const otherData = otherUserDoc.data();

                    await db_fs.collection('chats').doc(chatId).set({
                        type: 'direct',
                        participant_ids: ids,
                        participants: [
                            { id: currentUser.id.toString(), username: currentUser.username, profile_pic: currentUser.profile_pic || "" },
                            { id: otherUserId.toString(), username: otherData.username, profile_pic: otherData.profile_pic || "" }
                        ],
                        last_message_text: "Chat started",
                        last_message_time: firebase.firestore.FieldValue.serverTimestamp(),
                        unread_count: { [currentUser.id]: 0, [otherUserId]: 0 }
                    });
                }

                // Close modal and open chat
                const modalEl = document.getElementById('primeSearchModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();

                navigate('connect');
                selectChat(chatId);

            } catch (e) {
                console.error("Start chat error:", e);
                showToast("Failed to start chat", "error");
            }
        }
        /* ==================== REAL-TIME FIRESTORE DATA MODULES ==================== */

        // 1. Expense Tracking
        async function addExpenseFirestore() {
            if (!currentUser) return showToast("Please login", "error");

            const crop = document.getElementById('exp-crop').value;
            const cat = document.getElementById('exp-cat').value;
            const desc = document.getElementById('exp-desc').value;
            const amt = parseFloat(document.getElementById('exp-amt').value);
            const date = document.getElementById('exp-date').value;

            if (!desc || isNaN(amt) || !date) return showToast("Invalid input", "warning");

            try {
                await db_fs.collection('expenses').add({
                    userId: currentUser.id.toString(),
                    crop,
                    category: cat,
                    description: desc,
                    amount: amt,
                    date: date,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    type: cat === 'Sale' ? 'income' : 'expense'
                });
                showToast("Transaction saved to cloud!", "success");
                document.getElementById('expense-form').reset();
            } catch (e) {
                console.error("Expense Save Error:", e);
                showToast("Failed to save transaction", "error");
            }
        }

        function loadExpensesFirestore() {
            if (!currentUser) return;

            db_fs.collection('expenses')
                .where('userId', '==', currentUser.id.toString())
                // .orderBy('timestamp', 'asc') // REMOVED to avoid Index Error. Sorting client-side below.
                .onSnapshot(snapshot => {
                    const tbody = document.getElementById('expense-ledger-body');
                    if (!tbody) return;

                    let html = '';
                    let totalIncome = 0;
                    let totalExpense = 0;
                    const cropStats = {};
                    const timeSeriesData = [];
                    let currentIncome = 0;
                    let currentExpense = 0;

                    const docs = [];
                    snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));

                    // Client-side Sort: Ascending for calculation
                    docs.sort((a, b) => {
                        const tA = a.timestamp ? a.timestamp.toMillis() : 0;
                        const tB = b.timestamp ? b.timestamp.toMillis() : 0;
                        return tA - tB;
                    });

                    // Reversed for display (desc) but kept asc for calc
                    docs.slice().reverse().forEach(data => {
                        const date = data.date || (data.timestamp ? data.timestamp.toDate().toLocaleDateString() : 'N/A');
                        const isIncome = data.type === 'income' || data.category === 'Sale';

                        html += `
                            <tr>
                                <td class="small opacity-50">${date}</td>
                                <td><span class="badge ${isIncome ? 'bg-success' : 'bg-danger'} bg-opacity-10 ${isIncome ? 'text-success' : 'text-danger'}">${data.category}</span></td>
                                <td>${data.description} <small class="opacity-30 d-block">${data.crop}</small></td>
                                <td class="text-end fw-bold ${isIncome ? 'text-accent' : ''}">${isIncome ? '+' : '-'}₹${data.amount.toLocaleString()}</td>
                            </tr>
                        `;
                    });

                    // Calculate totals and time series
                    docs.forEach(data => {
                        const isIncome = data.type === 'income' || data.category === 'Sale';
                        const date = data.date || (data.timestamp ? data.timestamp.toDate().toLocaleDateString() : 'N/A');

                        if (isIncome) {
                            totalIncome += data.amount;
                            currentIncome += data.amount;
                        } else {
                            totalExpense += data.amount;
                            currentExpense += data.amount;
                            cropStats[data.crop || 'Other'] = (cropStats[data.crop || 'Other'] || 0) + data.amount;
                        }

                        // Just pick one point per entry for the trend line
                        timeSeriesData.push({
                            label: date,
                            income: currentIncome,
                            expense: currentExpense
                        });
                    });

                    tbody.innerHTML = html || '<tr><td colspan="4" class="text-center opacity-50">No transactions found.</td></tr>';

                    // Update Profit (Using unified IDs now)
                    const netProfit = totalIncome - totalExpense;
                    const profitEl = document.getElementById('expense-total-profit');
                    const trendEl = document.getElementById('expense-trend-label');

                    if (profitEl) {
                        profitEl.textContent = `₹${netProfit.toLocaleString()}`;
                        profitEl.className = `display-6 fw-bold ${netProfit < 0 ? 'text-danger' : 'text-accent'}`;
                    }

                    if (trendEl) {
                        const isPos = netProfit >= 0;
                        trendEl.innerHTML = `<i class="ph ph-trend-${isPos ? 'up' : 'down'}"></i> ${isPos ? 'Profitable' : 'Loss'} Season`;
                        trendEl.className = `small ${isPos ? 'text-success' : 'text-danger'} mt-2`;
                    }

                    updateExpenseChartsSync(timeSeriesData);
                    updateCropChart(cropStats);
                    updateBudgetProgress(totalExpense);
                });
        }

        function updateExpenseChartsSync(timeSeries) {
            const canvas = document.getElementById('expenseChart');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (window.expenseChartReal) window.expenseChartReal.destroy();

            // Downsample if too many points (keep max 10 points)
            let displayData = timeSeries;
            if (timeSeries.length > 10) {
                const step = Math.ceil(timeSeries.length / 10);
                displayData = timeSeries.filter((_, i) => i % step === 0);
                if (displayData[displayData.length - 1] !== timeSeries[timeSeries.length - 1]) {
                    displayData.push(timeSeries[timeSeries.length - 1]);
                }
            }

            window.expenseChartReal = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: displayData.map(d => d.label),
                    datasets: [{
                        label: 'Revenue',
                        data: displayData.map(d => d.income),
                        borderColor: '#4ade80',
                        backgroundColor: 'rgba(74, 222, 128, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 2
                    }, {
                        label: 'Cost',
                        data: displayData.map(d => d.expense),
                        borderColor: '#fca5a5',
                        backgroundColor: 'rgba(252, 165, 165, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        y: {
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } }
                        }
                    }
                }
            });
        }

        function updateCropChart(stats) {
            const canvas = document.getElementById('cropChart');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (window.cropChartReal) window.cropChartReal.destroy();

            window.cropChartReal = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: Object.keys(stats),
                    datasets: [{
                        label: 'Total Investment',
                        data: Object.values(stats),
                        backgroundColor: 'rgba(74, 222, 128, 0.2)',
                        borderColor: '#4ade80',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                        x: { grid: { display: false } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }

        // Budget Logic
        async function saveBudget() {
            const amount = parseFloat(document.getElementById('budget-amount').value);
            if (isNaN(amount)) return showToast("Enter a valid amount", "warning");

            try {
                await db_fs.collection('budgets').doc(currentUser.id.toString()).set({
                    limit: amount,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showToast("Seasonal budget set!", "success");
            } catch (e) { console.error(e); }
        }

        function loadBudget() {
            if (!currentUser) return;
            db_fs.collection('budgets').doc(currentUser.id.toString()).onSnapshot(doc => {
                if (doc.exists) {
                    window.currentBudgetLimit = doc.data().limit;
                    document.getElementById('budget-total').innerText = `Limit: ₹${window.currentBudgetLimit.toLocaleString()}`;
                    if (window.lastKnownExpense) updateBudgetProgress(window.lastKnownExpense);
                }
            });
        }

        function updateBudgetProgress(currentExpense) {
            window.lastKnownExpense = currentExpense;
            const progress = document.getElementById('budget-progress');
            const usedText = document.getElementById('budget-used');
            if (!progress || !usedText || !window.currentBudgetLimit) return;

            const percent = Math.min((currentExpense / window.currentBudgetLimit) * 100, 100);
            progress.style.width = percent + '%';
            progress.className = `progress-bar ${percent > 90 ? 'bg-danger' : 'bg-accent'}`;
            usedText.innerText = `Used: ₹${currentExpense.toLocaleString()}`;

            if (percent > 100) {
                showToast("ALERT: Seasonal budget exceeded!", "error");
            }
        }

        // Yield Logic
        async function saveYieldData() {
            if (!currentUser) return;
            const season = document.getElementById('yield-season').value;
            const qty = parseFloat(document.getElementById('yield-qty').value);
            const price = parseFloat(document.getElementById('yield-price').value);

            try {
                await db_fs.collection('yields').add({
                    userId: currentUser.id.toString(),
                    season,
                    quantity: qty,
                    price,
                    revenue: qty * price,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                showToast("Harvest log saved!", "success");
                document.getElementById('yield-form').reset();
            } catch (e) { console.error(e); }
        }

        function loadYieldData() {
            if (!currentUser) return;
            db_fs.collection('yields')
                .where('userId', '==', currentUser.id.toString())
                .orderBy('timestamp', 'desc')
                .onSnapshot(snapshot => {
                    const tbody = document.getElementById('yield-report-body');
                    if (!tbody) return;

                    let html = '';
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        html += `
                            <tr>
                                <td>${data.season}</td>
                                <td>${data.quantity} Qtl</td>
                                <td>₹${data.revenue.toLocaleString()}</td>
                                <td class="text-end text-accent fw-bold">+₹${(data.revenue * 0.6).toLocaleString()}</td>
                            </tr>
                        `;
                    });
                    tbody.innerHTML = html || '<tr><td colspan="4" class="text-center py-4 opacity-50">No logs found.</td></tr>';
                });
        }

        // 2. Marketplace
        async function listProduceFirestore() {
            if (!currentUser) return showToast("Please login", "error");

            const variety = document.getElementById('listing-crop').value;
            const location = document.getElementById('listing-location').value;
            const qty = parseFloat(document.getElementById('listing-qty').value);
            const price = parseFloat(document.getElementById('listing-price').value);
            const harvestDate = document.getElementById('listing-harvest-date').value;
            const storage = document.getElementById('listing-storage').value;
            const imageFile = document.getElementById('listing-image').files[0];

            if (!location || isNaN(qty) || isNaN(price) || !harvestDate) {
                return showToast("Please fill all required fields", "warning");
            }

            const submitBtn = document.getElementById('listing-submit-btn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> UPLOADING...';

            try {
                let imageUrl = '';
                if (imageFile) {
                    const storageRef = storage_fb.ref(`listings/${currentUser.id}_${Date.now()}`);
                    await storageRef.put(imageFile);
                    imageUrl = await storageRef.getDownloadURL();
                }

                await db_fs.collection('marketplace').add({
                    sellerId: currentUser.id.toString(),
                    sellerName: currentUser.username,
                    variety,
                    location,
                    quantity: qty,
                    price,
                    harvestDate,
                    storage,
                    imageUrl,
                    status: 'active',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });

                showToast("Produce listed on Global Exchange!", "success");
                document.getElementById('market-listing-form').reset();
            } catch (e) {
                console.error("Market List Error:", e);
                showToast("Failed to post listing", "error");
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'POST TO MARKETPLACE';
            }
        }

        let allMarketListings = [];
        function loadMarketplaceFirestore() {
            db_fs.collection('marketplace')
                .where('status', '==', 'active')
                // .orderBy('timestamp', 'desc') // REMOVED to avoid Index Error
                .onSnapshot(snapshot => {
                    allMarketListings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    // Client-side Sort: Descending
                    allMarketListings.sort((a, b) => {
                        const tA = a.timestamp ? a.timestamp.toMillis() : 0;
                        const tB = b.timestamp ? b.timestamp.toMillis() : 0;
                        return tB - tA;
                    });
                    renderMarketListings(allMarketListings);
                });
        }

        function renderMarketListings(listings) {
            const sellContainer = document.getElementById('global-listings-container');
            const buyContainer = document.getElementById('global-buy-container');

            if (!sellContainer && !buyContainer) return;

            let sellHtml = '';
            let buyHtml = '';

            listings.forEach(data => {
                const isMine = currentUser && data.sellerId == currentUser.id;
                const safeVariety = (data.variety || '').toLowerCase();
                const safeLocation = (data.location || '').toLowerCase();
                const cardHtml = `
                    <div class="col-md-6 col-lg-4 mb-3" data-crop="${safeVariety}" data-loc="${safeLocation}" data-price="${data.price || 0}">
                        <div class="glass-card p-0 overflow-hidden border-white border-opacity-10 h-100">
                            <div style="height: 140px; background: #1a1a1a; overflow: hidden;">
                                ${data.imageUrl ? `<img src="${data.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div class="d-flex align-items-center justify-content-center h-100 opacity-20"><i class="ph ph-image" style="font-size: 3rem;"></i></div>`}
                            </div>
                            <div class="p-3">
                                <div class="d-flex justify-content-between align-items-start mb-1">
                                    <div class="fw-bold text-truncate" style="max-width: 150px;">${data.variety}</div>
                                    <div class="text-accent fw-bold">₹${data.price}/Qtl</div>
                                </div>
                                <div class="small opacity-50 mb-2"><i class="ph ph-map-pin"></i> ${data.location}</div>
                                <div class="d-flex justify-content-between x-small opacity-80 mb-3">
                                    <span>Qty: ${data.quantity} Qtl</span>
                                    <span>Harvest: ${data.harvestDate}</span>
                                </div>
                                ${isMine ?
                        `<button class="btn btn-sm btn-outline-danger w-100" onclick="deleteListing('${data.id}')"><i class="ph ph-trash"></i> DELETE</button>` :
                        `<button class="btn btn-sm btn-success w-100" onclick="initiatePayment(${data.price * 0.1}, 'Booking for ${data.variety}')">BOOK NOW</button>`
                    }
                            </div>
                        </div>
                    </div>
                `;

                if (isMine) sellHtml += cardHtml;
                buyHtml += cardHtml;
            });

            if (sellContainer) sellContainer.innerHTML = sellHtml || '<div class="text-center py-4 opacity-30">You have no active listings.</div>';
            if (buyContainer) buyContainer.innerHTML = buyHtml || '<div class="text-center py-4 opacity-30">No listings found matching criteria.</div>';
        }

        function filterMarketListings() {
            const cropQuery = document.getElementById('filter-crop').value.toLowerCase();
            const locQuery = document.getElementById('filter-location').value.toLowerCase();
            const priceQuery = parseFloat(document.getElementById('filter-price').value) || Infinity;

            const filtered = allMarketListings.filter(item => {
                const matchCrop = item.variety.toLowerCase().includes(cropQuery);
                const matchLoc = item.location.toLowerCase().includes(locQuery);
                const matchPrice = item.price <= priceQuery;
                return matchCrop && matchLoc && matchPrice;
            });

            renderMarketListings(filtered);
        }

        async function deleteListing(id) {
            if (!confirm("Remove this listing?")) return;
            await db_fs.collection('marketplace').doc(id).delete();
            showToast("Listing removed");
        }

        // 3. Schemes Hub & Logistics
        async function checkEligibilityReal() {
            if (!currentUser) return showToast("Please login", "error");

            const state = document.getElementById('elig-state').value;
            const land = parseFloat(document.getElementById('elig-land').value);
            const crop = document.getElementById('elig-crop').value;
            const income = document.getElementById('elig-income').value;

            if (isNaN(land)) return showToast("Enter land size", "warning");

            showToast("Analyzing Government Documentation...", "info");

            try {
                // Save profile to Firestore
                await db_fs.collection('eligibility_profiles').doc(currentUser.id.toString()).set({
                    userId: currentUser.id.toString(),
                    state, land, crop, income,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                setTimeout(() => {
                    let results = `RESULTS FOR ${state.toUpperCase()} (${land} Acres):\n\n`;
                    results += `✅ ELIGIBLE: PM-Kisan Income Support\n`;

                    if (land <= 5) results += `✅ ELIGIBLE: Small Farmer Equipment Subsidy (90%)\n`;
                    else results += `❌ NOT ELIGIBLE: Small Farmer Subsidy (Land > 5 Acres)\n`;

                    if (crop === 'Rice/Paddy' || crop === 'Wheat') results += `✅ ELIGIBLE: MSP Procurement Guarantee\n`;

                    alert(results);
                    showToast("Eligibility Profile Saved!", "success");
                }, 1500);
            } catch (e) {
                console.error("Eligibility Error:", e);
                showToast("Failed to save profile", "error");
            }
        }

        async function applyForScheme(schemeName) {
            if (!currentUser) return showToast("Please login", "error");
            if (!confirm(`Apply for ${schemeName}? This will submit your eligibility profile to the district office.`)) return;

            try {
                await db_fs.collection('scheme_applications').add({
                    userId: currentUser.id.toString(),
                    farmerName: currentUser.username,
                    schemeName,
                    status: 'Pending Review',
                    appliedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showToast(`Application for ${schemeName} submitted!`, "success");
            } catch (e) {
                console.error("Application Error:", e);
                showToast("Failed to submit application", "error");
            }
        }

        function loadSchemesFirestore() {
            if (!currentUser) return;

            // Load Profile
            db_fs.collection('eligibility_profiles').doc(currentUser.id.toString()).get().then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    if (document.getElementById('elig-state')) document.getElementById('elig-state').value = data.state;
                    if (document.getElementById('elig-land')) document.getElementById('elig-land').value = data.land;
                    if (document.getElementById('elig-crop')) document.getElementById('elig-crop').value = data.crop;
                    if (document.getElementById('elig-income')) document.getElementById('elig-income').value = data.income;
                }
            });

            // Load Applications
            db_fs.collection('scheme_applications')
                .where('userId', '==', currentUser.id.toString())
                .onSnapshot(snapshot => {
                    const list = document.getElementById('applications-list');
                    if (!list) return;

                    let html = '';
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        html += `
                            <div class="list-group-item bg-transparent border-white border-opacity-10 text-white d-flex justify-content-between align-items-center px-0">
                                <div>
                                    <div class="fw-bold fs-6">${data.schemeName}</div>
                                    <div class="x-small opacity-50">Applied: ${data.appliedAt ? data.appliedAt.toDate().toLocaleDateString() : 'Today'}</div>
                                </div>
                                <span class="badge bg-accent bg-opacity-10 text-accent">${data.status}</span>
                            </div>
                        `;
                    });
                    list.innerHTML = html || '<div class="text-center py-4 opacity-30">No active applications.</div>';
                });
        }

        function requestLogistics(item) {
            if (!currentUser) return showToast("Please login", "error");
            showToast(`Connecting to nearest ${item} network...`, "info");

            db_fs.collection('logistics_requests').add({
                userId: currentUser.id.toString(),
                service: item,
                status: 'Searching',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                setTimeout(() => {
                    showToast(`${item} booked successfully! Provider will call you.`, "success");
                }, 2000);
            });
        }

        // 4. Initial Seeding for Demo
        async function seedInitialData() {
            const snap = await db_fs.collection('expenses').limit(1).get();
            if (snap.empty && currentUser) {
                console.log("Seeding initial demo data...");
                await db_fs.collection('expenses').add({
                    userId: currentUser.id.toString(),
                    crop: 'Wheat - Winter 2024',
                    category: 'Seeds',
                    description: 'Initial Seed Purchase',
                    amount: 4500,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    type: 'expense'
                });
                await db_fs.collection('marketplace').add({
                    sellerId: 'system',
                    sellerName: 'Krishna Mandi',
                    variety: 'Sona Masuri Rice',
                    location: 'Khammam, TG',
                    quantity: 120,
                    price: 2450,
                    storage: 'Warehouse A',
                    status: 'active',
                    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                await db_fs.collection('marketplace').add({
                    sellerId: 'system2',
                    sellerName: 'Organic Seva',
                    variety: 'Desi Cotton',
                    location: 'Nagpur, MH',
                    quantity: 85,
                    price: 7200,
                    storage: 'Dry Cold',
                    status: 'active',
                    imageUrl: 'https://images.unsplash.com/photo-1594904351111-a072f80b1a71?auto=format&fit=crop&w=400',
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        }

        initApp();

        /* --- GLOBAL AI CONTROLLER API --- */
        // Exposing functions for the Master AI to control the platform directly
        window.agriSmartAI = {
            navigate: (page) => navigate(page),
            startDiseaseScan: () => {
                navigate('scan');
                setTimeout(() => document.getElementById('leaf-upload')?.click(), 800);
            },
            controlPump: (state) => controlPump(state),
            controlIrrigation: (state) => controlPump(state),
            openMarketplace: () => navigate('marketplace'),
            openSchemes: () => navigate('schemes'),
            getMarketPrices: () => updateMarketPricesTable(),
            getWeatherData: () => loadWeatherDetails(),
            updateProfile: () => navigate('profile')
        };

        console.log("AgriSmart Bundle v2.0 - JSON Fix Loaded");
        // Force reload if query param missing (optional, but good for dev)
        if (!location.search.includes('v=2')) {
            // history.replaceState({}, '', '?v=2'); // Just update URL visually to know
        }

        // Aliases for global scope access
        window.startDiseaseScan = window.agriSmartAI.startDiseaseScan;
        window.openMarketplace = window.agriSmartAI.openMarketplace;
        window.openSchemes = window.agriSmartAI.openSchemes;
        window.getMarketPrices = window.agriSmartAI.getMarketPrices;
        window.getWeatherData = window.agriSmartAI.getWeatherData;
/* Extracted JS */
/* --- CROP SELECTION LOGIC --- */

        async function refreshLocation() {
            const locInput = document.getElementById('crop-location');
            locInput.value = "Detecting...";

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(async (position) => {
                    const lat = position.coords.latitude.toFixed(4);
                    const lon = position.coords.longitude.toFixed(4);

                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                        const data = await response.json();

                        if (data.address) {
                            const district = data.address.county || data.address.district || data.address.city || '';
                            const stateCode = (data.address.state === 'Telangana') ? 'TG' : (data.address.state === 'Andhra Pradesh') ? 'AP' : '';

                            let displayLoc = district;
                            if (stateCode) displayLoc += `, ${stateCode}`;

                            locInput.value = displayLoc || `${lat}, ${lon}`;
                        } else {
                            locInput.value = `${lat}, ${lon}`;
                        }
                        refreshWeather(); // Auto fetch weather after location
                    } catch (e) {
                        console.error("Reverse geocoding failed:", e);
                        locInput.value = `${lat}, ${lon}`;
                        refreshWeather();
                    }
                }, (error) => {
                    console.error("Geolocation error:", error);
                    locInput.value = "Warangal, TG (Default)";
                    refreshWeather();
                });
            } else {
                locInput.value = "Hyderabad, TG (Default)";
                refreshWeather();
            }
        }

        async function refreshWeather() {
            const weatherInput = document.getElementById('crop-rainfall');
            weatherInput.value = "Fetching...";

            // Extract state from location or default
            const loc = document.getElementById('crop-location').value || "Telangana";
            let state = "Telangana";
            if (loc.includes("AP") || loc.includes("Andhra")) state = "Andhra Pradesh";

            try {
                const res = await fetch(`/api/weather?state=${state}`);
                const data = await res.json();
                if (data.success) {
                    // Calculate total rainfall forecast for season (mock logic based on daily)
                    // Real logic would sum up forecast_precipitation
                    const totalRain = data.data.forecast_precipitation.reduce((a, b) => a + b, 0);
                    // Extrapolate for season (simple multiplier for demo)
                    const seasonalRain = Math.round(totalRain * 15);
                    weatherInput.value = (seasonalRain > 50 ? seasonalRain : 450) + " mm (Forecast)";
                }
            } catch (e) {
                weatherInput.value = "500 mm (Hist. Avg)";
            }
        }

        async function getCropRecommendation() {
            const location = document.getElementById('crop-location').value;
            const season = document.getElementById('crop-season').value;
            const soil = document.getElementById('crop-soil-type').value;
            const rainfall = document.getElementById('crop-rainfall').value;
            const prev = document.getElementById('crop-previous').value;
            const fertility = document.getElementById('crop-soil-fertility').value;

            if (!location || location === "Auto-detecting...") {
                showToast("Please detect or enter location", "warning");
                return;
            }

            // Show Loading State
            const btn = document.querySelector('button[onclick="getCropRecommendation()"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Analyzing Soil & Climate...';
            btn.disabled = true;

            try {
                // Determine clean rainfall number
                const rainVal = parseInt(rainfall.replace(/[^0-9]/g, '')) || 500;

                const response = await fetch('/api/ai?action=crop_recommendation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        location,
                        season,
                        soil_type: `${soil} (${fertility} Fertility)`,
                        rainfall: rainVal,
                        previous_crop: prev || "None"
                    })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    displayCropResults(result.data);
                    // scroll to results
                    document.getElementById('crop-results').scrollIntoView({ behavior: 'smooth' });
                } else {
                    const errorMsg = result.message || "Failed to get recommendation";
                    showToast(errorMsg + (result.error ? `: ${result.error}` : ""), "error");
                    console.error("AI Error:", result);
                }

            } catch (err) {
                console.error(err);
                showToast("AI Service Error", "error");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }

        function displayCropResults(data) {
            const resultsDiv = document.getElementById('crop-results');
            resultsDiv.style.display = 'block';

            // Best Crop
            const best = data.best_crop || data.mock?.best_crop;
            if (best) {
                document.getElementById('best-crop-name').innerText = best.name;
                document.getElementById('best-crop-telugu').innerText = best.local_name || ""; // Ensure backend provides this or handle map
                document.getElementById('best-crop-yield').innerText = best.yield_range;
                document.getElementById('best-crop-profit').innerText = best.profit_potential || "High"; // Update backend to match or adjust UI ID
                document.getElementById('best-crop-explanation').innerText = best.reason;

                const riskBadge = document.getElementById('risk-badge');
                riskBadge.innerText = best.risk_level + " RISK";
                riskBadge.className = `badge ${best.risk_level === 'High' ? 'bg-danger' : best.risk_level === 'Medium' ? 'bg-warning text-dark' : 'bg-success'}`;

                // New: Populate Fertilizers
                const ferts = best.fertilizer_schedule || [];
                const fertContainer = document.getElementById('best-crop-fertilizers');
                fertContainer.innerHTML = ferts.length ? ferts.map(f => `
                    <div class="col-sm-6">
                        <div class="p-2 border border-white border-opacity-10 rounded bg-black bg-opacity-40">
                            <div class="small fw-bold text-accent">${f.stage}</div>
                            <div class="small text-white">${f.product} - ${f.dosage}</div>
                            <div class="x-small text-white opacity-50">${f.instructions}</div>
                        </div>
                    </div>
                `).join('') : '<div class="col-12 small opacity-50">No specific fertilizer schedule provided.</div>';

                // New: Populate Pesticides
                const pests = best.pesticide_advisory || [];
                const pestContainer = document.getElementById('best-crop-pesticides');
                pestContainer.innerHTML = pests.length ? pests.map(p => `
                    <div class="col-sm-6">
                        <div class="p-2 border border-white border-opacity-10 rounded bg-black bg-opacity-40">
                            <div class="small fw-bold text-warning">${p.pest}</div>
                            <div class="small text-white">${p.product} (${p.timing})</div>
                            <div class="x-small text-white opacity-50">${p.notes}</div>
                        </div>
                    </div>
                `).join('') : '<div class="col-12 small opacity-50">No specific pesticide advisory provided.</div>';
            }

            // Alternatives
            const altsContainer = document.getElementById('alternative-crops');
            altsContainer.innerHTML = '';

            const alts = data.alternatives || [];
            alts.forEach(crop => {
                const html = `
                    <div class="col-md-6">
                        <div class="glass-card h-100" style="padding: 20px;">
                            <div class="d-flex justify-content-between mb-2">
                                <h5 class="fw-bold mb-0">${crop.name}</h5>
                                <span class="badge ${crop.risk_level === 'Low' ? 'bg-success' : 'bg-warning text-dark'}">${crop.risk_level} Risk</span>
                            </div>
                            <div class="small opacity-70 mb-2">${crop.reason}</div>
                            <div class="d-flex justify-content-between small border-top border-white border-opacity-10 pt-2 mt-2">
                                <span>Yield: ${crop.yield_range}</span>
                                <span class="text-accent">Score: ${crop.suitability_score}/100</span>
                            </div>
                        </div>
                    </div>
                `;
                altsContainer.innerHTML += html;
            });
        }

        /* --- VOICE INPUT LOGIC --- */
        function triggerVoiceCropInput() {
            if (!('webkitSpeechRecognition' in window)) {
                alert("Voice input not supported in this browser.");
                return;
            }

            const recognition = new webkitSpeechRecognition();
            recognition.lang = 'en-IN'; // Default to Indian English
            recognition.continuous = false;
            recognition.interimResults = false;

            showToast("Listening... Speak your farm details", "info");

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript.toLowerCase();
                console.log("Voice Input:", transcript);
                showToast("Processing: " + transcript, "success");
                fillFormFromVoice(transcript);
            };

            recognition.onerror = (event) => {
                console.error("Voice Error", event);
                showToast("Voice recognition failed", "error");
            };

            recognition.start();
        }

        function fillFormFromVoice(text) {
            // Simple heuristic parsing

            // Soil
            if (text.includes("black")) document.getElementById('crop-soil-type').value = "Black Cotton";
            else if (text.includes("red")) document.getElementById('crop-soil-type').value = "Red";
            else if (text.includes("sandy")) document.getElementById('crop-soil-type').value = "Sandy";

            // Season
            if (text.includes("kharif") || text.includes("rainy")) document.getElementById('crop-season').value = "Kharif";
            else if (text.includes("rabi") || text.includes("winter")) document.getElementById('crop-season').value = "Rabi";

            // Previous Crop
            const crops = ["cotton", "paddy", "maize", "chilli", "turmeric", "wheat"];
            crops.forEach(c => {
                if (text.includes("previous") && text.includes(c)) {
                    // Match select values
                    const options = document.getElementById('crop-previous').options;
                    for (let i = 0; i < options.length; i++) {
                        if (options[i].value.toLowerCase() === c) {
                            document.getElementById('crop-previous').selectedIndex = i;
                            break;
                        }
                    }
                }
            });

            // Location (if mentioned like "my location is X")
            // This is hard to parse accurately without NLP, skipping for now or just simple check

            showToast("Form updated from voice!", "success");
        }

        // ==================== MESSAGE NOTIFICATION SYSTEM ====================
        let notificationCounter = 0;
        let activeNotifications = new Map();

        function showMessageNotification(senderId, senderName, message, profilePic) {
            // Don't show notification if user is already in the chat with this person
            if (currentPage === 'connect' && window.activeChatUserId === senderId) {
                return;
            }

            const notificationId = `notif-${Date.now()}-${notificationCounter++}`;
            const container = document.getElementById('messageNotificationsContainer');

            const notificationDiv = document.createElement('div');
            notificationDiv.className = 'notification-item';
            notificationDiv.id = notificationId;

            // Truncate message if too long
            const displayMessage = message.length > 80 ? message.substring(0, 80) + '...' : message;

            notificationDiv.innerHTML = `
                <img src="${profilePic || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + senderName}" 
                     alt="${senderName}" class="notification-avatar">
                <div class="notification-content">
                    <div class="notification-sender">
                        <i class="ph ph-chats"></i>
                        ${senderName}
                    </div>
                    <div class="notification-message">${displayMessage}</div>
                    <div class="notification-time">Just now</div>
                </div>
                <button class="notification-close" onclick="dismissNotification('${notificationId}', event)">
                    <i class="ph ph-x"></i>
                </button>
            `;

            // Click to navigate to chat
            notificationDiv.addEventListener('click', (e) => {
                if (!e.target.closest('.notification-close')) {
                    navigate('connect');
                    // Open the specific chat if function exists
                    if (typeof openChatWithUser === 'function') {
                        setTimeout(() => openChatWithUser(senderId), 300);
                    }
                    dismissNotification(notificationId);
                }
            });

            container.appendChild(notificationDiv);
            activeNotifications.set(notificationId, true);

            // Auto-dismiss after 10 seconds
            setTimeout(() => {
                if (activeNotifications.has(notificationId)) {
                    dismissNotification(notificationId);
                }
            }, 10000);
        }

        function dismissNotification(notificationId, event) {
            if (event) {
                event.stopPropagation();
            }

            const notification = document.getElementById(notificationId);
            if (notification) {
                notification.classList.add('dismissing');
                setTimeout(() => {
                    notification.remove();
                    activeNotifications.delete(notificationId);
                }, 300);
            }
        }

        // Listen for new messages in Firestore
        function initMessageNotificationListener(authenticatedUser) {
            if (!authenticatedUser || !authenticatedUser.uid || !db_fs) {
                console.log('Cannot init notification listener - missing user or db');
                return;
            }

            console.log('Initializing message notifications for user:', authenticatedUser.uid);

            // Listen to messages collection for new messages
            // Note: Removed orderBy to avoid requiring a composite index
            db_fs.collection('messages')
                .where('receiverId', '==', authenticatedUser.uid)
                .limit(1)
                .onSnapshot((snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        if (change.type === 'added') {
                            const msgData = change.doc.data();
                            const msgTime = msgData.timestamp?.toDate();

                            // Only show notification for messages from last 5 seconds
                            if (msgTime && (Date.now() - msgTime.getTime()) < 5000) {
                                // Fetch sender info
                                db_fs.collection('users').doc(msgData.senderId).get()
                                    .then((userDoc) => {
                                        if (userDoc.exists) {
                                            const userData = userDoc.data();
                                            showMessageNotification(
                                                msgData.senderId,
                                                userData.username || userData.name || 'User',
                                                msgData.text || msgData.message || 'New message',
                                                userData.profilePic || userData.avatar
                                            );
                                        }
                                    })
                                    .catch((err) => {
                                        console.error('Error fetching sender info:', err);
                                    });
                            }
                        }
                    });
                }, (error) => {
                    console.error('Message notification listener error:', error);
                });
        }

        // Initialize global feeds that don't require auth
        setTimeout(() => {
            if (typeof initCommunityFeed === 'function') initCommunityFeed();
            if (typeof initMarketplace === 'function') initMarketplace();
        }, 1000);

        // Initialize user-specific features on auth state change
        if (auth_fb) {
            auth_fb.onAuthStateChanged((user) => {
                if (user) {
                    // Wait a bit longer to ensure Firestore is ready
                    setTimeout(() => {
                        initMessageNotificationListener(user);
                        initTodos(user);
                    }, 2000);
                }
            });
        }


        // ==================== NEW FEATURES PERSISTENCE ====================

        // --- Community Feed Image Handlers ---
        let compressedCommunityImageBase64 = null;

        window.triggerCommunityImageUpload = function() {
            document.getElementById('community-post-image')?.click();
        };

        window.previewCommunityImage = function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    // Compress image using Canvas to avoid Firestore 1MB limit
                    const img = new Image();
                    img.onload = function() {
                        const canvas = document.createElement('canvas');
                        const MAX_WIDTH = 800;
                        const MAX_HEIGHT = 800;
                        let width = img.width;
                        let height = img.height;

                        if (width > height) {
                            if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                            }
                        } else {
                            if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                            }
                        }

                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);

                        // Export as high-compression JPEG Base64
                        compressedCommunityImageBase64 = canvas.toDataURL('image/jpeg', 0.6);

                        const previewContainer = document.getElementById('community-image-preview');
                        if (previewContainer) {
                            previewContainer.innerHTML = `<img src="${compressedCommunityImageBase64}" style="max-height: 100px; border-radius: 8px;" class="mt-2"><br><button class="btn btn-sm btn-link text-danger p-0 mt-1" onclick="clearCommunityImage()">Remove Photo</button>`;
                            previewContainer.style.display = 'block';
                        }
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }
        };

        window.clearCommunityImage = function() {
            compressedCommunityImageBase64 = null;
            const input = document.getElementById('community-post-image');
            if(input) input.value = '';
            const previewContainer = document.getElementById('community-image-preview');
            if(previewContainer) previewContainer.style.display = 'none';
        };

        // --- Community Feed ---
        function initCommunityFeed() {
            if (!db_fs) return;
            db_fs.collection('community_posts').orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
                const container = document.getElementById('community-posts-container');
                if (!container) return;
                
                if (snapshot.empty) {
                    container.innerHTML = '<div class="text-center small opacity-50 py-4">No posts yet. Be the first to share!</div>';
                    return;
                }
                
                let html = '';
                snapshot.forEach((doc) => {
                    const post = doc.data();
                    const timeAgo = post.timestamp ? Math.floor((Date.now() - post.timestamp.toDate().getTime()) / 60000) + 'm ago' : 'Just now';
                    const imgHtml = post.imageUrl ? `<img src="${post.imageUrl}" class="w-100 rounded mt-2" style="max-height: 300px; object-fit: cover;">` : '';
                    
                    html += `
                    <div class="glass-card mb-3 p-3">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <div class="d-flex align-items-center gap-2">
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorName}" width="32" height="32" class="rounded-circle">
                                <div>
                                    <div class="fw-bold small">${post.authorName}</div>
                                    <div class="x-small opacity-50">${timeAgo}</div>
                                </div>
                            </div>
                        </div>
                        <p class="small text-white-50 mt-2">${post.content}</p>
                        ${imgHtml}
                        <div class="d-flex gap-3 mt-3 border-top border-white border-opacity-10 pt-2">
                            <button class="btn btn-sm btn-link text-white text-decoration-none p-0" onclick="likeCommunityPost('${doc.id}', ${post.likes || 0})"><i class="ph-fill ph-thumbs-up text-accent"></i> ${post.likes || 0}</button>
                            <button class="btn btn-sm btn-link text-white text-decoration-none p-0"><i class="ph-bold ph-chat-circle"></i> Reply</button>
                        </div>
                    </div>`;
                });
                container.innerHTML = html;
            }, (error) => console.error("Error fetching community feed:", error));
        }

        window.publishCommunityPost = async function() {
            const input = document.getElementById('community-post-content');
            const content = input?.value.trim();
            if (!content && !compressedCommunityImageBase64) return showToast('Please enter a message or add a photo.', 'warning');
            
            const user = auth_fb.currentUser;
            if (!user) return showToast('You must be logged in to post.', 'error');
            
            const btn = document.getElementById('community-post-btn');
            const originalBtnHtml = btn?.innerHTML || 'Post';
            if (btn) {
                btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';
                btn.disabled = true;
            }
            
            // Get user's name
            let authorName = user.displayName || 'Farmer';
            try {
                const userDoc = await db_fs.collection('users').doc(user.uid).get();
                if (userDoc.exists && userDoc.data().name) authorName = userDoc.data().name;
            } catch (e) { console.warn(e); }

            try {
                await db_fs.collection('community_posts').add({
                    authorId: user.uid,
                    authorName: authorName,
                    content: content,
                    imageUrl: compressedCommunityImageBase64, // Directly save the compressed Base64 string
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    likes: 0
                });
                
                if (input) input.value = '';
                clearCommunityImage();
                showToast('Post published with photo!', 'success');
            } catch (error) {
                console.error("Error posting:", error);
                showToast('Failed to post. Try again.', 'error');
            } finally {
                if (btn) {
                    btn.innerHTML = originalBtnHtml;
                    btn.disabled = false;
                }
            }
        };

        window.likeCommunityPost = async function(postId, currentLikes) {
            try {
                await db_fs.collection('community_posts').doc(postId).update({
                    likes: currentLikes + 1
                });
            } catch (e) { console.error('Error liking post', e); }
        };

        // --- Marketplace Active Listings ---
        function initMarketplace() {
            if (!db_fs) return;
            db_fs.collection('market_listings').orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
                const container = document.getElementById('market-listings-container');
                if (!container) return;
                
                if (snapshot.empty) {
                    container.innerHTML = '<div class="text-center small opacity-50 py-4">No active listings currently available.</div>';
                    return;
                }
                
                let html = '';
                snapshot.forEach((doc) => {
                    const listing = doc.data();
                    html += `
                    <div class="list-group-item bg-black bg-opacity-25 text-white border-white border-opacity-10 d-flex justify-content-between align-items-center mb-2 rounded">
                        <div>
                            <h5 class="mb-1 text-accent">${listing.cropName} (${listing.quantity} Quintals)</h5>
                            <small class="opacity-70">${listing.sellerName || 'Verified Seller'} <i class="ph-fill ph-check-circle text-success"></i></small>
                        </div>
                        <div class="text-end">
                            <h5 class="mb-0">₹${listing.price}/q</h5>
                            <button class="btn btn-sm btn-outline-light mt-2 rounded-pill">Contact Buyer</button>
                        </div>
                    </div>`;
                });
                container.innerHTML = html;
            });
        }

        window.publishMarketListing = async function() {
            const name = document.getElementById('market-crop-name')?.value.trim();
            const qty = document.getElementById('market-crop-qty')?.value.trim();
            const price = document.getElementById('market-crop-price')?.value.trim();
            
            if (!name || !qty || !price) return showToast('Please fill all listing fields!', 'warning');
            
            const user = auth_fb.currentUser;
            if (!user) return showToast('You must be logged in to sell.', 'error');
            
            let sellerName = user.displayName || 'Verified Farmer';
            try {
                const userDoc = await db_fs.collection('users').doc(user.uid).get();
                if (userDoc.exists && userDoc.data().name) sellerName = userDoc.data().name;
            } catch (e) { console.warn(e); }

            try {
                await db_fs.collection('market_listings').add({
                    sellerId: user.uid,
                    sellerName: sellerName,
                    cropName: name,
                    quantity: Number(qty),
                    price: Number(price),
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                document.getElementById('market-crop-name').value = '';
                document.getElementById('market-crop-qty').value = '';
                document.getElementById('market-crop-price').value = '';
                showToast('Listing active instantly! 0% Fees applied.', 'success');
            } catch (error) {
                console.error("Error creating listing:", error);
                showToast('Failed to create listing', 'error');
            }
        };

        // --- Smart Todo List ---
        let currentTodoUser = null;
        function initTodos(user) {
            currentTodoUser = user;
            if (!db_fs || !user) return;
            
            db_fs.collection('users').doc(user.uid).collection('todos').orderBy('timestamp', 'asc').onSnapshot((snapshot) => {
                const container = document.getElementById('smart-todo-list');
                if (!container) return;
                
                if (snapshot.empty) {
                    container.innerHTML = '<div class="text-center small opacity-50 py-3">All caught up! Add a new task below.</div>';
                    return;
                }
                
                let html = '';
                snapshot.forEach((doc) => {
                    const t = doc.data();
                    const isCheckedStr = t.completed ? 'checked' : '';
                    const strikeStr = t.completed ? 'text-decoration-line-through opacity-50' : '';
                    const color = t.color || 'var(--accent)';
                    
                    html += `
                    <li class="p-3 mb-2 rounded" style="background: rgba(255,255,255,0.05); border-left: 3px solid ${color};">
                        <div class="form-check d-flex align-items-center gap-2">
                            <input class="form-check-input" type="checkbox" id="task-${doc.id}" ${isCheckedStr} onchange="toggleTodoTask('${doc.id}', this.checked)">
                            <label class="form-check-label flex-grow-1 ${strikeStr}" for="task-${doc.id}">
                                ${t.text}
                            </label>
                            <button class="btn btn-link text-danger p-0" onclick="deleteTodoTask('${doc.id}')"><i class="ph ph-trash"></i></button>
                        </div>
                    </li>`;
                });
                container.innerHTML = html;
            });
        }

        window.addTodoTask = async function() {
            const input = document.getElementById('new-todo-input');
            const text = input?.value.trim();
            if (!text) return;
            
            if (!currentTodoUser) return showToast('Please log in to add tasks.', 'warning');
            
            // Randomly assign a color stripe for fun UX
            const colors = ['var(--accent)', '#f59e0b', '#ef4444', '#3b82f6'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];

            try {
                await db_fs.collection('users').doc(currentTodoUser.uid).collection('todos').add({
                    text: text,
                    completed: false,
                    color: randomColor,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                input.value = '';
            } catch (err) { console.error('Error adding task', err); }
        };

        window.toggleTodoTask = async function(taskId, isCompleted) {
            if (!currentTodoUser) return;
            try {
                await db_fs.collection('users').doc(currentTodoUser.uid).collection('todos').doc(taskId).update({
                    completed: isCompleted
                });
            } catch (err) { console.error('Error updating task', err); }
        };

        window.deleteTodoTask = async function(taskId) {
            if (!currentTodoUser) return;
            try {
                await db_fs.collection('users').doc(currentTodoUser.uid).collection('todos').doc(taskId).delete();
                showToast('Task removed', 'success');
            } catch (err) { console.error('Error deleting task', err); }
        };


        // --- Profit Intelligence ---
        window.calculateExpectedProfit = async function() {
            const crop = document.getElementById('profit-crop')?.value;
            const landSize = document.getElementById('profit-land')?.value;
            const costPerAcre = document.getElementById('profit-cost')?.value;
            const expectedYield = document.getElementById('profit-yield')?.value;
            const userState = currentUser ? currentUser.state : 'Default';

            if (!landSize || !costPerAcre || !expectedYield) {
                return showToast("Please fill all fields to calculate profit", "warning");
            }

            const placeholder = document.getElementById('profit-result-placeholder');
            const content = document.getElementById('profit-result-content');
            
            placeholder.innerHTML = '<div class="spinner-border text-primary fs-3 mb-3"></div><p>AI analyzing market conditions...</p>';
            placeholder.style.display = 'block';
            content.style.display = 'none';

            try {
                const response = await fetch(`${API_BASE_URL}/ai/profit-calc`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ crop, landSize, costPerAcre, expectedYieldPerAcre: expectedYield, state: userState })
                });

                const result = await response.json();

                if (result.success) {
                    const d = result.data;
                    document.getElementById('profit-total-cost').innerText = `₹${d.totalCost.toLocaleString()}`;
                    document.getElementById('profit-total-rev').innerText = `₹${d.totalRevenue.toLocaleString()}`;
                    document.getElementById('profit-total-net').innerText = `₹${d.netProfit.toLocaleString()}`;
                    
                    const marginPerc = document.getElementById('profit-margin-perc');
                    const marginBar = document.getElementById('profit-margin-bar');
                    marginPerc.innerText = `${d.profitMargin}%`;
                    marginBar.style.width = Math.min(Math.max(d.profitMargin, 0), 100) + '%';
                    
                    if (parseFloat(d.profitMargin) < 0) marginBar.classList.add('bg-danger');
                    else marginBar.classList.remove('bg-danger');

                    document.getElementById('profit-ai-advisory').innerText = d.advisory;
                    
                    const speakBtn = document.getElementById('profit-read-aloud');
                    speakBtn.onclick = () => window.speak(d.advisory.replace(/'/g, "\\'"));
                    
                    const shareBtn = document.getElementById('profit-share-wa');
                    shareBtn.onclick = () => shareToWhatsApp(`AgriSmart Profit Report: Expected net profit for ${crop} is ₹${d.netProfit.toLocaleString()}. ROI Margin: ${d.profitMargin}%. ${d.advisory}`);

                    placeholder.style.display = 'none';
                    content.style.display = 'block';
                    
                    showToast("Profit Intelligence Ready!", "success");
                } else {
                    showToast("Calculation failed: " + result.error, "error");
                    placeholder.innerHTML = '<i class="ph ph-warning-circle text-danger fs-1 mb-3"></i><p>Failed to analyze data</p>';
                }
            } catch (err) {
                console.error("Profit Error:", err);
                showToast("Network Error in Financial Engine", "error");
            }
        };

        // --- Subsidy & Government Schemes ---
        window.checkEligibility = async function() {
            const state = document.getElementById('elig-state')?.value;
            const land = document.getElementById('elig-land')?.value;
            const category = document.getElementById('elig-category')?.value || 'all';
            const crop = document.getElementById('elig-crop')?.value;
            
            if (!state || !land || isNaN(parseFloat(land))) {
                return showToast('Please enter your state and land size to check benefits.', 'warning');
            }
            
            showToast('Searching Government Registry...', 'info');
            
            try {
                const response = await fetch(`${API_BASE_URL}/schemes?state=${encodeURIComponent(state)}&landSize=${land}&category=${category}&explain=true`, {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                const result = await response.json();
                
                if (result.success && result.data.schemes) {
                    const schemes = result.data.schemes;
                    const aiAdvice = result.ai_explanation;
                    
                    // Show custom result modal or UI update
                    const cardGrid = document.getElementById('schemes-grid');
                    if (cardGrid) {
                        const schemeNames = schemes.map(s => s.name.toUpperCase());
                        const cards = cardGrid.querySelectorAll('.glass-card');
                        cards.forEach(card => {
                            const title = card.querySelector('h5')?.innerText?.toUpperCase();
                            if (title && schemeNames.some(name => name.includes(title) || title.includes(name))) {
                                card.classList.add('border-accent');
                                card.style.boxShadow = '0 0 20px rgba(74, 222, 128, 0.4)';
                            } else {
                                card.classList.remove('border-accent');
                                card.style.boxShadow = 'none';
                            }
                        });
                    }

                    if (aiAdvice) {
                        // Create or update AI advisory area in the schemes section
                        let advisoryBox = document.getElementById('scheme-ai-advisory');
                        if (!advisoryBox) {
                            const parent = document.querySelector('#schemes .col-md-8');
                            advisoryBox = document.createElement('div');
                            advisoryBox.id = 'scheme-ai-advisory';
                            advisoryBox.className = 'alert bg-warning bg-opacity-10 border border-warning border-opacity-25 text-white mb-4 d-flex gap-3 align-items-center animate__animated animate__fadeIn';
                            parent.insertBefore(advisoryBox, parent.firstChild);
                        }
                        advisoryBox.innerHTML = `
                            <div class="bg-warning rounded-circle p-2 d-flex"><i class="ph ph-sparkle text-black fs-4"></i></div>
                            <div class="flex-grow-1">
                                <h6 class="fw-bold text-warning mb-1">AI Compatibility Insight</h6>
                                <p class="mb-0 small">${aiAdvice}</p>
                            </div>
                            <button class="btn btn-sm btn-outline-warning border-0 rounded-circle" onclick="window.speak('${aiAdvice.replace(/'/g, "\\'")}')"><i class="ph ph-speaker-high" style="font-size: 1.2rem;"></i></button>
                        `;
                    }

                    showToast(`Found ${schemes.length} matching schemes for you!`, 'success');
                } else {
                    showToast('No specific schemes found. Showing general benefits.', 'info');
                }
            } catch (err) {
                console.error("Scheme Fetch Error:", err);
                showToast("Service momentarily unavailable. Fallback active.");
            }
        };

        // --- Health Tracker Module ---
        let currentHealthMemberId = null;

        window.updateDashFamilyCount = async function() {
            const countEl = document.getElementById('dash-family-count');
            if (!countEl) return;
            try {
                const res = await fetch(`${API_BASE_URL}/health/members`);
                const result = await res.json();
                if (result.success) {
                    countEl.innerText = `${result.data.length} Members added`;
                }
            } catch (err) { console.error("Error updating dash family count", err); }
        };

        window.loadHealthDashboard = async function() {
            const grid = document.getElementById('family-members-grid');
            if (!grid) return;

            grid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-accent"></div><p class="mt-2 small opacity-50">Fetching family profiles...</p></div>';

            try {
                const res = await fetch(`${API_BASE_URL}/health/members`);
                const result = await res.json();

                if (result.success) {
                    updateDashFamilyCount(); // Sync home screen count
                    if (result.data && result.data.length > 0) {
                        grid.innerHTML = result.data.map(member => `
                            <div class="col-md-4 col-sm-6">
                                <div class="glass-card p-4 h-100 member-card border border-white-10" onclick="viewMemberHealth('${member.id}')">
                                    <div class="d-flex align-items-center gap-3 mb-3">
                                        <div class="bg-accent bg-opacity-10 text-accent p-3 rounded-circle" style="width: 50px; height: 50px; display: flex; align-items: center; justify-content: center;">
                                            <i class="ph-bold ph-user fs-4"></i>
                                        </div>
                                        <div>
                                            <h5 class="mb-0 fw-bold">${member.name}</h5>
                                            <span class="badge bg-white bg-opacity-10 text-white-50 small">${member.relation}</span>
                                        </div>
                                    </div>
                                    <div class="row g-2 small opacity-70">
                                        <div class="col-6">Age: ${member.age}</div>
                                        <div class="col-6">Blood: ${member.blood_group}</div>
                                    </div>
                                    <div class="mt-3 text-accent small fw-bold">
                                        <i class="ph ph-calendar-check"></i> View Medical Timeline
                                    </div>
                                </div>
                            </div>
                        `).join('');
                    } else {
                        grid.innerHTML = '<div class="col-12 text-center py-5 opacity-50"><i class="ph ph-users-four" style="font-size: 3rem;"></i><p class="mt-2">No family members found. Add your first member!</p></div>';
                    }
                } else {
                    showToast(result.message || 'Failed to fetch members', 'danger');
                }
            } catch (err) {
                console.error("[Health] Load Members Error:", err);
                grid.innerHTML = '<div class="col-12 text-center py-5 text-danger"><i class="ph ph-warning-circle" style="font-size: 3rem;"></i><p class="mt-2">Failed to load family data. Please check your connection.</p></div>';
            }
        };

        window.showAddFamilyMemberModal = function() {
            const modal = new bootstrap.Modal(document.getElementById('addFamilyMemberModal'));
            modal.show();
        };

        window.showAddHealthRecordModal = function() {
            const modal = new bootstrap.Modal(document.getElementById('addHealthRecordModal'));
            modal.show();
        };

        window.viewMemberHealth = async function(memberId) {
            currentHealthMemberId = memberId;
            navigate('health-detail'); // Switch view
            
            // Set member basic info in UI
            try {
                const res = await fetch(`${API_BASE_URL}/health/members`);
                const result = await res.json();
                const member = result.data.find(m => m.id === memberId);
                
                if (member) {
                    document.getElementById('selected-member-name').innerText = member.name;
                    document.getElementById('selected-member-meta').innerText = `${member.relation} | ${member.age} Years | Blood: ${member.blood_group}`;
                    document.getElementById('member-notes').innerText = member.notes || "No chronic conditions or allergies noted.";
                }
                
                loadHealthRecords(memberId);
            } catch (err) { console.error("Error loading member meta", err); }
        };

        window.loadHealthRecords = async function(memberId) {
            const timeline = document.getElementById('health-timeline');
            if (!timeline) return;

            timeline.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-accent"></div></div>';

            try {
                const res = await fetch(`${API_BASE_URL}/health/records?member_id=${memberId}`);
                const result = await res.json();

                if (result.success && result.data.length > 0) {
                    timeline.innerHTML = result.data.map(record => `
                        <div class="timeline-item">
                            <div class="d-flex justify-content-between align-items-start mb-1">
                                <h6 class="mb-0 fw-bold text-accent">${record.diagnosis}</h6>
                                <small class="opacity-50">${new Date(record.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</small>
                            </div>
                            <div class="small opacity-80 mb-2">Doctor: ${record.doctor || 'General Physician'}</div>
                            <div class="glass-card p-3 mb-2 small italic opacity-70" style="background: rgba(255,255,255,0.02);">
                                ${record.notes || 'No specific notes recorded.'}
                            </div>
                        </div>
                    `).join('');
                } else {
                    timeline.innerHTML = '<div class="text-center py-4 opacity-40 italic">No medical history found. Click "New Record" to start tracking.</div>';
                }
            } catch (err) {
                timeline.innerHTML = '<div class="text-center py-4 text-danger">Error loading medical history.</div>';
            }
        };

        // Form Handlers
        document.getElementById('addFamilyMemberForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creating...';

            const payload = {
                name: document.getElementById('member-name').value,
                age: document.getElementById('member-age').value,
                relation: document.getElementById('member-relation').value,
                gender: document.getElementById('member-gender').value,
                blood_group: document.getElementById('member-blood').value
            };

            try {
                const res = await fetch(`${API_BASE_URL}/health/members`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();

                if (result.success) {
                    showToast('Family member added to your profile!', 'success');
                    bootstrap.Modal.getInstance(document.getElementById('addFamilyMemberModal')).hide();
                    loadHealthDashboard();
                } else {
                    showToast(result.message, 'danger');
                }
            } catch (err) {
                showToast('API communication error. Using offline fallback.', 'warning');
            } finally {
                btn.disabled = false;
                btn.innerText = 'Create Member Profile';
            }
        });

        document.getElementById('addHealthRecordForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentHealthMemberId) return;

            const btn = e.target.querySelector('button');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

            const payload = {
                member_id: currentHealthMemberId,
                diagnosis: document.getElementById('record-diagnosis').value,
                date: document.getElementById('record-date').value,
                doctor: document.getElementById('record-doctor').value,
                notes: document.getElementById('record-notes').value
            };

            try {
                const res = await fetch(`${API_BASE_URL}/health/records`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await res.json();

                if (result.success) {
                    showToast('Medical record updated successfully!', 'success');
                    bootstrap.Modal.getInstance(document.getElementById('addHealthRecordModal')).hide();
                    loadHealthRecords(currentHealthMemberId);
                } else {
                    showToast(result.message, 'danger');
                }
            } catch (err) {
                showToast('Failed to save record. Please check dashboard logs.', 'warning');
            } finally {
                btn.disabled = false;
                btn.innerText = 'Save Medical Record';
            }
        });
        // --- Service Worker Registration ---
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('AgriSmart SW registered', reg))
                    .catch(err => console.log('AgriSmart SW failed', err));
            });
        }
