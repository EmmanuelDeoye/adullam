/* ============================================
   GraceGuide — js/features.js
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
                        <p>Ask me anything about faith, the Bible, or life. I'm here to help.</p>
                        
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
        <div class="chat-message ${msg.role === 'user' ? 'user' : 'ai'}" id="chat-msg-${index}">
            ${msg.role === 'assistant' ? `
                <button class="chat-listen-btn" id="listen-btn-${index}" onclick="toggleSpeakMessage(${index})" aria-label="Listen">
                    <i class="fas fa-volume-high"></i> <span>Listen</span>
                </button>
            ` : ''}
            <div class="chat-message-body">${msg.role === 'user' ? escapeHtml(msg.content) : linkifyBibleReferences(formatAIText(msg.content))}</div>
            ${msg.bibleRefs ? `
                <div class="message-bible-ref">
                    <i class="fas fa-book-bible"></i> ${escapeHtml(msg.bibleRefs)}
                </div>
            ` : ''}
            ${msg.action ? renderActionWidget(msg.action, msg.actionId) : ''}
            ${msg.crisis ? renderCrisisBanner(msg.crisis) : ''}
            ${msg.role === 'assistant' ? `
                <div class="chat-message-toolbar">
                    <button class="icon-btn" onclick="copyMessageText(${index})" aria-label="Copy"><i class="fas fa-copy"></i></button>
                    <button class="icon-btn" onclick="shareMessageText(${index})" aria-label="Share"><i class="fas fa-share-nodes"></i></button>
                    <button class="icon-btn" onclick="postMessageToReels(${index})" aria-label="Post to Reels"><i class="fas fa-bullhorn"></i></button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

function linkifyBibleReferences(html) {
    const pattern = /\b((?:[1-3]\s*)?(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation)\s+\d+(?::\d+(?:\s*[-–]\s*\d+)?)?)\b/g;
    return html.replace(pattern, (match) => {
        const safe = match.replace(/'/g, "\\'");
        return `<a href="javascript:void(0)" class="bible-ref-link" onclick="openPassageReference('${safe}')">${match}</a>`;
    });
}

function copyMessageText(index) {
    const msg = AppState.aiChatHistory[index];
    if (!msg) return;

    navigator.clipboard.writeText(msg.content).then(() => {
        showToast('Copied to clipboard', 'success');
    }).catch(() => {
        showToast('Could not copy', 'error');
    });
}

function shareMessageText(index) {
    const msg = AppState.aiChatHistory[index];
    if (!msg) return;

    if (navigator.share) {
        navigator.share({ title: 'Shepherd — GraceGuide', text: msg.content }).catch(() => {});
    } else {
        navigator.clipboard.writeText(msg.content).then(() => showToast('Copied for sharing', 'success'));
    }
}

async function postMessageToReels(index) {
    if (!requireAuth('Sign in to post.')) return;

    const msg = AppState.aiChatHistory[index];
    if (!msg) return;

    const reel = {
        id: generateId(),
        authorId: AppState.currentUser.uid,
        authorName: AppState.userProfile?.username || 'Anonymous',
        type: 'text',
        textContent: msg.content,
        timestamp: Date.now(),
        likes: {},
        comments: {}
    };

    try {
        await database.ref(`reels/${reel.id}`).set(reel);
        showToast('Posted to Reels!', 'success');
        navigateTo('reels');
    } catch (error) {
        showToast('Failed to post', 'error');
        console.error(error);
    }
}

function renderCrisisBanner(crisis) {
    const category = crisis?.category || 'This sounds serious';
    return `
        <div class="crisis-banner">
            <div class="crisis-banner-title"><i class="fas fa-hand-holding-heart"></i> You don't have to go through this alone</div>
            <p>${escapeHtml(crisis?.message || "What you're describing matters, and a real person — a pastor, Christian counselor, or mentor — can support you better than I can here.")}</p>
            <button class="btn btn-block" onclick="navigateTo('talk-to-someone')">
                <i class="fas fa-comments"></i> Talk to Someone
            </button>
        </div>
    `;
}

function scrollChatToBottom() {
    const chatMessages = $('#chat-messages');
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

/**
 * Scrolls so the start of a given message (usually a fresh AI reply) is at
 * the top of the visible chat area, rather than jumping to the bottom where
 * only the tail of a long response would be visible.
 */
