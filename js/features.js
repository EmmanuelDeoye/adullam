/* ============================================
   ADULLAM — js/features.js
   Load AFTER config.js and core.js.
   Contains: Shepherd AI chat, conversation history,
   the Bible reading planner, and Reels.
   ============================================ */

/* ============================================
   SHEPHERD (ASK AI) PAGE
   ============================================ */
const pendingAIActions = {};

function renderAskPage() {
    DOM.pageContainer.innerHTML = `
        <div class="chat-container">
            <div class="chat-header">
                <div class="chat-header-title">
                    <i class="fas fa-dove"></i>
                    <span id="chat-conversation-title">${AppState.currentConversationId ? (AppState.aiConversations.find(c => c.id === AppState.currentConversationId)?.title || 'Shepherd') : 'Shepherd'}</span>
                </div>
                <div class="chat-header-actions">
                    <button class="icon-btn" id="chat-voice-btn" aria-label="Voice settings">
                        <i class="fas fa-volume-high"></i>
                    </button>
                    <button class="icon-btn" id="chat-new-btn" aria-label="New conversation">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="icon-btn" id="chat-history-btn" aria-label="Conversation history">
                        <i class="fas fa-clock-rotate-left"></i>
                    </button>
                </div>
            </div>

            <div class="chat-messages" id="chat-messages">
                ${AppState.aiChatHistory.length === 0 ? `
                    <div class="text-center text-muted" style="padding: 40px 20px;">
                        <i class="fas fa-dove" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px;"></i>
                        <h3 style="margin-bottom: 8px;">Ask Shepherd</h3>
                        <p>What are you struggling with? 
What questions do you have about the Bible and your Faith? let's talk about it.</p>
                        
                        <div style="display: grid; gap: 8px; margin-top: 24px;">
                            <button class="btn btn-outline btn-sm" onclick="askSuggestedQuestion('What does the Bible say about anxiety?')">
                                What does the Bible say about anxiety?
                            </button>
                            <button class="btn btn-outline btn-sm" onclick="askSuggestedQuestion('How can I strengthen my faith?')">
                                How can I strengthen my faith?
                            </button>
                            <button class="btn btn-outline btn-sm" onclick="askSuggestedQuestion('Explain forgiveness in the Bible')">
                                Explain forgiveness in the Bible
                            </button>
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <div class="chat-input-container">
                <input type="text" id="chat-input" class="chat-input" placeholder="Ask your question..." onkeypress="if(event.key === 'Enter') sendChatMessage()">
                <button class="chat-send-btn" onclick="sendChatMessage()">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    `;

    $('#chat-new-btn').addEventListener('click', startNewConversation);
    $('#chat-history-btn').addEventListener('click', showConversationHistory);
    $('#chat-voice-btn').addEventListener('click', showVoicePickerSheet);

    // Render existing chat history
    renderChatHistory();

    // Scroll to bottom
    scrollChatToBottom();

    // Warm the conversation list cache for the history sheet
    if (AppState.currentUser) loadAIConversationsList();
}

function renderChatHistory() {
    const chatMessages = $('#chat-messages');
    if (!chatMessages || AppState.aiChatHistory.length === 0) return;
    
    chatMessages.innerHTML = AppState.aiChatHistory.map((msg, index) => `
        <div class="chat-message ${msg.role === 'user' ? 'user' : 'ai'}">
            <div class="chat-message-body">${msg.role === 'user' ? escapeHtml(msg.content) : formatAIText(msg.content)}</div>
            ${msg.bibleRefs ? `
                <div class="message-bible-ref">
                    <i class="fas fa-book-bible"></i> ${escapeHtml(msg.bibleRefs)}
                </div>
            ` : ''}
            ${msg.action ? renderActionWidget(msg.action, msg.actionId) : ''}
            ${msg.role === 'assistant' ? `
                <button class="chat-listen-btn" id="listen-btn-${index}" onclick="toggleSpeakMessage(${index})" aria-label="Listen">
                    <i class="fas fa-volume-high"></i> <span>Listen</span>
                </button>
            ` : ''}
        </div>
    `).join('');
}

function scrollChatToBottom() {
    const chatMessages = $('#chat-messages');
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

function askSuggestedQuestion(question) {
    const chatInput = $('#chat-input');
    if (chatInput) {
        chatInput.value = question;
        sendChatMessage();
    }
}

async function sendChatMessage(override) {
    const chatInput = $('#chat-input');

    let displayText;
    let apiText;

    if (override && typeof override === 'object') {
        displayText = override.displayText;
        apiText = override.apiText || override.displayText;
    } else {
        displayText = apiText = (override || chatInput?.value.trim());
    }

    if (chatInput) chatInput.value = '';
    if (!displayText) return;
    
    // Add user message to chat (what the user sees)
    AppState.aiChatHistory.push({
        role: 'user',
        content: displayText,
        timestamp: Date.now()
    });
    
    renderChatHistory();
    scrollChatToBottom();
    
    // Show typing indicator
    const typingId = generateId();
    const typingHTML = `
        <div class="chat-message ai" id="${typingId}">
            <div style="display: flex; gap: 4px;">
                <span style="animation: pulse 1s infinite;">●</span>
                <span style="animation: pulse 1s infinite 0.2s;">●</span>
                <span style="animation: pulse 1s infinite 0.4s;">●</span>
            </div>
        </div>
    `;
    $('#chat-messages').insertAdjacentHTML('beforeend', typingHTML);
    scrollChatToBottom();
    
    try {
        // Call DeepSeek AI with the (possibly richer) API-facing text
        const aiResponse = await callDeepSeekAI(apiText);

        // Remove typing indicator
        $(`#${typingId}`)?.remove();

        let actionId = null;
        if (aiResponse.action) {
            actionId = generateId();
            pendingAIActions[actionId] = aiResponse.action;
        }

        // Add AI response
        AppState.aiChatHistory.push({
            role: 'assistant',
            content: aiResponse.text,
            bibleRefs: aiResponse.bibleRefs,
            action: aiResponse.action || null,
            actionId,
            timestamp: Date.now()
        });
        
        renderChatHistory();
        scrollChatToBottom();
        
        // Save conversation to the database with a refined title
        saveCurrentConversation();
    } catch (error) {
        // Remove typing indicator
        $(`#${typingId}`)?.remove();
        
        showToast('Failed to get AI response', 'error');
        console.error('AI error:', error);
        
        // Add error message
        AppState.aiChatHistory.push({
            role: 'assistant',
            content: "I'm having trouble connecting right now. Please try again in a moment.",
            timestamp: Date.now()
        });
        
        renderChatHistory();
        scrollChatToBottom();
    }
}

function discussReflectionWithShepherd() {
    const reflection = AppState.todayReflection || '';
    navigateTo('ask');
    setTimeout(() => {
        sendChatMessage({
            displayText: "Let's talk about today's reflection.",
            apiText: `Today's devotional reflection is: "${reflection}" The user wants to discuss this reflection and go deeper into it. Respond directly about its themes and application without asking the user to restate or repeat the reflection to you.`
        });
    }, 400);
}