function scrollToMessageTop(index) {
    const chatMessages = $('#chat-messages');
    const el = document.getElementById(`chat-msg-${index}`);
    if (chatMessages && el) {
        chatMessages.scrollTop = el.offsetTop - 12;
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
            crisis: aiResponse.crisis || null,
            timestamp: Date.now()
        });
        
        renderChatHistory();
        scrollToMessageTop(AppState.aiChatHistory.length - 1);
        
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
        scrollToMessageTop(AppState.aiChatHistory.length - 1);
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

/**
 * Builds a compact summary of the signed-in user's profile and app
 * activity so Shepherd can personalize its responses (e.g. reference
 * their current study plan, streak, or recent reading).
 */
function buildShepherdUserContext() {
    if (!AppState.currentUser) {
        return 'The user is browsing as a guest (not signed in). Do not reference personal data that has not been shared in this conversation.';
    }

    const profile = AppState.userProfile || {};
    const plan = AppState.currentPlan;
    const recentBooks = AppState.readingHistory.slice(-5).map(h => `${h.book} ${h.chapter}`).join(', ') || 'none yet';
    const groupCount = AppState.communityGroups?.filter(g => g.members && AppState.currentUser && g.members[AppState.currentUser.uid]).length || 0;
    const brethrenCount = Array.from(AppState.userConnections.values()).filter(s => s === 'brethren').length;

    const lines = [
        `Signed-in user profile: username "${profile.username || 'Unknown'}"${profile.bio ? `, bio: "${profile.bio}"` : ''}.`,
        `Bible reading: ${AppState.readingHistory.length} chapters read historically; most recently read: ${recentBooks}.`,
        `Bookmarks: ${AppState.bookmarks.length}. Notes saved: ${AppState.notes.length}. Highlights: ${AppState.highlights.length}.`,
        plan
            ? `Active study plan: "${plan.name}" (${plan.type}), ${plan.completed || 0}/${plan.total || 0} days completed (${plan.progress || 0}%), current streak ${plan.streak || 0} days.`
            : 'No active study plan yet.',
        `Total study plans saved: ${AppState.plannerData.length}.`,
        `Forum groups joined: ${groupCount}. Brethren (accepted connections): ${brethrenCount}.`,
        `Prior Shepherd conversations saved: ${AppState.aiConversations.length}.`
    ];

    return `Here is what you know about the signed-in user from the app, for personalizing your response. Only bring these details up when naturally relevant — don't recite this list back to them:\n${lines.join('\n')}`;
}

/**
 * Fast local backstop for crisis language. This runs on every outgoing
 * user message *in addition to* asking the AI to self-report a crisis via
 * §CRISIS§, so a banner still appears even if the model misses it.
 */
function detectCrisisKeywords(text) {
    if (!text) return null;
    const t = text.toLowerCase();

    const patterns = [
        { category: 'suicide', regex: /\b(kill myself|end my life|suicid|don'?t want to (live|be alive)|want to die|better off dead)\b/ },
        { category: 'self_harm', regex: /\b(self.?harm|cutting myself|hurt(ing)? myself|harming myself)\b/ },
        { category: 'abuse', regex: /\b(being abused|sexually abused|molest|being trafficked|someone is hurting me)\b/ },
        { category: 'domestic_violence', regex: /\b(my (husband|wife|partner|boyfriend|girlfriend) (hits|hit|beats|beat) me|domestic violence|afraid (he|she) will hurt me)\b/ }
    ];

    for (const p of patterns) {
        if (p.regex.test(t)) return { category: p.category };
    }
    return null;
}

async function callDeepSeekAI(message) {
    const systemPrompt = `You are Shepherd, the AI-powered Christian companion inside the GraceGuide app. You are knowledgeable, compassionate, and biblically grounded. You reference the Bible when appropriate, provide specific verses, explain biblical context, encourage personal Bible study, and maintain a conversational, warm tone while remaining respectful. You distinguish between what Scripture says and areas where Christians may have different interpretations. You never present personal opinions as biblical facts.

Formatting rules: Write in plain, natural sentences and short paragraphs. Do not use markdown symbols like **, ##, or bullet dashes, and do not use em dashes. If a list genuinely helps, write it as short plain sentences separated by line breaks instead of using markdown list syntax.

Action rule: If, and only if, the user is clearly asking you to DO something the app can perform for them (create a study plan, post a verse or share something to Reels, open a specific Bible passage, or save a note/prayer list as a downloadable file), end your reply with exactly one line in this exact machine-readable format and nothing after it:
§ACTION§{"type":"create_plan|create_post|open_bible|download_file","label":"short button label","data":{...}}
For create_plan, data may include planType, duration (days), description.
For create_post, data may include content, reference, embedUrl.
For open_bible, data must include book, chapter, and optionally verse.
For download_file, data must include filename and content.
Omit the §ACTION§ line entirely for normal conversational replies.

Safety rule: If, and only if, the user's message describes suicidal thoughts, self-harm, sexual abuse, domestic violence, or another severe personal-safety crisis, respond first with a brief, warm, stabilizing message (do not counsel them at length, do not diagnose, do not moralize) and gently encourage them to reach out to a real person. Then end your reply with exactly one line in this exact machine-readable format:
§CRISIS§{"category":"suicide|self_harm|abuse|domestic_violence|severe_crisis","message":"one short compassionate sentence encouraging them to talk to a real person"}
A §CRISIS§ line can appear together with or instead of an §ACTION§ line, each on its own line. Omit it entirely for ordinary conversations, including ordinary sadness, doubt, or struggle that isn't an acute safety crisis.`;

    const userContext = buildShepherdUserContext();

    // Send recent conversation history so Shepherd has continuity within
    // this conversation, not just the latest message in isolation.
    const recentHistory = AppState.aiChatHistory
        .slice(-12)
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

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
                { role: 'system', content: userContext },
                ...recentHistory,
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

    const { cleanText, action, crisis } = extractAIMeta(rawText);

    // Extract Bible references (simple pattern matching)
    const bibleRefs = extractBibleReferences(cleanText);

    // Local keyword backstop, in case the model didn't self-report.
    const localCrisis = detectCrisisKeywords(message);

    return {
        text: cleanText,
        bibleRefs: bibleRefs,
        action,
        crisis: crisis || localCrisis
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
// Curated Shepherd voices. The first two are genuine Azure Neural voices
// with a Nigerian accent; the other two round out the set to 2 male + 2
// female. These only work once AZURE_SPEECH_KEY is configured in config.js —
// otherwise Shepherd falls back to whatever voices the device provides.
const SHEPHERD_VOICES = [
    { id: 'abeo', label: 'Abeo', gender: 'Male', accent: 'Nigerian', azureVoice: 'en-NG-AbeoNeural' },
    { id: 'ezinne', label: 'Ezinne', gender: 'Female', accent: 'Nigerian', azureVoice: 'en-NG-EzinneNeural' },
    { id: 'david', label: 'David', gender: 'Male', accent: 'American', azureVoice: 'en-US-GuyNeural' },
    { id: 'aria', label: 'Aria', gender: 'Female', accent: 'American', azureVoice: 'en-US-AriaNeural' }
];

let availableVoices = [];
let currentSpeakingIndex = null;
let ttsAudioEl = null;

function isCloudVoiceConfigured() {
    return !!AZURE_SPEECH_KEY && AZURE_SPEECH_KEY !== 'YOUR_AZURE_SPEECH_KEY';
}

function getSelectedVoiceOption() {
    const savedId = localStorage.getItem('graceguide_voice_id');
    return SHEPHERD_VOICES.find(v => v.id === savedId) || SHEPHERD_VOICES.find(v => v.id === AppState.selectedVoiceId) || SHEPHERD_VOICES[0];
}

function initVoices() {
    AppState.selectedVoiceId = localStorage.getItem('graceguide_voice_id') || SHEPHERD_VOICES[0].id;

    // Keep a pool of on-device voices as a fallback for when Azure isn't configured.
    if (window.speechSynthesis) {
        const loadBrowserVoices = () => { availableVoices = window.speechSynthesis.getVoices() || []; };
        loadBrowserVoices();
        window.speechSynthesis.onvoiceschanged = loadBrowserVoices;
    }
}

function getTTSAudioElement() {
    if (!ttsAudioEl) ttsAudioEl = new Audio();
    return ttsAudioEl;
}

function buildSSML(text, azureVoiceName) {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<speak version="1.0" xml:lang="en-US"><voice name="${azureVoiceName}"><prosody rate="-4%" pitch="0%">${escaped}</prosody></voice></speak>`;
}

async function synthesizeAzureSpeech(text, azureVoiceName) {
    const url = `https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'
        },
        body: buildSSML(text, azureVoiceName)
    });

    if (!response.ok) throw new Error('Azure Speech request failed');
    const blob = await response.blob();
    return URL.createObjectURL(blob);
}

// Rough heuristic so the on-device fallback at least leans toward the
// gender of the persona the user picked (accent isn't controllable here).
function pickBrowserVoiceForGender(gender) {
    if (availableVoices.length === 0) return null;
    const englishVoices = availableVoices.filter(v => v.lang?.toLowerCase().startsWith('en'));
    const pool = englishVoices.length ? englishVoices : availableVoices;

    const femaleHints = ['female', 'samantha', 'victoria', 'aria', 'jenny', 'zira', 'susan', 'karen', 'moira'];
    const maleHints = ['male', 'david', 'guy', 'daniel', 'alex', 'fred', 'george', 'mark'];
    const hints = gender === 'Male' ? maleHints : femaleHints;

    const match = pool.find(v => hints.some(h => v.name.toLowerCase().includes(h)));
    return match || pool[0];
}

function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (ttsAudioEl) {
        ttsAudioEl.pause();
        ttsAudioEl.currentTime = 0;
    }
    if (currentSpeakingIndex !== null) {
        const btn = document.getElementById(`listen-btn-${currentSpeakingIndex}`);
        if (btn) btn.classList.remove('speaking');
    }
    currentSpeakingIndex = null;
}