async function callDeepSeekAI(message) {
    const systemPrompt = `You are Shepherd, the AI-powered Christian companion inside the ADULLAM app. You are knowledgeable, compassionate, and biblically grounded. You reference the Bible when appropriate, provide specific verses, explain biblical context, encourage personal Bible study, and maintain a conversational, warm tone while remaining respectful. You distinguish between what Scripture says and areas where Christians may have different interpretations. You never present personal opinions as biblical facts.

Formatting rules: Write in plain, natural sentences and short paragraphs. Do not use markdown symbols like **, ##, or bullet dashes, and do not use em dashes. If a list genuinely helps, write it as short plain sentences separated by line breaks instead of using markdown list syntax.

Action rule: If, and only if, the user is clearly asking you to DO something the app can perform for them (create a Bible reading plan, publish something to the community feed, open a specific Bible passage, or save a note/prayer list as a downloadable file), end your reply with exactly one line in this exact machine-readable format and nothing after it:
§ACTION§{"type":"create_plan|create_post|open_bible|download_file","label":"short button label","data":{...}}
For create_plan, data may include planType, duration (days), description.
For create_post, data may include content, reference, embedUrl.
For open_bible, data must include book and chapter.
For download_file, data must include filename and content.
Omit the §ACTION§ line entirely for normal conversational replies.`;
    
    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            temperature: 0.7,
            max_tokens: 600
        })
    });
    
    if (!response.ok) {
        throw new Error('AI API request failed');
    }
    
    const data = await response.json();
    const rawText = data.choices[0].message.content;

    const { cleanText, action } = extractAIAction(rawText);

    // Extract Bible references (simple pattern matching)
    const bibleRefs = extractBibleReferences(cleanText);
    
    return {
        text: cleanText,
        bibleRefs: bibleRefs,
        action
    };
}

/* ---- Structured (non-markdown) rendering for AI replies ---- */
function inlineFormat(str) {
    return str
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function formatAIText(raw) {
    if (!raw) return '';
    let text = escapeHtml(raw);

    // Replace em/en dashes used as structural punctuation with plain, conversational punctuation
    text = text.replace(/\s*[—–]\s*/g, ', ');

    const lines = text.split('\n');
    let html = '';
    let inList = false;
    let listType = null;

    const closeList = () => {
        if (inList) {
            html += listType === 'ol' ? '</ol>' : '</ul>';
            inList = false;
            listType = null;
        }
    };

    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) { closeList(); return; }

        const headerMatch = trimmed.match(/^#{1,4}\s+(.*)$/);
        if (headerMatch) {
            closeList();
            html += `<h4 class="ai-heading">${inlineFormat(headerMatch[1])}</h4>`;
            return;
        }

        const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
        if (bulletMatch) {
            if (!inList || listType !== 'ul') { closeList(); html += '<ul class="ai-list">'; inList = true; listType = 'ul'; }
            html += `<li>${inlineFormat(bulletMatch[1])}</li>`;
            return;
        }

        const numMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
        if (numMatch) {
            if (!inList || listType !== 'ol') { closeList(); html += '<ol class="ai-list">'; inList = true; listType = 'ol'; }
            html += `<li>${inlineFormat(numMatch[1])}</li>`;
            return;
        }

        closeList();
        html += `<p>${inlineFormat(trimmed)}</p>`;
    });

    closeList();
    return html;
}

function stripMarkdownForSpeech(raw) {
    if (!raw) return '';
    return raw
        .replace(/§ACTION§[\s\S]*$/, '')
        .replace(/\s*[—–]\s*/g, ', ')
        .replace(/^#{1,4}\s+/gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1$2')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/^[-*•]\s+/gm, '')
        .replace(/^\d+[.)]\s+/gm, '')
        .replace(/\n{2,}/g, '. ')
        .replace(/\n/g, ' ')
        .trim();
}

/* ============================================
   VOICE (Text-to-Speech for Shepherd's replies)
   ============================================ */
let availableVoices = [];
let currentUtterance = null;
let currentSpeakingIndex = null;

// Name fragments that reliably indicate a more natural-sounding voice
// across Chrome, Edge, and Safari/iOS, so the 3-4 options we surface
// aren't the flat default robotic system voice.
const PREFERRED_VOICE_HINTS = [
    'natural', 'neural', 'enhanced', 'premium', 'google us english',
    'google uk english female', 'google uk english male',
    'samantha', 'ava', 'siri', 'aria', 'jenny'
];