async function toggleSpeakMessage(index) {
    if (currentSpeakingIndex === index) {
        stopSpeaking();
        return;
    }
    stopSpeaking();

    const msg = AppState.aiChatHistory[index];
    if (!msg) return;

    const text = stripMarkdownForSpeech(msg.content);
    if (!text) return;

    const voice = getSelectedVoiceOption();
    const btn = document.getElementById(`listen-btn-${index}`);

    currentSpeakingIndex = index;
    if (btn) btn.classList.add('speaking');

    const onDone = () => {
        if (btn) btn.classList.remove('speaking');
        if (currentSpeakingIndex === index) currentSpeakingIndex = null;
    };

    try {
        if (isCloudVoiceConfigured()) {
            const audioUrl = await synthesizeAzureSpeech(text, voice.azureVoice);
            const audio = getTTSAudioElement();
            audio.src = audioUrl;
            audio.onended = onDone;
            audio.onerror = onDone;
            await audio.play();
        } else {
            if (!window.speechSynthesis) {
                showToast('Voice playback is not supported on this device', 'warning');
                onDone();
                return;
            }
            const utterance = new SpeechSynthesisUtterance(text);
            const browserVoice = pickBrowserVoiceForGender(voice.gender);
            if (browserVoice) utterance.voice = browserVoice;
            utterance.rate = 0.96;
            utterance.pitch = voice.gender === 'Male' ? 0.9 : 1.05;
            utterance.onend = onDone;
            utterance.onerror = onDone;
            window.speechSynthesis.speak(utterance);
        }
    } catch (error) {
        console.error('TTS error:', error);
        showToast('Voice playback failed', 'error');
        onDone();
    }
}

function showVoicePickerSheet() {
    const renderVoiceList = () => SHEPHERD_VOICES.map(v => `
        <div class="voice-option ${v.id === getSelectedVoiceOption().id ? 'active' : ''}" data-voice-id="${v.id}">
            <div class="voice-option-info" onclick="selectVoice('${v.id}')">
                <div class="voice-option-name">${v.label} <span style="font-weight:400; color: var(--text-slate);">— ${v.gender}, ${v.accent}${v.accent === 'Nigerian' ? ' 🇳🇬' : ''}</span></div>
                <div class="voice-option-lang">${isCloudVoiceConfigured() ? 'Natural neural voice' : 'On-device fallback (configure Azure Speech for the full voice)'}</div>
            </div>
            <button class="icon-btn" onclick="previewVoice('${v.id}')" aria-label="Preview voice">
                <i class="fas fa-play"></i>
            </button>
            <i class="fas fa-check voice-selected-check"></i>
        </div>
    `).join('');

    showSheet(`
        <h3 style="margin-bottom: 4px;">Shepherd's Voice</h3>
        <p class="text-muted" style="font-size: 13px; margin-bottom: 16px;">Choose how AI replies sound when read aloud.</p>
        <div id="voice-options-list">${renderVoiceList()}</div>
    `);
}