function loadAvailableVoices() {
    const all = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    const english = all.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
    const pool = english.length ? english : all;

    const scored = pool.map(v => {
        const nameLower = v.name.toLowerCase();
        const score = PREFERRED_VOICE_HINTS.some(hint => nameLower.includes(hint)) ? 1 : 0;
        return { voice: v, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Dedupe by name and cap at 4 choices
    const seen = new Set();
    availableVoices = [];
    for (const { voice } of scored) {
        if (seen.has(voice.name)) continue;
        seen.add(voice.name);
        availableVoices.push(voice);
        if (availableVoices.length >= 4) break;
    }

    // Default to a saved preference if it's still available, otherwise
    // the first (best-ranked) voice.
    const savedURI = localStorage.getItem('adullam_voice_uri');
    if (savedURI && availableVoices.some(v => v.voiceURI === savedURI)) {
        AppState.selectedVoiceURI = savedURI;
    } else if (availableVoices.length > 0 && !AppState.selectedVoiceURI) {
        AppState.selectedVoiceURI = availableVoices[0].voiceURI;
    }
}

function initVoices() {
    if (!window.speechSynthesis) return;
    loadAvailableVoices();
    // Voice lists load asynchronously in some browsers (notably Chrome).
    window.speechSynthesis.onvoiceschanged = loadAvailableVoices;
}

function getSelectedVoice() {
    return availableVoices.find(v => v.voiceURI === AppState.selectedVoiceURI) || availableVoices[0] || null;
}

function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (currentSpeakingIndex !== null) {
        const btn = document.getElementById(`listen-btn-${currentSpeakingIndex}`);
        if (btn) btn.classList.remove('speaking');
    }
    currentUtterance = null;
    currentSpeakingIndex = null;
}

function toggleSpeakMessage(index) {
    if (!window.speechSynthesis) {
        showToast('Voice playback is not supported on this device', 'warning');
        return;
    }

    // Tapping the message that's already playing stops it.
    if (currentSpeakingIndex === index) {
        stopSpeaking();
        return;
    }

    stopSpeaking();

    const msg = AppState.aiChatHistory[index];
    if (!msg) return;

    const text = stripMarkdownForSpeech(msg.content);
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getSelectedVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 0.98;
    utterance.pitch = 1;
    utterance.volume = 1;

    const btn = document.getElementById(`listen-btn-${index}`);

    utterance.onstart = () => {
        currentSpeakingIndex = index;
        if (btn) btn.classList.add('speaking');
    };
    utterance.onend = utterance.onerror = () => {
        if (btn) btn.classList.remove('speaking');
        if (currentSpeakingIndex === index) currentSpeakingIndex = null;
        currentUtterance = null;
    };

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
}

function showVoicePickerSheet() {
    if (!window.speechSynthesis) {
        showToast('Voice playback is not supported on this device', 'warning');
        return;
    }

    if (availableVoices.length === 0) loadAvailableVoices();

    const renderVoiceList = () => {
        if (availableVoices.length === 0) {
            return `<p class="text-center text-muted" style="padding: 20px 0;">No voices found on this device yet — try again in a moment.</p>`;
        }
        return availableVoices.map(v => `
            <div class="voice-option ${v.voiceURI === AppState.selectedVoiceURI ? 'active' : ''}" data-voice-uri="${escapeHtml(v.voiceURI)}">
                <div class="voice-option-info" onclick="selectVoice('${v.voiceURI.replace(/'/g, "\\'")}')">
                    <div class="voice-option-name">${escapeHtml(v.name.replace(/^Google\s|^Microsoft\s/, ''))}</div>
                    <div class="voice-option-lang">${escapeHtml(v.lang)}</div>
                </div>
                <button class="icon-btn" onclick="previewVoice('${v.voiceURI.replace(/'/g, "\\'")}')" aria-label="Preview voice">
                    <i class="fas fa-play"></i>
                </button>
                <i class="fas fa-check voice-selected-check"></i>
            </div>
        `).join('');
    };

    showSheet(`
        <h3 style="margin-bottom: 4px;">Shepherd's Voice</h3>
        <p class="text-muted" style="font-size: 13px; margin-bottom: 16px;">Choose how AI replies sound when read aloud.</p>
        <div id="voice-options-list">${renderVoiceList()}</div>
    `);
}

function selectVoice(voiceURI) {
    AppState.selectedVoiceURI = voiceURI;
    localStorage.setItem('adullam_voice_uri', voiceURI);

    $$('.voice-option').forEach(el => {
        el.classList.toggle('active', el.dataset.voiceUri === voiceURI);
    });

    showToast('Voice updated', 'success');
}

function previewVoice(voiceURI) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const voice = availableVoices.find(v => v.voiceURI === voiceURI);
    const utterance = new SpeechSynthesisUtterance("Peace be with you. This is how I'll sound.");
    if (voice) utterance.voice = voice;
    utterance.rate = 0.98;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
}

/* ---- AI-triggered action widgets ---- */
function extractAIAction(text) {
    const match = text.match(/§ACTION§(\{[\s\S]*\})\s*$/);
    if (!match) return { cleanText: text, action: null };

    let action = null;
    try {
        action = JSON.parse(match[1]);
    } catch (e) {
        action = null;
    }

    const cleanText = text.slice(0, match.index).trim();
    return { cleanText, action };
}

function renderActionWidget(action, actionId) {
    if (!action) return '';
    const icons = {
        create_plan: 'fa-calendar-check',
        create_post: 'fa-users',
        open_bible: 'fa-book-bible',
        download_file: 'fa-download'
    };
    const icon = icons[action.type] || 'fa-bolt';

    return `
        <button class="ai-action-widget" id="widget-${actionId}" onclick="executeAIAction('${actionId}')">
            <span class="ai-action-icon"><i class="fas ${icon}"></i></span>
            <span class="ai-action-label">${escapeHtml(action.label || 'Run this')}</span>
            <i class="fas fa-arrow-right ai-action-arrow"></i>
        </button>
    `;
}

async function executeAIAction(actionId) {
    const action = pendingAIActions[actionId];
    if (!action) return;

    const widget = document.getElementById(`widget-${actionId}`);
    if (widget) {
        widget.disabled = true;
        widget.classList.add('running');
    }

    try {
        switch (action.type) {
            case 'create_plan': {
                const data = action.data || {};
                const duration = parseInt(data.duration) || 7;
                const plan = await generatePlanWithAI(data.planType || 'custom', duration, data.description || action.label);

                AppState.currentPlan = plan;
                AppState.plannerData.push(plan);

                if (AppState.currentUser) {
                    await database.ref(`users/${AppState.currentUser.uid}/planner`).set(AppState.plannerData);
                }

                showToast('Plan created!', 'success');
                navigateTo('planner');
                break;
            }
            case 'create_post': {
                if (!AppState.currentUser) {
                    showToast('Please sign in first', 'warning');
                    break;
                }
                const data = action.data || {};
                const post = {
                    id: generateId(),
                    authorId: AppState.currentUser.uid,
                    authorName: AppState.userProfile?.username || 'Anonymous',
                    content: data.content || action.label || '',
                    bibleReference: data.reference || null,
                    embedUrl: data.embedUrl || null,
                    timestamp: Date.now(),
                    likes: {},
                    comments: {}
                };

                await database.ref(`community/posts/${post.id}`).set(post);
                showToast('Posted to community!', 'success');
                navigateTo('community');
                break;
            }
            case 'open_bible': {
                const data = action.data || {};
                openBibleChapter(data.book || 'John', parseInt(data.chapter) || 1);
                break;
            }
            case 'download_file': {
                const data = action.data || {};
                const blob = new Blob([data.content || ''], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = data.filename || 'adullam-note.txt';
                document.body.appendChild(link);
                link.click();
                link.remove();
                URL.revokeObjectURL(url);
                showToast('File downloaded', 'success');
                break;
            }
            default:
                showToast('This action is not supported yet', 'warning');
        }

        if (widget) {
            widget.classList.remove('running');
            widget.classList.add('done');
            widget.innerHTML = `<span class="ai-action-icon"><i class="fas fa-check"></i></span><span class="ai-action-label">Done</span>`;
        }
    } catch (error) {
        console.error('Action error:', error);
        showToast('Failed to complete that action', 'error');
        if (widget) {
            widget.disabled = false;
            widget.classList.remove('running');
        }
    }
}

/* ---- Conversation history (saved to the database) ---- */
async function loadAIConversationsList() {
    if (!AppState.currentUser) return [];

    try {
        const uid = AppState.currentUser.uid;
        const snapshot = await database.ref(`users/${uid}/aiConversations`).once('value');
        const data = snapshot.val() || {};
        AppState.aiConversations = Object.values(data).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (error) {
        console.error('Error loading conversations:', error);
    }

    return AppState.aiConversations;
}

async function saveCurrentConversation() {
    if (!AppState.currentUser || AppState.aiChatHistory.length === 0) return;

    const uid = AppState.currentUser.uid;
    if (!AppState.currentConversationId) {
        AppState.currentConversationId = generateId();
    }

    const existing = AppState.aiConversations.find(c => c.id === AppState.currentConversationId);
    const conv = {
        id: AppState.currentConversationId,
        title: existing?.title || truncate(AppState.aiChatHistory[0].content, 40),
        titleRefined: existing?.titleRefined || false,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
        messages: AppState.aiChatHistory
    };

    try {
        await database.ref(`users/${uid}/aiConversations/${conv.id}`).set(conv);
        const idx = AppState.aiConversations.findIndex(c => c.id === conv.id);
        if (idx !== -1) AppState.aiConversations[idx] = conv;
        else AppState.aiConversations.unshift(conv);
    } catch (error) {
        console.error('Error saving conversation:', error);
    }

    // Once we have a real exchange, ask the AI for a short, refined title
    if (!conv.titleRefined && AppState.aiChatHistory.length >= 2) {
        refineConversationTitle(conv.id, AppState.aiChatHistory);
    }
}

async function refineConversationTitle(convId, messages) {
    try {
        const summaryPrompt = `Give a short, plain title (4 words or fewer, no quotes, no punctuation at the end) that summarizes what this conversation is about:\nUser: ${messages[0].content}\nAssistant: ${(messages[1]?.content || '').slice(0, 200)}`;

        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [{ role: 'user', content: summaryPrompt }],
                temperature: 0.4,
                max_tokens: 20
            })
        });

        if (!response.ok) return;
        const data = await response.json();
        let title = data.choices?.[0]?.message?.content?.trim().replace(/^["']+|["']+$/g, '');
        if (!title) return;
        if (title.length > 48) title = title.slice(0, 48);

        if (AppState.currentUser) {
            await database.ref(`users/${AppState.currentUser.uid}/aiConversations/${convId}`).update({ title, titleRefined: true });
        }

        const idx = AppState.aiConversations.findIndex(c => c.id === convId);
        if (idx !== -1) {
            AppState.aiConversations[idx].title = title;
            AppState.aiConversations[idx].titleRefined = true;
        }

        if (AppState.currentConversationId === convId) {
            const titleEl = $('#chat-conversation-title');
            if (titleEl) titleEl.textContent = title;
        }
    } catch (error) {
        console.error('Error refining conversation title:', error);
    }
}

function startNewConversation() {
    stopSpeaking();
    AppState.aiChatHistory = [];
    AppState.currentConversationId = null;
    renderAskPage();
}

function loadConversation(convId) {
    const conv = AppState.aiConversations.find(c => c.id === convId);
    if (!conv) return;

    stopSpeaking();
    AppState.aiChatHistory = conv.messages || [];
    AppState.currentConversationId = conv.id;
    closeSheet();
    renderAskPage();
}

function showConversationHistory() {
    if (!requireAuth('Sign in to save your conversation history.')) return;

    const renderList = () => {
        if (AppState.aiConversations.length === 0) {
            return `<p class="text-center text-muted" style="padding: 24px 0;">No saved conversations yet</p>`;
        }
        return AppState.aiConversations.map(conv => `
            <div class="conversation-item ${conv.id === AppState.currentConversationId ? 'active' : ''}">
                <div class="conversation-item-main" onclick="loadConversation('${conv.id}')">
                    <div style="font-weight: 600;">${escapeHtml(conv.title || 'Untitled conversation')}</div>
                    <div style="font-size: 12px; color: var(--text-slate);">${formatDate(conv.updatedAt || conv.createdAt)}</div>
                </div>
                <button class="icon-btn" onclick="renameConversation('${conv.id}')" aria-label="Rename">
                    <i class="fas fa-pen"></i>
                </button>
                <button class="icon-btn" onclick="deleteConversation('${conv.id}')" aria-label="Delete">
                    <i class="fas fa-trash" style="color: #f44336;"></i>
                </button>
            </div>
        `).join('');
    };

    const sheetContent = `
        <div class="flex items-center justify-between mb-3">
            <h3>Conversations</h3>
            <button class="btn btn-primary btn-sm" onclick="closeSheet(); startNewConversation();">
                <i class="fas fa-plus"></i> New
            </button>
        </div>
        <div id="conversation-list">${renderList()}</div>
    `;

    showSheet(sheetContent);

    loadAIConversationsList().then(() => {
        const listEl = $('#conversation-list');
        if (listEl) listEl.innerHTML = renderList();
    });
}

function renameConversation(convId) {
    const conv = AppState.aiConversations.find(c => c.id === convId);
    if (!conv) return;

    const modalContent = `
        <h3 style="margin-bottom: 16px;">Rename Conversation</h3>
        <input type="text" id="rename-conv-input" class="form-input" value="${escapeHtml(conv.title || '')}">
        <button id="save-rename-btn" class="btn btn-primary btn-block mt-3">Save</button>
    `;
    showModal(modalContent);

    $('#save-rename-btn').addEventListener('click', async () => {
        const newTitle = $('#rename-conv-input').value.trim();
        if (!newTitle) {
            showToast('Title cannot be empty', 'warning');
            return;
        }

        try {
            if (AppState.currentUser) {
                await database.ref(`users/${AppState.currentUser.uid}/aiConversations/${convId}`).update({ title: newTitle, titleRefined: true });
            }
            conv.title = newTitle;
            conv.titleRefined = true;
            closeModal();
            showToast('Renamed', 'success');
            showConversationHistory();
        } catch (error) {
            showToast('Failed to rename', 'error');
        }
    });
}

function deleteConversation(convId) {
    showModal(`
        <h3 style="margin-bottom: 16px;">Delete Conversation</h3>
        <p>This can't be undone.</p>
        <div style="display: flex; gap: 8px; margin-top: 16px;">
            <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn btn-accent" onclick="confirmDeleteConversation('${convId}')">Delete</button>
        </div>
    `);
}

async function confirmDeleteConversation(convId) {
    try {
        if (AppState.currentUser) {
            await database.ref(`users/${AppState.currentUser.uid}/aiConversations/${convId}`).remove();
        }
        AppState.aiConversations = AppState.aiConversations.filter(c => c.id !== convId);
        if (AppState.currentConversationId === convId) {
            startNewConversation();
        }
        closeModal();
        showToast('Conversation deleted', 'success');
        showConversationHistory();
    } catch (error) {
        showToast('Failed to delete', 'error');
    }
}

function extractBibleReferences(text) {
    const refs = [];
    const patterns = [
        /\b(?:[1-3]\s*)?(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|John|Jude|Revelation)\s+\d+:\d+(?:\s*[-–]\s*\d+)?\b/gi
    ];
    
    patterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
            refs.push(...matches);
        }
    });
    
    return refs.length > 0 ? refs.join(', ') : null;
}

/* ============================================
   BIBLE PLANNER
   ============================================ */
function renderPlannerPage() {
    DOM.pageContainer.innerHTML = `
        <div class="planner-container">
            <div class="flex items-center justify-between mb-4">
                <h2 style="font-weight: 700;">Bible Planner</h2>
                <button class="btn btn-primary btn-sm" onclick="createNewPlan()">
                    <i class="fas fa-plus"></i> New Plan
                </button>
            </div>
            
            <div class="planner-stats">
                <div class="stat-card">
                    <div class="stat-value">${AppState.currentPlan?.progress || 0}%</div>
                    <div class="stat-label">Overall Progress</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${AppState.currentPlan?.streak || 0}</div>
                    <div class="stat-label">Day Streak</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${AppState.currentPlan?.completed || 0}/${AppState.currentPlan?.total || 0}</div>
                    <div class="stat-label">Days Completed</div>
                </div>
            </div>
            
            <div id="planner-content">
                ${AppState.plannerData.length > 0 ? `
                    <h3 style="font-weight: 600; margin-bottom: 16px;">Today's Reading</h3>
                    ${renderPlannerDays()}
                ` : `
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <i class="fas fa-calendar-check"></i>
                        </div>
                        <h3 style="margin-bottom: 8px;">No Active Plans</h3>
                        <p style="color: var(--text-slate); margin-bottom: 16px;">Create your first Bible reading plan with AI assistance.</p>
                        <button class="btn btn-primary" onclick="createNewPlan()">
                            <i class="fas fa-plus"></i> Create Plan
                        </button>
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderPlannerDays() {
    if (!AppState.currentPlan || !AppState.currentPlan.days) return '';
    
    const today = new Date().toISOString().split('T')[0];
    const todayPlan = AppState.currentPlan.days.find(d => d.date === today);
    
    return AppState.currentPlan.days.slice(0, 7).map(day => `
        <div class="planner-day ${day.completed ? 'completed' : ''}">
            <div class="planner-day-checkbox ${day.completed ? 'checked' : ''}" onclick="togglePlannerDay('${day.date}')">
                ${day.completed ? '<i class="fas fa-check"></i>' : ''}
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 600;">${day.passage}</div>
                <div style="font-size: 12px; color: var(--text-slate);">${day.topic}</div>
                <div style="font-size: 12px; color: var(--text-slate);">${formatDate(day.date)}</div>
            </div>
            <i class="fas fa-chevron-right" style="color: var(--text-slate);"></i>
        </div>
    `).join('');
}

function createNewPlan() {
    const modalContent = `
        <h3 style="margin-bottom: 16px;">Create Bible Plan</h3>
        <p style="color: var(--text-slate); margin-bottom: 16px;">Let AI create a personalized plan for you.</p>
        
        <div class="form-group">
            <label class="form-label">Plan Type</label>
            <select id="plan-type" class="form-select">
                <option value="new_christian">New Christian</option>
                <option value="bible_year">Read Bible in One Year</option>
                <option value="faith_struggle">30-Day Faith Journey</option>
                <option value="relationships">Relationships</option>
                <option value="prayer">Prayer</option>
                <option value="purpose">Purpose & Calling</option>
                <option value="young_christians">Young Christians</option>
                <option value="gospel">Gospel Reading</option>
                <option value="character_study">Character Study</option>
                <option value="custom">Custom Plan</option>
            </select>
        </div>
        
        <div class="form-group" id="custom-plan-group" style="display: none;">
            <label class="form-label">Describe Your Plan</label>
            <textarea id="custom-plan-description" class="form-textarea" placeholder="What would you like to study?"></textarea>
        </div>
        
        <div class="form-group">
            <label class="form-label">Duration</label>
            <select id="plan-duration" class="form-select">
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
            </select>
        </div>
        
        <button id="generate-plan-btn" class="btn btn-primary btn-block mt-3">
            <i class="fas fa-dove"></i> Generate Plan
        </button>
    `;
    
    showModal(modalContent);
    
    $('#plan-type').addEventListener('change', (e) => {
        $('#custom-plan-group').style.display = e.target.value === 'custom' ? 'block' : 'none';
    });
    
    $('#generate-plan-btn').addEventListener('click', async () => {
        const planType = $('#plan-type').value;
        const duration = parseInt($('#plan-duration').value);
        const customDescription = $('#custom-plan-description')?.value;

        const btn = $('#generate-plan-btn');
        btn.disabled = true;
        btn.classList.add('btn-loading');
        btn.innerHTML = `<span class="btn-spinner"></span> Generating…`;

        try {
            const plan = await generatePlanWithAI(planType, duration, customDescription, (done, total) => {
                if (btn) btn.innerHTML = `<span class="btn-spinner"></span> Generating ${done}/${total} days…`;
            });
            
            AppState.currentPlan = plan;
            AppState.plannerData.push(plan);
            
            if (AppState.currentUser) {
                const uid = AppState.currentUser.uid;
                await database.ref(`users/${uid}/planner`).set(AppState.plannerData);
            }
            
            closeModal();
            showToast('Plan created successfully!', 'success');
            renderPlannerPage();
        } catch (error) {
            showToast('Failed to generate plan', 'error');
            console.error(error);
            btn.disabled = false;
            btn.classList.remove('btn-loading');
            btn.innerHTML = `<i class="fas fa-dove"></i> Generate Plan`;
        }
    });
}

async function generatePlanWithAI(planType, duration, customDescription, onProgress) {
    const planLabel = planType.replace(/_/g, ' ');
    const days = [];
    const startDate = new Date();
    const batchSize = 30;

    const fallbackTopics = ['Faith', 'Hope', 'Love', 'Prayer', 'Forgiveness', 'Purpose', 'Wisdom', 'Peace', 'Joy', 'Patience'];
    const fallbackPassages = ['Matthew 5', 'Psalm 23', 'Romans 8', 'Proverbs 3', 'John 3', 'Philippians 4', 'Isaiah 40', 'Jeremiah 29', 'James 1', '1 Corinthians 13'];

    while (days.length < duration) {
        const remaining = duration - days.length;
        const count = Math.min(batchSize, remaining);
        const usedTopics = days.slice(-10).map(d => d.topic).filter(Boolean);

        const prompt = `Create ${count} consecutive days of a Bible reading plan for someone focused on: ${planLabel}.${customDescription ? ` Specific focus: ${customDescription}.` : ''}
This is day ${days.length + 1} through ${days.length + count} of a ${duration}-day plan.
${usedTopics.length ? `Avoid repeating these recent topics: ${usedTopics.join(', ')}.` : ''}
Respond with ONLY a JSON array (no markdown, no code fences, no commentary) of exactly ${count} objects, each with these exact fields:
- "passage": a specific Bible reference (e.g. "Romans 8:28-39")
- "topic": a short 1-3 word theme
- "reflection_question": one thoughtful open-ended question about the passage
- "prayer_point": one short prayer focus related to the passage`;

        try {
            const response = await fetch(DEEPSEEK_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        { role: 'system', content: 'You generate structured Bible reading plans. You always respond with strictly valid JSON only — no markdown formatting, no code fences, no extra text before or after the JSON array.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.8,
                    max_tokens: Math.min(4000, count * 150)
                })
            });

            if (!response.ok) throw new Error('AI plan request failed');

            const data = await response.json();
            let raw = data.choices[0].message.content.trim();
            raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

            const arrayMatch = raw.match(/\[[\s\S]*\]/);
            const parsed = JSON.parse(arrayMatch ? arrayMatch[0] : raw);

            parsed.slice(0, count).forEach(entry => {
                const date = new Date(startDate);
                date.setDate(date.getDate() + days.length);
                const topic = entry.topic || planLabel;
                days.push({
                    date: date.toISOString().split('T')[0],
                    passage: entry.passage || 'Psalm 23',
                    topic,
                    reflection_question: entry.reflection_question || `What does this passage teach you about ${topic}?`,
                    prayer_point: entry.prayer_point || `Pray for deeper understanding of ${topic}`,
                    completed: false
                });
            });
        } catch (error) {
            console.error('AI plan generation error — filling this batch with a fallback so the plan still completes:', error);
            for (let i = 0; i < count; i++) {
                const date = new Date(startDate);
                date.setDate(date.getDate() + days.length);
                const topic = fallbackTopics[days.length % fallbackTopics.length];
                days.push({
                    date: date.toISOString().split('T')[0],
                    passage: fallbackPassages[days.length % fallbackPassages.length],
                    topic,
                    reflection_question: `What does this passage teach you about ${topic}?`,
                    prayer_point: `Pray for deeper understanding of ${topic}`,
                    completed: false
                });
            }
        }

        if (onProgress) onProgress(days.length, duration);
    }

    return {
        id: generateId(),
        name: `${planLabel.replace(/\b\w/g, l => l.toUpperCase())} Plan`,
        type: planType,
        duration,
        createdAt: Date.now(),
        days,
        progress: 0,
        streak: 0,
        completed: 0,
        total: duration
    };
}