function selectVoice(voiceId) {
    AppState.selectedVoiceId = voiceId;
    localStorage.setItem('graceguide_voice_id', voiceId);

    $$('.voice-option').forEach(el => {
        el.classList.toggle('active', el.dataset.voiceId === voiceId);
    });

    showToast('Voice updated', 'success');
}

async function previewVoice(voiceId) {
    stopSpeaking();
    const voice = SHEPHERD_VOICES.find(v => v.id === voiceId);
    if (!voice) return;

    const sampleText = "Peace be with you. This is how I'll sound.";

    try {
        if (isCloudVoiceConfigured()) {
            const audioUrl = await synthesizeAzureSpeech(sampleText, voice.azureVoice);
            const audio = getTTSAudioElement();
            audio.src = audioUrl;
            await audio.play();
        } else if (window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(sampleText);
            const browserVoice = pickBrowserVoiceForGender(voice.gender);
            if (browserVoice) utterance.voice = browserVoice;
            utterance.rate = 0.96;
            utterance.pitch = voice.gender === 'Male' ? 0.9 : 1.05;
            window.speechSynthesis.speak(utterance);
        }
    } catch (error) {
        console.error('Voice preview error:', error);
        showToast('Could not preview this voice', 'error');
    }
}

/* ---- AI-triggered action widgets ---- */
function extractAIMeta(text) {
    let cleanText = text;
    let action = null;
    let crisis = null;

    const actionMatch = text.match(/§ACTION§(\{[\s\S]*?\})\s*$/m) || text.match(/§ACTION§(\{[\s\S]*\})\s*$/);
    const crisisMatch = text.match(/§CRISIS§(\{[\s\S]*?\})\s*$/m) || text.match(/§CRISIS§(\{[\s\S]*\})\s*$/);

    // Strip whichever markers are present from the tail of the text, starting
    // with whichever one appears later so earlier indices stay valid.
    [actionMatch, crisisMatch]
        .filter(Boolean)
        .sort((a, b) => b.index - a.index)
        .forEach(m => { cleanText = cleanText.slice(0, m.index).trimEnd(); });

    if (actionMatch) {
        try { action = JSON.parse(actionMatch[1]); } catch (e) { action = null; }
    }
    if (crisisMatch) {
        try { crisis = JSON.parse(crisisMatch[1]); } catch (e) { crisis = null; }
    }

    return { cleanText: cleanText.trim(), action, crisis };
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
                const reel = {
                    id: generateId(),
                    authorId: AppState.currentUser.uid,
                    authorName: AppState.userProfile?.username || 'Anonymous',
                    type: data.reference ? 'verses' : (data.embedUrl ? 'video' : 'text'),
                    textContent: !data.reference && !data.embedUrl ? (data.content || action.label || '') : null,
                    verses: data.reference ? [{ reference: data.reference, text: data.content || '' }] : null,
                    videoUrl: data.embedUrl || null,
                    timestamp: Date.now(),
                    likes: {},
                    comments: {}
                };

                await database.ref(`reels/${reel.id}`).set(reel);
                showToast('Posted!', 'success');
                navigateTo('reels');
                break;
            }
            case 'open_bible': {
                const data = action.data || {};
                openBibleChapter(data.book || 'John', parseInt(data.chapter) || 1, data.verse ? parseInt(data.verse) : undefined);
                break;
            }
            case 'download_file': {
                const data = action.data || {};
                const blob = new Blob([data.content || ''], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = data.filename || 'graceguide-note.txt';
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
   STUDY PLANNER
   ============================================ */
function renderPlannerPage() {
    DOM.pageContainer.innerHTML = `
        <div class="planner-container">
            <div class="flex items-center justify-between mb-4">
                <h2 style="font-weight: 700;">Study Planner</h2>
                <button class="btn btn-primary btn-sm" onclick="createNewPlan()">
                    <i class="fas fa-plus"></i> New Plan
                </button>
            </div>

            ${AppState.plannerData.length > 1 ? `
                <div class="form-group" style="margin-bottom: 16px;">
                    <select id="plan-switcher" class="form-select">
                        ${AppState.plannerData.map(p => `<option value="${p.id}" ${p.id === AppState.currentPlan?.id ? 'selected' : ''}>${escapeHtml(p.name || 'Study Plan')}</option>`).join('')}
                    </select>
                </div>
            ` : ''}

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
                    <div class="flex items-center justify-between mb-2">
                        <h3 style="font-weight: 600;">${escapeHtml(AppState.currentPlan?.name || 'Reading')}</h3>
                        <div style="display:flex; gap:8px;">
                            <button class="btn btn-outline btn-sm" onclick="addPlannerDay()">
                                <i class="fas fa-plus"></i> Add Entry
                            </button>
                            <button class="btn btn-outline btn-sm" onclick="deleteCurrentPlan()" style="color:#f44336; border-color:rgba(244,67,54,0.4);">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    ${renderPlannerDays()}
                ` : `
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <i class="fas fa-calendar-check"></i>
                        </div>
                        <h3 style="margin-bottom: 8px;">No Active Plans</h3>
                        <p style="color: var(--text-slate); margin-bottom: 16px;">Create your first study plan with AI assistance.</p>
                        <button class="btn btn-primary" onclick="createNewPlan()">
                            <i class="fas fa-plus"></i> Create Plan
                        </button>
                    </div>
                `}
            </div>
        </div>
    `;

    const switcher = $('#plan-switcher');
    if (switcher) {
        switcher.addEventListener('change', (e) => switchPlan(e.target.value));
    }
}

function switchPlan(planId) {
    const plan = AppState.plannerData.find(p => p.id === planId);
    if (!plan) return;
    AppState.currentPlan = plan;
    renderPlannerPage();
}

function renderPlannerDays() {
    if (!AppState.currentPlan || !AppState.currentPlan.days) return '';

    return AppState.currentPlan.days.map((day, index) => `
        <div class="planner-day ${day.completed ? 'completed' : ''}">
            <div class="planner-day-checkbox ${day.completed ? 'checked' : ''}" onclick="event.stopPropagation(); togglePlannerDay('${day.date}')">
                ${day.completed ? '<i class="fas fa-check"></i>' : ''}
            </div>
            <div style="flex: 1; cursor: pointer;" onclick="openPassageReference('${escapeHtml(day.passage).replace(/'/g, "\\'")}')">
                <div style="font-weight: 600;">${escapeHtml(day.passage)}</div>
                <div style="font-size: 12px; color: var(--text-slate);">${escapeHtml(day.topic)}</div>
                <div style="font-size: 12px; color: var(--text-slate);">${formatDate(day.date)}</div>
            </div>
            <button class="icon-btn" aria-label="Edit entry" onclick="event.stopPropagation(); editPlannerDay(${index})">
                <i class="fas fa-pen" style="font-size: 13px; color: var(--text-slate);"></i>
            </button>
            <button class="icon-btn" aria-label="Delete entry" onclick="event.stopPropagation(); deletePlannerDay(${index})">
                <i class="fas fa-trash" style="font-size: 13px; color: #f44336;"></i>
            </button>
            <i class="fas fa-chevron-right" style="color: var(--text-slate); cursor: pointer;" onclick="openPassageReference('${escapeHtml(day.passage).replace(/'/g, "\\'")}')"></i>
        </div>
    `).join('');
}

function persistPlannerData() {
    if (!AppState.currentUser) return;
    const uid = AppState.currentUser.uid;
    const planIndex = AppState.plannerData.findIndex(p => p.id === AppState.currentPlan.id);
    if (planIndex !== -1) AppState.plannerData[planIndex] = AppState.currentPlan;
    database.ref(`users/${uid}/planner`).set(AppState.plannerData);
}

function recalcPlanProgress() {
    if (!AppState.currentPlan) return;
    const days = AppState.currentPlan.days || [];
    const completedDays = days.filter(d => d.completed);
    AppState.currentPlan.total = days.length;
    AppState.currentPlan.completed = completedDays.length;
    AppState.currentPlan.progress = days.length ? Math.round((completedDays.length / days.length) * 100) : 0;
}

function addPlannerDay() {
    if (!AppState.currentPlan) return;

    const modalContent = `
        <h3 style="margin-bottom: 16px;">Add Study Entry</h3>
        <div class="form-group">
            <label class="form-label">Passage</label>
            <input type="text" id="entry-passage" class="form-input" placeholder="e.g., Romans 8:28-39">
        </div>
        <div class="form-group">
            <label class="form-label">Topic</label>
            <input type="text" id="entry-topic" class="form-input" placeholder="e.g., Hope">
        </div>
        <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" id="entry-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <button id="save-entry-btn" class="btn btn-primary btn-block mt-3">Add Entry</button>
    `;
    showModal(modalContent);

    $('#save-entry-btn').addEventListener('click', () => {
        const passage = $('#entry-passage').value.trim();
        const topic = $('#entry-topic').value.trim();
        if (!passage) {
            showToast('Please enter a passage', 'warning');
            return;
        }

        AppState.currentPlan.days.push({
            date: $('#entry-date').value || new Date().toISOString().split('T')[0],
            passage,
            topic: topic || 'Study',
            completed: false
        });

        recalcPlanProgress();
        persistPlannerData();
        closeModal();
        showToast('Entry added', 'success');
        renderPlannerPage();
    });
}

function editPlannerDay(index) {
    if (!AppState.currentPlan || !AppState.currentPlan.days[index]) return;
    const day = AppState.currentPlan.days[index];

    const modalContent = `
        <h3 style="margin-bottom: 16px;">Edit Study Entry</h3>
        <div class="form-group">
            <label class="form-label">Passage</label>
            <input type="text" id="entry-passage" class="form-input" value="${escapeHtml(day.passage || '')}">
        </div>
        <div class="form-group">
            <label class="form-label">Topic</label>
            <input type="text" id="entry-topic" class="form-input" value="${escapeHtml(day.topic || '')}">
        </div>
        <div class="form-group">
            <label class="form-label">Reflection Question</label>
            <textarea id="entry-reflection" class="form-textarea" rows="2">${escapeHtml(day.reflection_question || '')}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Prayer Point</label>
            <textarea id="entry-prayer" class="form-textarea" rows="2">${escapeHtml(day.prayer_point || '')}</textarea>
        </div>
        <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" id="entry-date" class="form-input" value="${day.date || ''}">
        </div>
        <button id="save-entry-btn" class="btn btn-primary btn-block mt-3">Save Changes</button>
    `;
    showModal(modalContent);

    $('#save-entry-btn').addEventListener('click', () => {
        const passage = $('#entry-passage').value.trim();
        if (!passage) {
            showToast('Please enter a passage', 'warning');
            return;
        }

        Object.assign(day, {
            passage,
            topic: $('#entry-topic').value.trim() || 'Study',
            reflection_question: $('#entry-reflection').value.trim(),
            prayer_point: $('#entry-prayer').value.trim(),
            date: $('#entry-date').value || day.date
        });

        persistPlannerData();
        closeModal();
        showToast('Entry updated', 'success');
        renderPlannerPage();
    });
}

function deletePlannerDay(index) {
    if (!AppState.currentPlan || !AppState.currentPlan.days[index]) return;

    AppState.currentPlan.days.splice(index, 1);
    recalcPlanProgress();
    persistPlannerData();
    showToast('Entry deleted', 'success');
    renderPlannerPage();
}

function deleteCurrentPlan() {
    if (!AppState.currentPlan) return;
    const planId = AppState.currentPlan.id;

    showModal(`
        <h3 style="margin-bottom: 12px;">Delete this plan?</h3>
        <p style="color: var(--text-slate); margin-bottom: 20px;">This will permanently remove "${escapeHtml(AppState.currentPlan.name || 'this plan')}" and all its entries.</p>
        <div style="display:flex; gap:8px;">
            <button class="btn btn-outline btn-block" onclick="closeModal()">Cancel</button>
            <button class="btn btn-block" style="background:#f44336; color:white;" onclick="confirmDeletePlan('${planId}')">Delete</button>
        </div>
    `);
}

function confirmDeletePlan(planId) {
    AppState.plannerData = AppState.plannerData.filter(p => p.id !== planId);
    AppState.currentPlan = AppState.plannerData[0] || null;

    if (AppState.currentUser) {
        database.ref(`users/${AppState.currentUser.uid}/planner`).set(AppState.plannerData);
    }

    closeModal();
    showToast('Plan deleted', 'success');
    renderPlannerPage();
}

function createNewPlan() {
    const modalContent = `
        <h3 style="margin-bottom: 16px;">Create Study Plan</h3>
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

        recalcPlanProgress();
        persistPlannerData();

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
        navigator.share({ title: 'GraceGuide Reel', text: shareText }).catch(() => {});
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