function togglePlannerDay(date) {
    if (!AppState.currentPlan) return;
    
    const day = AppState.currentPlan.days.find(d => d.date === date);
    if (day) {
        day.completed = !day.completed;
        
        // Update progress
        const completedDays = AppState.currentPlan.days.filter(d => d.completed);
        AppState.currentPlan.completed = completedDays.length;
        AppState.currentPlan.progress = Math.round((completedDays.length / AppState.currentPlan.total) * 100);
        
        // Update planner data
        const planIndex = AppState.plannerData.findIndex(p => p.id === AppState.currentPlan.id);
        if (planIndex !== -1) {
            AppState.plannerData[planIndex] = AppState.currentPlan;
        }
        
        // Save to Firebase
        if (AppState.currentUser) {
            const uid = AppState.currentUser.uid;
            database.ref(`users/${uid}/planner`).set(AppState.plannerData);
        }
        
        renderPlannerPage();
        showToast(day.completed ? 'Day completed!' : 'Day uncompleted', 'success');
    }
}

/* ============================================
   REELS (formerly community posts)
   ============================================ */
async function renderReelsPage() {
    DOM.pageContainer.innerHTML = `
        <div class="reels-container" id="reels-container">
            <div class="reel-slide reel-empty-slide">
                <div class="skeleton" style="width: 80%; height: 60%; border-radius: 16px;"></div>
            </div>
        </div>
        <button class="reel-fab" id="new-reel-btn" aria-label="New reel">
            <i class="fas fa-plus"></i>
        </button>
    `;

    $('#new-reel-btn').addEventListener('click', () => showCreateReelModal());

    await loadReels();
}

async function loadReels() {
    const container = $('#reels-container');
    if (!container) return;

    try {
        const snapshot = await database.ref('reels').orderByChild('timestamp').limitToLast(50).once('value');
        const reels = snapshot.val() || {};
        AppState.reels = Object.values(reels).reverse();

        if (AppState.reels.length === 0) {
            container.innerHTML = `
                <div class="reel-slide reel-empty-slide">
                    <div class="text-center">
                        <i class="fas fa-play" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px; color: white;"></i>
                        <h3 style="margin-bottom: 8px; color: white;">No Reels Yet</h3>
                        <p style="color: rgba(255,255,255,0.7);">Be the first to share a verse or moment.</p>
                        <button class="btn btn-primary mt-3" onclick="showCreateReelModal()">
                            <i class="fas fa-plus"></i> Create a Reel
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = AppState.reels.map(reel => renderReelSlide(reel)).join('');
        initReelVideoObservers();
    } catch (error) {
        console.error('Error loading reels:', error);
        container.innerHTML = `<div class="reel-slide reel-empty-slide"><p style="color:white;">Failed to load reels.</p></div>`;
    }
}

function renderReelSlide(reel) {
    const isLoved = reel.likes && AppState.currentUser && reel.likes[AppState.currentUser.uid];
    const loveCount = reel.likes ? Object.keys(reel.likes).length : 0;
    const commentCount = reel.comments ? Object.keys(reel.comments).length : 0;
    const authorName = escapeHtml(reel.authorName || 'Anonymous');
    const safeName = authorName.replace(/'/g, "\\'");

    let mediaHTML = '';
    if (reel.type === 'video') {
        mediaHTML = `<div class="reel-video-wrap">${renderEmbed(reel.videoUrl)}</div>`;
    } else if (reel.type === 'verses' && reel.verses && reel.verses.length > 1) {
        mediaHTML = `
            <div class="reel-verse-album">
                ${reel.verses.map(v => `
                    <div class="verse-album-card">
                        <p class="verse-album-text">"${escapeHtml(v.text)}"</p>
                        <p class="verse-album-ref">${escapeHtml(v.book)} ${v.chapter}:${v.verse} • ${escapeHtml(v.version || 'KJV')}</p>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (reel.type === 'verses' && reel.verses && reel.verses.length === 1) {
        const v = reel.verses[0];
        mediaHTML = `
            <div class="reel-text-slide">
                <p class="reel-quote">"${escapeHtml(v.text)}"</p>
                <p class="reel-quote-ref">${escapeHtml(v.book)} ${v.chapter}:${v.verse} • ${escapeHtml(v.version || 'KJV')}</p>
            </div>
        `;
    } else {
        mediaHTML = `
            <div class="reel-text-slide">
                <p class="reel-quote">${escapeHtml(reel.textContent || '')}</p>
            </div>
        `;
    }

    const readChapterBtn = reel.sourceBook ? `
        <button class="reel-chapter-btn" onclick="openBibleChapter('${reel.sourceBook.replace(/'/g, "\\'")}', ${reel.sourceChapter})">
            <i class="fas fa-book-bible"></i> Read Full Chapter
        </button>
    ` : '';

    return `
        <div class="reel-slide" id="reel-${reel.id}">
            ${mediaHTML}

            <div class="reel-overlay-top"></div>
            <div class="reel-overlay-bottom"></div>

            <div class="reel-author-row" onclick="viewUserProfile('${reel.authorId}', '${safeName}')">
                <div class="post-avatar reel-author-avatar">${authorName[0]?.toUpperCase() || 'U'}</div>
                <div>
                    <div class="reel-author-name">${authorName}</div>
                    <div class="reel-author-time">${formatDate(reel.timestamp)}</div>
                </div>
            </div>

            ${readChapterBtn}

            <div class="reel-actions">
                <button class="reel-action-btn ${isLoved ? 'loved' : ''}" onclick="loveReel('${reel.id}')" aria-label="Drop a heart">
                    <i class="fas fa-heart"></i>
                    <span>${loveCount}</span>
                </button>
                <button class="reel-action-btn" onclick="showReelComments('${reel.id}')" aria-label="Comments">
                    <i class="fas fa-comment"></i>
                    <span>${commentCount}</span>
                </button>
                <button class="reel-action-btn" onclick="shareReel('${reel.id}')" aria-label="Share">
                    <i class="fas fa-share"></i>
                </button>
                ${reel.authorId === AppState.currentUser?.uid ? `
                    <button class="reel-action-btn" onclick="deleteReel('${reel.id}')" aria-label="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function showCreateReelModal(prefill) {
    prefill = prefill || {};
    const modalContent = `
        <h3 style="margin-bottom: 16px;">Create a Reel</h3>

        ${prefill.verses ? `
            <div style="background: rgba(48,72,58,0.08); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                <i class="fas fa-book-bible"></i> ${prefill.verses.length} verse${prefill.verses.length > 1 ? 's' : ''} selected from ${escapeHtml(prefill.sourceBook || '')} ${prefill.sourceChapter || ''}
            </div>
        ` : `
            <div class="form-group">
                <label class="form-label">Share your thoughts</label>
                <textarea id="reel-text-content" class="form-textarea" placeholder="Share a testimony, thought, or encouragement..." rows="4"></textarea>
            </div>

            <div class="form-group">
                <label class="form-label">Or paste a video link (YouTube, X/Twitter)</label>
                <input type="url" id="reel-video-url" class="form-input" placeholder="https://...">
            </div>
        `}

        <button id="submit-reel-btn" class="btn btn-primary btn-block mt-3">Post Reel</button>
    `;

    showModal(modalContent);

    $('#submit-reel-btn').addEventListener('click', async () => {
        if (!requireAuth('Sign in to post.')) return;

        let reel;

        if (prefill.verses) {
            reel = {
                id: generateId(),
                authorId: AppState.currentUser.uid,
                authorName: AppState.userProfile?.username || 'Anonymous',
                type: 'verses',
                verses: prefill.verses,
                sourceBook: prefill.sourceBook || null,
                sourceChapter: prefill.sourceChapter || null,
                timestamp: Date.now(),
                likes: {},
                comments: {}
            };
        } else {
            const textContent = $('#reel-text-content')?.value.trim();
            const videoUrl = $('#reel-video-url')?.value.trim();

            if (!textContent && !videoUrl) {
                showToast('Please write something or add a video link', 'warning');
                return;
            }

            const moderationResult = await moderateContent(textContent || '');
            if (moderationResult.flagged && moderationResult.action === 'hide') {
                showToast('Your reel was flagged by moderation', 'error');
                return;
            }

            reel = {
                id: generateId(),
                authorId: AppState.currentUser.uid,
                authorName: AppState.userProfile?.username || 'Anonymous',
                type: videoUrl ? 'video' : 'text',
                textContent: videoUrl ? null : textContent,
                videoUrl: videoUrl || null,
                timestamp: Date.now(),
                likes: {},
                comments: {}
            };
        }

        try {
            await database.ref(`reels/${reel.id}`).set(reel);
            closeModal();
            showToast('Reel posted!', 'success');
            navigateTo('reels');
        } catch (error) {
            showToast('Failed to post reel', 'error');
        }
    });
}

function updateReelCardDOM(reelId) {
    const reel = AppState.reels.find(r => r.id === reelId);
    const el = document.getElementById(`reel-${reelId}`);
    if (reel && el) {
        el.outerHTML = renderReelSlide(reel);
        initReelVideoObservers();
    }
}

function deleteReel(reelId) {
    showModal(`
        <h3 style="margin-bottom: 16px;">Delete Reel</h3>
        <p>Are you sure you want to delete this reel?</p>
        <div style="display: flex; gap: 8px; margin-top: 16px;">
            <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn btn-accent" onclick="confirmDeleteReel('${reelId}')">Delete</button>
        </div>
    `);
}

async function confirmDeleteReel(reelId) {
    try {
        await database.ref(`reels/${reelId}`).remove();
        closeModal();
        showToast('Reel deleted', 'success');
        // Remove just this slide — reloading the whole feed would reset
        // everyone's scroll position back to the top reel.
        AppState.reels = AppState.reels.filter(r => r.id !== reelId);
        document.getElementById(`reel-${reelId}`)?.remove();
    } catch (error) {
        showToast('Failed to delete reel', 'error');
    }
}

async function loveReel(reelId) {
    if (!requireAuth('Sign in to react to reels.')) return;

    const uid = AppState.currentUser.uid;
    const loveRef = database.ref(`reels/${reelId}/likes/${uid}`);
    const reel = AppState.reels.find(r => r.id === reelId);

    try {
        const snapshot = await loveRef.once('value');
        if (snapshot.exists()) {
            await loveRef.remove();
            if (reel?.likes) delete reel.likes[uid];
        } else {
            await loveRef.set(true);
            if (reel) {
                reel.likes = reel.likes || {};
                reel.likes[uid] = true;
            }
            showToast('You dropped a heart on their reel', 'success');
        }
        // Update just this card in place — don't reload the whole feed.
        updateReelCardDOM(reelId);
    } catch (error) {
        showToast('Failed to update', 'error');
    }
}

function showReelComments(reelId) {
    const reel = AppState.reels.find(r => r.id === reelId);
    if (!reel) return;

    const renderCommentsList = (comments) => {
        const list = Object.entries(comments || {})
            .map(([id, c]) => ({ id, ...c }))
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        if (list.length === 0) {
            return `<p class="text-center text-muted" style="padding: 20px 0;">No comments yet. Be the first to respond.</p>`;
        }

        return list.map(c => `
            <div class="comment-item">
                <div class="post-avatar comment-avatar" style="cursor:pointer;" onclick="viewUserProfile('${c.authorId}', '${(c.authorName || 'User').replace(/'/g, "\\'")}')">
                    ${(c.authorName || 'U')[0].toUpperCase()}
                </div>
                <div class="comment-body">
                    <div class="comment-meta">
                        <span class="comment-author" style="cursor:pointer;" onclick="viewUserProfile('${c.authorId}', '${(c.authorName || 'User').replace(/'/g, "\\'")}')">${escapeHtml(c.authorName || 'Anonymous')}</span>
                        <span class="comment-time">${formatDate(c.timestamp)}</span>
                    </div>
                    <p>${escapeHtml(c.content || '')}</p>
                </div>
            </div>
        `).join('');
    };

    const sheetContent = `
        <h3 style="margin-bottom: 12px;">Comments</h3>
        <div id="comments-list" style="max-height: 40vh; overflow-y: auto; margin-bottom: 12px;">
            ${renderCommentsList(reel.comments)}
        </div>
        <div class="comment-input-row">
            <input type="text" id="new-comment-input" class="form-input" placeholder="Write a comment..." onkeypress="if(event.key === 'Enter') submitReelComment('${reelId}')">
            <button class="btn btn-primary btn-sm" onclick="submitReelComment('${reelId}')">
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
    `;

    showSheet(sheetContent);
    setTimeout(() => $('#new-comment-input')?.focus(), 200);
}

async function submitReelComment(reelId) {
    if (!requireAuth('Sign in to comment.')) return;

    const input = $('#new-comment-input');
    const content = input?.value.trim();
    if (!content) return;

    input.value = '';

    const comment = {
        authorId: AppState.currentUser.uid,
        authorName: AppState.userProfile?.username || 'Anonymous',
        content,
        timestamp: Date.now()
    };

    try {
        const commentId = generateId();
        await database.ref(`reels/${reelId}/comments/${commentId}`).set(comment);

        const reel = AppState.reels.find(r => r.id === reelId);
        if (reel) {
            reel.comments = reel.comments || {};
            reel.comments[commentId] = comment;
        }

        showReelComments(reelId);
        updateReelCardDOM(reelId);
    } catch (error) {
        showToast('Failed to post comment', 'error');
        console.error(error);
    }
}

function renderEmbed(url) {
    // YouTube — render a lightweight thumbnail placeholder. The actual
    // iframe is only created once this slide scrolls into view (see
    // initReelVideoObservers), so it autoplays as the user scrolls to it
    // and stops (freeing resources) once they scroll past.
    if (url && (url.includes('youtube.com') || url.includes('youtu.be'))) {
        const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
        if (videoId) {
            return `
                <div class="reel-yt-wrap" data-yt-id="${videoId}">
                    <img class="reel-yt-thumb" src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt="" loading="lazy">
                    <div class="reel-yt-play"><i class="fas fa-play"></i></div>
                </div>
            `;
        }
    }

    // Twitter/X — render an actual embedded tweet (including native video
    // playback) via Twitter's widgets.js, instead of just linking out.
    if (url && (url.includes('twitter.com') || url.includes('x.com'))) {
        return `
            <div class="reel-tweet-wrap">
                <blockquote class="twitter-tweet" data-theme="dark" data-dnt="true">
                    <a href="${url}"></a>
                </blockquote>
            </div>
        `;
    }

    return `<div class="reel-link-card"><i class="fas fa-link" style="font-size: 32px;"></i><a href="${url}" target="_blank">View Link</a></div>`;
}

/* ---- Scroll-triggered playback: YouTube autoplay + Twitter widget hydration ---- */
let twitterWidgetsLoadingPromise = null;

function ensureTwitterWidgetsLoaded() {
    if (window.twttr && window.twttr.widgets) return Promise.resolve(window.twttr);
    if (twitterWidgetsLoadingPromise) return twitterWidgetsLoadingPromise;

    twitterWidgetsLoadingPromise = new Promise((resolve) => {
        const existing = document.getElementById('twitter-widgets-js');
        if (existing) {
            existing.addEventListener('load', () => resolve(window.twttr));
            return;
        }
        const script = document.createElement('script');
        script.id = 'twitter-widgets-js';
        script.src = 'https://platform.twitter.com/widgets.js';
        script.async = true;
        script.charset = 'utf-8';
        script.onload = () => resolve(window.twttr);
        document.head.appendChild(script);
    });

    return twitterWidgetsLoadingPromise;
}

let reelVideoObserver = null;

function initReelVideoObservers() {
    // Hydrate any tweet placeholders into real, playable embeds.
    ensureTwitterWidgetsLoaded().then((twttr) => {
        if (twttr?.widgets) twttr.widgets.load();
    });

    const container = document.getElementById('reels-container');
    if (!container) return;

    if (reelVideoObserver) reelVideoObserver.disconnect();

    reelVideoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const ytWrap = entry.target.querySelector('.reel-yt-wrap');
            if (!ytWrap) return;

            if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
                activateYouTubeSlide(ytWrap);
            } else {
                deactivateYouTubeSlide(ytWrap);
            }
        });
    }, { root: container, threshold: [0, 0.6, 1] });

    container.querySelectorAll('.reel-slide').forEach(slide => reelVideoObserver.observe(slide));
}

function activateYouTubeSlide(ytWrap) {
    if (ytWrap.querySelector('iframe')) return;

    const videoId = ytWrap.dataset.ytId;
    if (!videoId) return;

    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&loop=1&playlist=${videoId}&controls=1&rel=0`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', '');
    iframe.className = 'reel-yt-iframe';

    ytWrap.appendChild(iframe);
    ytWrap.classList.add('playing');
}

function deactivateYouTubeSlide(ytWrap) {
    const iframe = ytWrap.querySelector('iframe');
    if (iframe) iframe.remove();
    ytWrap.classList.remove('playing');
}

async function moderateContent(content) {
    // Simple moderation (in production, use more sophisticated AI moderation)
    const bannedWords = ['spam', 'scam', 'hack', 'illegal', 'explicit'];
    const flagged = bannedWords.some(word => content.toLowerCase().includes(word));

    if (flagged) {
        return { flagged: true, action: 'hide' };
    }

    return { flagged: false, action: 'approve' };
}

async function shareReel(reelId) {
    const reel = AppState.reels.find(r => r.id === reelId);
    if (!reel) return;

    let shareText = `${reel.authorName}: `;
    if (reel.type === 'verses') {
        shareText += reel.verses.map(v => `"${v.text}" (${v.book} ${v.chapter}:${v.verse})`).join(' ');
    } else if (reel.type === 'video') {
        shareText += reel.videoUrl;
    } else {
        shareText += reel.textContent;
    }

    if (navigator.share) {
        navigator.share({ title: 'ADULLAM Reel', text: shareText }).catch(() => {});
    } else {
        navigator.clipboard.writeText(shareText).then(() => {
            showToast('Reel copied to clipboard!', 'success');
        });
    }

    if (AppState.currentUser) {
        try {
            const snapshot = await database.ref(`users/${AppState.currentUser.uid}/groups`).once('value');
            const groupIds = Object.keys(snapshot.val() || {});
            if (groupIds.length > 0) {
                showShareReelToGroupSheet(reelId, groupIds);
            }
        } catch (error) {
            // silent — sharing to a group is a bonus, not required
        }
    }
}

function showShareReelToGroupSheet(reelId, groupIds) {
    const groupsSnippet = groupIds.map(id => `
        <button class="btn btn-outline btn-block" data-group-id="${id}" onclick="submitShareReelToGroup('${reelId}', '${id}')">
            <i class="fas fa-users"></i> Share to group
        </button>
    `).join('');

    showSheet(`
        <h3 style="margin-bottom: 12px;">Also share to a group?</h3>
        <div style="display: grid; gap: 8px;">${groupsSnippet}</div>
    `);

    // Fill in the actual group names asynchronously
    groupIds.forEach(async (id) => {
        try {
            const snap = await database.ref(`communityGroups/${id}/name`).once('value');
            const name = snap.val();
            const btn = document.querySelector(`[data-group-id="${id}"]`);
            if (btn && name) btn.innerHTML = `<i class="fas fa-users"></i> ${escapeHtml(name)}`;
        } catch (e) { /* ignore */ }
    });
}

async function submitShareReelToGroup(reelId, groupId) {
    if (!AppState.currentUser) return;

    const msg = {
        senderId: AppState.currentUser.uid,
        senderName: AppState.userProfile?.username || 'Anonymous',
        type: 'reel',
        content: reelId,
        timestamp: Date.now()
    };
    try {
        await database.ref(`communityGroups/${groupId}/messages/${generateId()}`).set(msg);
        closeSheet();
        showToast('Shared to group!', 'success');
    } catch (error) {
        showToast('Failed to share', 'error');
    }
}

