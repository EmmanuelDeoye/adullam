/* ============================================
   ADULLAM — js/community.js
   Load AFTER config.js, core.js, and features.js.
   Contains: Reels, Community Groups, public profile
   view/follow/friend/report/block, Direct Messages,
   Profile page, Settings, notifications, event
   listeners, and app initialization/bootstrap.
   ============================================ */

/* ============================================
   COMMUNITY (Groups)
   ============================================ */
async function renderCommunityPage() {
    DOM.pageContainer.innerHTML = `
        <div class="community-container">
            <div class="flex items-center justify-between mb-4">
                <h2 style="font-weight: 700;">Community Groups</h2>
                <button class="btn btn-primary btn-sm" onclick="showCreateGroupModal()">
                    <i class="fas fa-plus"></i> New Group
                </button>
            </div>
            
            <div id="groups-list">
                <div class="skeleton" style="height: 80px; margin-bottom: 12px;"></div>
                <div class="skeleton" style="height: 80px; margin-bottom: 12px;"></div>
            </div>
        </div>
    `;

    await loadCommunityGroups();
}

async function loadCommunityGroups() {
    const container = $('#groups-list');
    if (!container) return;

    try {
        const snapshot = await database.ref('communityGroups').once('value');
        const groups = snapshot.val() || {};
        AppState.communityGroups = Object.values(groups).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        if (AppState.communityGroups.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="fas fa-users"></i></div>
                    <h3 style="margin-bottom: 8px;">No Groups Yet</h3>
                    <p style="color: var(--text-slate);">Start a group to discuss faith, study, and life together.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = AppState.communityGroups.map(group => renderGroupCard(group)).join('');
    } catch (error) {
        console.error('Error loading groups:', error);
        container.innerHTML = `<div class="error-state"><h3>Failed to load groups</h3></div>`;
    }
}

function renderGroupCard(group) {
    const uid = AppState.currentUser?.uid;
    const isMember = uid && group.members && group.members[uid];
    const memberCount = group.members ? Object.keys(group.members).length : 0;

    return `
        <div class="group-card" onclick="openGroup('${group.id}')">
            <div class="group-card-icon"><i class="fas fa-users"></i></div>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 700;">${escapeHtml(group.name)}</div>
                <div style="font-size: 12px; color: var(--text-slate); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(group.description || '')}</div>
                <div style="font-size: 11px; color: var(--text-slate); margin-top: 4px;"><i class="fas fa-user-group"></i> ${memberCount} member${memberCount !== 1 ? 's' : ''}</div>
            </div>
            ${isMember ? '<span class="badge-joined">Joined</span>' : ''}
        </div>
    `;
}

function showCreateGroupModal() {
    const modalContent = `
        <h3 style="margin-bottom: 16px;">Start a Group</h3>
        <div class="form-group">
            <label class="form-label">Group Name</label>
            <input type="text" id="group-name" class="form-input" placeholder="e.g., Young Adults Bible Study">
        </div>
        <div class="form-group">
            <label class="form-label">Description</label>
            <textarea id="group-description" class="form-textarea" rows="3" placeholder="What's this group about?"></textarea>
        </div>
        <button id="submit-group-btn" class="btn btn-primary btn-block mt-3">Create Group</button>
    `;

    showModal(modalContent);

    $('#submit-group-btn').addEventListener('click', async () => {
        if (!requireAuth('Sign in to create a group.')) return;

        const name = $('#group-name').value.trim();
        const description = $('#group-description').value.trim();

        if (!name) {
            showToast('Please enter a group name', 'warning');
            return;
        }

        const group = {
            id: generateId(),
            name,
            description,
            createdBy: AppState.currentUser.uid,
            createdByName: AppState.userProfile?.username || 'Anonymous',
            createdAt: Date.now(),
            members: { [AppState.currentUser.uid]: true }
        };

        try {
            await database.ref(`communityGroups/${group.id}`).set(group);
            await database.ref(`users/${AppState.currentUser.uid}/groups/${group.id}`).set(true);
            closeModal();
            showToast('Group created!', 'success');
            openGroup(group.id);
        } catch (error) {
            showToast('Failed to create group', 'error');
        }
    });
}

function openGroup(groupId) {
    AppState.currentGroupId = groupId;
    navigateTo('group-chat');
}

async function renderGroupChatPage() {
    const groupId = AppState.currentGroupId;
    if (!groupId) {
        navigateTo('community');
        return;
    }

    DOM.pageContainer.innerHTML = `
        <div class="group-chat-container">
            <div class="group-chat-header">
                <button class="icon-btn" onclick="navigateTo('community')"><i class="fas fa-arrow-left"></i></button>
                <div style="flex:1; min-width:0;">
                    <div id="group-chat-title" style="font-weight:700;">Loading…</div>
                    <div id="group-chat-members" style="font-size:12px; color: var(--text-slate);"></div>
                </div>
                <button class="btn btn-outline btn-sm" id="group-join-btn" style="display:none;">Join</button>
            </div>

            <div class="group-chat-messages" id="group-chat-messages">
                <div class="skeleton" style="height: 60px; margin-bottom: 12px;"></div>
            </div>

            <div class="group-chat-input-row">
                <button class="icon-btn" id="group-attach-btn" aria-label="Attach">
                    <i class="fas fa-paperclip"></i>
                </button>
                <input type="text" id="group-message-input" class="chat-input" placeholder="Message the group..." onkeypress="if(event.key === 'Enter') sendGroupMessage()">
                <button class="chat-send-btn" onclick="sendGroupMessage()">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    `;

    $('#group-attach-btn').addEventListener('click', showGroupAttachMenu);

    try {
        const snapshot = await database.ref(`communityGroups/${groupId}`).once('value');
        const group = snapshot.val();
        if (!group) {
            showToast('Group not found', 'error');
            navigateTo('community');
            return;
        }

        if (DOM.topBarTitle) DOM.topBarTitle.textContent = group.name;
        $('#group-chat-title').textContent = group.name;
        const memberCount = group.members ? Object.keys(group.members).length : 0;
        $('#group-chat-members').textContent = `${memberCount} member${memberCount !== 1 ? 's' : ''}`;

        const uid = AppState.currentUser?.uid;
        const isMember = uid && group.members && group.members[uid];
        if (!isMember) {
            $('#group-join-btn').style.display = 'inline-flex';
            $('#group-join-btn').addEventListener('click', () => joinGroup(groupId));
        }

        await loadGroupMessages(groupId);
    } catch (error) {
        console.error('Error loading group:', error);
    }
}

async function joinGroup(groupId) {
    if (!requireAuth('Sign in to join this group.')) return;
    try {
        await database.ref(`communityGroups/${groupId}/members/${AppState.currentUser.uid}`).set(true);
        await database.ref(`users/${AppState.currentUser.uid}/groups/${groupId}`).set(true);
        showToast('Joined group!', 'success');
        renderGroupChatPage();
    } catch (error) {
        showToast('Failed to join group', 'error');
    }
}

async function loadGroupMessages(groupId) {
    const container = $('#group-chat-messages');
    if (!container) return;

    try {
        const snapshot = await database.ref(`communityGroups/${groupId}/messages`).orderByChild('timestamp').limitToLast(100).once('value');
        const messages = snapshot.val() || {};
        const list = Object.values(messages).sort((a, b) => a.timestamp - b.timestamp);

        if (list.length === 0) {
            container.innerHTML = `<p class="text-center text-muted" style="padding: 40px 20px;">No messages yet. Start the conversation!</p>`;
        } else {
            container.innerHTML = list.map(msg => renderGroupMessage(msg)).join('');
        }
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Error loading group messages:', error);
    }
}

function renderGroupMessage(msg) {
    const isMe = msg.senderId === AppState.currentUser?.uid;
    const name = escapeHtml(msg.senderName || 'Anonymous');

    let bodyHTML = '';
    if (msg.type === 'bible') {
        bodyHTML = `
            <div class="group-msg-bible">
                <i class="fas fa-book-bible"></i>
                <div>
                    <div style="font-weight:600;">${escapeHtml(msg.reference || '')}</div>
                    <div style="font-size:13px;">"${escapeHtml(msg.content || '')}"</div>
                </div>
            </div>
        `;
    } else if (msg.type === 'plan') {
        bodyHTML = `
            <div class="group-msg-plan" onclick="navigateTo('planner')">
                <i class="fas fa-calendar-check"></i>
                <div style="font-weight:600;">${escapeHtml(msg.content || 'Shared a reading plan')}</div>
            </div>
        `;
    } else if (msg.type === 'reel') {
        bodyHTML = `
            <div class="group-msg-reel" onclick="navigateTo('reels')">
                <i class="fas fa-play"></i>
                <div style="font-weight:600;">Shared a reel</div>
            </div>
        `;
    } else {
        bodyHTML = `<p>${escapeHtml(msg.content || '')}</p>`;
    }

    return `
        <div class="group-message ${isMe ? 'me' : ''}">
            ${!isMe ? `<div class="group-msg-author" onclick="viewUserProfile('${msg.senderId}', '${name.replace(/'/g, "\\'")}')">${name}</div>` : ''}
            <div class="group-msg-bubble">${bodyHTML}</div>
        </div>
    `;
}

async function sendGroupMessage() {
    if (!requireAuth('Sign in to send messages.')) return;

    const groupId = AppState.currentGroupId;
    const input = $('#group-message-input');
    const content = input?.value.trim();
    if (!content || !groupId) return;

    input.value = '';

    const msg = {
        senderId: AppState.currentUser.uid,
        senderName: AppState.userProfile?.username || 'Anonymous',
        type: 'text',
        content,
        timestamp: Date.now()
    };

    try {
        // Sending a message also makes you a member
        await database.ref(`communityGroups/${groupId}/members/${AppState.currentUser.uid}`).set(true);
        await database.ref(`communityGroups/${groupId}/messages/${generateId()}`).set(msg);
        loadGroupMessages(groupId);
    } catch (error) {
        showToast('Failed to send message', 'error');
    }
}

function showGroupAttachMenu() {
    if (!requireAuth('Sign in to share into this group.')) return;

    const sheetContent = `
        <h3 style="margin-bottom: 12px;">Share to Group</h3>
        <div style="display: grid; gap: 8px;">
            <button class="btn btn-outline btn-block" onclick="closeSheet(); shareVerseToGroup();">
                <i class="fas fa-book-bible"></i> Share Bible Verse
            </button>
            <button class="btn btn-outline btn-block" onclick="closeSheet(); sharePlanToGroup();">
                <i class="fas fa-calendar-check"></i> Share Reading Plan
            </button>
        </div>
    `;
    showSheet(sheetContent);
}

function shareVerseToGroup() {
    const modalContent = `
        <h3 style="margin-bottom: 16px;">Share a Verse</h3>
        <div class="form-group">
            <label class="form-label">Reference</label>
            <input type="text" id="share-verse-ref" class="form-input" placeholder="e.g., John 3:16">
        </div>
        <div class="form-group">
            <label class="form-label">Verse Text</label>
            <textarea id="share-verse-text" class="form-textarea" rows="3" placeholder="Paste or type the verse..."></textarea>
        </div>
        <button id="submit-share-verse-btn" class="btn btn-primary btn-block mt-3">Share</button>
    `;
    showModal(modalContent);

    $('#submit-share-verse-btn').addEventListener('click', async () => {
        const reference = $('#share-verse-ref').value.trim();
        const text = $('#share-verse-text').value.trim();
        if (!reference || !text) {
            showToast('Please fill in both fields', 'warning');
            return;
        }

        const groupId = AppState.currentGroupId;
        const msg = {
            senderId: AppState.currentUser.uid,
            senderName: AppState.userProfile?.username || 'Anonymous',
            type: 'bible',
            reference,
            content: text,
            timestamp: Date.now()
        };

        try {
            await database.ref(`communityGroups/${groupId}/messages/${generateId()}`).set(msg);
            closeModal();
            loadGroupMessages(groupId);
        } catch (error) {
            showToast('Failed to share verse', 'error');
        }
    });
}

function sharePlanToGroup() {
    if (AppState.plannerData.length === 0) {
        showToast('You have no reading plans to share yet', 'warning');
        return;
    }

    const modalContent = `
        <h3 style="margin-bottom: 16px;">Share a Plan</h3>
        <div style="display: grid; gap: 8px;">
            ${AppState.plannerData.map((plan, i) => `
                <button class="btn btn-outline btn-block" onclick="submitSharePlanToGroup(${i})">
                    ${escapeHtml(plan.title || plan.planType || 'Reading Plan')}
                </button>
            `).join('')}
        </div>
    `;
    showModal(modalContent);
}

async function submitSharePlanToGroup(planIndex) {
    const plan = AppState.plannerData[planIndex];
    if (!plan) return;

    const groupId = AppState.currentGroupId;
    const msg = {
        senderId: AppState.currentUser.uid,
        senderName: AppState.userProfile?.username || 'Anonymous',
        type: 'plan',
        content: plan.title || plan.planType || 'Reading Plan',
        timestamp: Date.now()
    };

    try {
        await database.ref(`communityGroups/${groupId}/messages/${generateId()}`).set(msg);
        closeModal();
        loadGroupMessages(groupId);
    } catch (error) {
        showToast('Failed to share plan', 'error');
    }
}

/* ---- Public user profile (view/follow/friend/report) ---- */
async function viewUserProfile(userId, displayName) {
    if (!userId) return;

    if (AppState.currentUser && userId === AppState.currentUser.uid) {
        navigateTo('profile');
        return;
    }

    AppState.viewedProfileId = userId;

    showSheet(`
        <div class="text-center" style="padding: 20px 0;">
            <div class="skeleton" style="width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 12px;"></div>
            <div class="skeleton" style="height: 18px; width: 140px; margin: 0 auto;"></div>
        </div>
    `);

    let profile = { username: displayName || 'User', bio: '' };
    try {
        const snapshot = await database.ref(`users/${userId}/profile`).once('value');
        if (snapshot.exists()) profile = { ...profile, ...snapshot.val() };
    } catch (error) {
        console.error('Error loading profile:', error);
    }

    const isFollowing = AppState.userFollowing.has(userId);
    const isFriend = AppState.userFriends.has(userId);
    const name = escapeHtml(profile.username || displayName || 'User');

    showSheet(`
        <div class="text-center" style="padding: 12px 0 20px;">
            <div class="post-avatar" style="width: 72px; height: 72px; font-size: 28px; margin: 0 auto 12px;">
                ${name[0]?.toUpperCase() || 'U'}
            </div>
            <h3 style="margin-bottom: 4px;">${name}</h3>
            ${profile.bio ? `<p class="text-muted" style="font-size: 14px;">${escapeHtml(profile.bio)}</p>` : ''}
        </div>
        <div style="display: grid; gap: 8px;">
            <button class="btn ${isFollowing ? 'btn-outline' : 'btn-primary'} btn-block" onclick="toggleFollowUser('${userId}')">
                <i class="fas fa-user-plus"></i> ${isFollowing ? 'Following' : 'Follow'}
            </button>
            <button class="btn ${isFriend ? 'btn-outline' : 'btn-secondary'} btn-block" onclick="toggleFriendUser('${userId}', '${name.replace(/'/g, "\\'")}')">
                <i class="fas fa-user-friends"></i> ${isFriend ? 'Friends' : 'Add Friend'}
            </button>
            <button class="btn btn-outline btn-block" onclick="closeSheet(); openConversation('${userId}', '${name.replace(/'/g, "\\'")}');">
                <i class="fas fa-comment-dots"></i> Message
            </button>
            <button class="btn btn-outline btn-block" onclick="reportUser('${userId}', '${name.replace(/'/g, "\\'")}')">
                <i class="fas fa-flag" style="color: #f44336;"></i> Report
            </button>
            <button class="btn btn-outline btn-block" onclick="blockUser('${userId}', '${name.replace(/'/g, "\\'")}')">
                <i class="fas fa-ban" style="color: #f44336;"></i> Block
            </button>
        </div>
    `);
}

async function toggleFollowUser(userId) {
    if (!requireAuth('Sign in to follow others.')) return;

    const uid = AppState.currentUser.uid;
    try {
        if (AppState.userFollowing.has(userId)) {
            await database.ref(`users/${uid}/following/${userId}`).remove();
            AppState.userFollowing.delete(userId);
            showToast('Unfollowed', 'success');
        } else {
            await database.ref(`users/${uid}/following/${userId}`).set(true);
            AppState.userFollowing.add(userId);
            showToast('Now following', 'success');
        }
        viewUserProfile(userId);
    } catch (error) {
        showToast('Something went wrong', 'error');
    }
}

async function toggleFriendUser(userId, displayName) {
    if (!requireAuth('Sign in to add friends.')) return;

    const uid = AppState.currentUser.uid;
    try {
        if (AppState.userFriends.has(userId)) {
            await database.ref(`users/${uid}/friends/${userId}`).remove();
            AppState.userFriends.delete(userId);
            showToast('Removed friend', 'success');
        } else {
            await database.ref(`users/${uid}/friends/${userId}`).set(true);
            AppState.userFriends.add(userId);
            showToast(`Friend request sent to ${displayName}`, 'success');
        }
        viewUserProfile(userId, displayName);
    } catch (error) {
        showToast('Something went wrong', 'error');
    }
}

function reportUser(userId, displayName) {
    showModal(`
        <h3 style="margin-bottom: 16px;">Report ${escapeHtml(displayName)}</h3>
        <textarea id="report-reason-input" class="form-textarea" placeholder="What's happening? (optional details)" rows="3"></textarea>
        <div style="display: flex; gap: 8px; margin-top: 16px;">
            <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn btn-accent" onclick="submitUserReport('${userId}')">Submit Report</button>
        </div>
    `);
}

async function submitUserReport(userId) {
    const reason = $('#report-reason-input')?.value.trim() || '';
    try {
        await database.ref(`reports/${generateId()}`).set({
            reportedUserId: userId,
            reportedBy: AppState.currentUser?.uid || null,
            reason,
            timestamp: Date.now()
        });
        closeModal();
        closeSheet();
        showToast('Report submitted. Thank you.', 'success');
    } catch (error) {
        showToast('Failed to submit report', 'error');
    }
}

function blockUser(userId, displayName) {
    showModal(`
        <h3 style="margin-bottom: 16px;">Block ${escapeHtml(displayName)}</h3>
        <p>You won't see their posts or comments anymore.</p>
        <div style="display: flex; gap: 8px; margin-top: 16px;">
            <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn btn-accent" onclick="confirmBlockUser('${userId}')">Block</button>
        </div>
    `);
}

async function confirmBlockUser(userId) {
    if (!AppState.currentUser) return;
    try {
        await database.ref(`users/${AppState.currentUser.uid}/blocked/${userId}`).set(true);
        closeModal();
        closeSheet();
        showToast('User blocked', 'success');
        loadReels();
    } catch (error) {
        showToast('Failed to block user', 'error');
    }
}

/* ============================================
   MESSAGES (Direct Messages)
   ============================================ */
function getDMConversationId(uidA, uidB) {
    return [uidA, uidB].sort().join('_');
}

function renderMessagesPage() {
    if (!AppState.currentUser) {
        DOM.pageContainer.innerHTML = `
            <div class="text-center" style="padding: 60px 24px;">
                <div class="empty-state-icon" style="margin: 0 auto 16px;"><i class="fas fa-envelope"></i></div>
                <h3 style="margin-bottom: 8px;">Sign in to view messages</h3>
                <p class="text-muted" style="margin-bottom: 24px;">Connect and chat with others in the community.</p>
                <button class="btn btn-primary" onclick="showAuthModal({message: 'Sign in to view your messages.'})">
                    <i class="fas fa-right-to-bracket"></i> Sign In
                </button>
            </div>
        `;
        return;
    }

    DOM.pageContainer.innerHTML = `
        <div class="planner-container">
            <h2 style="font-weight: 700; margin-bottom: 16px;">Messages</h2>
            <div id="dm-conversations-list">
                <div class="skeleton" style="height: 64px; margin-bottom: 12px;"></div>
                <div class="skeleton" style="height: 64px; margin-bottom: 12px;"></div>
            </div>
        </div>
    `;

    loadDMConversations();
}

async function loadDMConversations() {
    const container = $('#dm-conversations-list');
    if (!container || !AppState.currentUser) return;

    try {
        const snapshot = await database.ref(`users/${AppState.currentUser.uid}/dmIndex`).once('value');
        const data = snapshot.val() || {};
        const list = Object.entries(data)
            .map(([otherUid, info]) => ({ otherUid, ...info }))
            .sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));

        AppState.dmConversations = list;

        if (list.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="fas fa-envelope"></i></div>
                    <h3 style="margin-bottom: 8px;">No Messages Yet</h3>
                    <p style="color: var(--text-slate);">Visit someone's profile and tap Message to start a conversation.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = list.map(conv => `
            <div class="conversation-item" onclick="openConversation('${conv.otherUid}', '${(conv.otherUserName || 'User').replace(/'/g, "\\'")}')">
                <div class="post-avatar comment-avatar" style="width:44px;height:44px;">
                    ${(conv.otherUserName || 'U')[0]?.toUpperCase() || 'U'}
                </div>
                <div class="conversation-item-main">
                    <div style="font-weight: 600;">${escapeHtml(conv.otherUserName || 'User')}</div>
                    <div style="font-size: 12px; color: var(--text-slate); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(conv.lastMessage || '')}</div>
                </div>
                <div style="font-size: 11px; color: var(--text-slate);">${conv.lastTimestamp ? formatDate(conv.lastTimestamp) : ''}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading conversations:', error);
    }
}

function openConversation(otherUid, otherUserName) {
    if (!requireAuth('Sign in to send messages.', () => openConversation(otherUid, otherUserName))) return;

    AppState.currentDMUserId = otherUid;
    AppState.currentDMUserName = otherUserName;
    navigateTo('dm-thread');
}

async function renderDMThreadPage() {
    const otherUid = AppState.currentDMUserId;
    if (!otherUid || !AppState.currentUser) {
        navigateTo('messages');
        return;
    }

    DOM.pageContainer.innerHTML = `
        <div class="group-chat-container">
            <div class="group-chat-header">
                <button class="icon-btn" onclick="navigateTo('messages')"><i class="fas fa-arrow-left"></i></button>
                <div style="flex:1; min-width:0; cursor:pointer;" onclick="viewUserProfile('${otherUid}', '${(AppState.currentDMUserName || 'User').replace(/'/g, "\\'")}')">
                    <div style="font-weight:700;">${escapeHtml(AppState.currentDMUserName || 'User')}</div>
                </div>
            </div>

            <div class="group-chat-messages" id="dm-messages">
                <div class="skeleton" style="height: 60px; margin-bottom: 12px;"></div>
            </div>

            <div class="group-chat-input-row">
                <input type="text" id="dm-message-input" class="chat-input" placeholder="Message..." onkeypress="if(event.key === 'Enter') sendDirectMessage()">
                <button class="chat-send-btn" onclick="sendDirectMessage()">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    `;

    if (DOM.topBarTitle) DOM.topBarTitle.textContent = AppState.currentDMUserName || 'Messages';

    await loadDMMessages();
}

async function loadDMMessages() {
    const container = $('#dm-messages');
    const uid = AppState.currentUser?.uid;
    const otherUid = AppState.currentDMUserId;
    if (!container || !uid || !otherUid) return;

    const conversationId = getDMConversationId(uid, otherUid);

    try {
        const snapshot = await database.ref(`dmConversations/${conversationId}/messages`).orderByChild('timestamp').limitToLast(200).once('value');
        const messages = snapshot.val() || {};
        const list = Object.values(messages).sort((a, b) => a.timestamp - b.timestamp);

        if (list.length === 0) {
            container.innerHTML = `<p class="text-center text-muted" style="padding: 40px 20px;">Say hello 👋</p>`;
        } else {
            container.innerHTML = list.map(msg => `
                <div class="group-message ${msg.senderId === uid ? 'me' : ''}">
                    <div class="group-msg-bubble"><p>${escapeHtml(msg.content || '')}</p></div>
                </div>
            `).join('');
        }
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.error('Error loading DM messages:', error);
    }
}

async function sendDirectMessage() {
    if (!requireAuth('Sign in to send messages.')) return;

    const input = $('#dm-message-input');
    const content = input?.value.trim();
    const otherUid = AppState.currentDMUserId;
    if (!content || !otherUid) return;

    input.value = '';

    const uid = AppState.currentUser.uid;
    const conversationId = getDMConversationId(uid, otherUid);
    const myName = AppState.userProfile?.username || 'Anonymous';

    const msg = {
        senderId: uid,
        senderName: myName,
        content,
        timestamp: Date.now()
    };

    try {
        await database.ref(`dmConversations/${conversationId}/messages/${generateId()}`).set(msg);
        await database.ref(`dmConversations/${conversationId}/participants`).update({ [uid]: true, [otherUid]: true });

        await database.ref(`users/${uid}/dmIndex/${otherUid}`).update({
            otherUserName: AppState.currentDMUserName || 'User',
            lastMessage: content,
            lastTimestamp: Date.now(),
            conversationId
        });

        await database.ref(`users/${otherUid}/dmIndex/${uid}`).update({
            otherUserName: myName,
            lastMessage: content,
            lastTimestamp: Date.now(),
            conversationId
        });

        loadDMMessages();
    } catch (error) {
        showToast('Failed to send message', 'error');
        console.error(error);
    }
}

/* ============================================
   PROFILE PAGE
   ============================================ */
function renderProfilePage() {
    if (!AppState.currentUser) {
        DOM.pageContainer.innerHTML = `
            <div class="text-center" style="padding: 60px 24px;">
                <div class="empty-state-icon" style="margin: 0 auto 16px;">
                    <i class="fas fa-user"></i>
                </div>
                <h3 style="margin-bottom: 8px;">You're browsing as a guest</h3>
                <p class="text-muted" style="margin-bottom: 24px;">Sign in to set up your profile, save your progress, and connect with others.</p>
                <button class="btn btn-primary" onclick="showAuthModal({message: 'Sign in to set up your profile.'})">
                    <i class="fas fa-right-to-bracket"></i> Sign In / Create Account
                </button>
            </div>
        `;
        return;
    }
    
    const profile = AppState.userProfile || {};
    
    DOM.pageContainer.innerHTML = `
        <div class="profile-container">
            <div class="profile-header">
                <div class="profile-avatar" style="position: relative; cursor: pointer;" onclick="triggerAvatarUpload()">
                    ${profile.avatar ? `<img src="${profile.avatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : (profile.username?.[0]?.toUpperCase() || 'U')}
                    <div class="avatar-edit-badge"><i class="fas fa-camera"></i></div>
                </div>
                <button class="btn btn-sm btn-outline mt-2" onclick="triggerAvatarUpload()">
                    <i class="fas fa-camera"></i> Change Photo
                </button>
                <h2 style="font-weight: 700; margin-top: 8px;">${escapeHtml(profile.username || 'User')}</h2>
                <p style="color: var(--text-slate);">${escapeHtml(profile.bio || 'No bio yet')}</p>
                
                <div class="profile-stats">
                    <div class="profile-stat">
                        <div class="profile-stat-value">${AppState.bookmarks.length || 0}</div>
                        <div class="profile-stat-label">Bookmarks</div>
                    </div>
                    <div class="profile-stat">
                        <div class="profile-stat-value">${AppState.notes.length || 0}</div>
                        <div class="profile-stat-label">Notes</div>
                    </div>
                    <div class="profile-stat">
                        <div class="profile-stat-value">${AppState.readingHistory.length || 0}</div>
                        <div class="profile-stat-label">Chapters</div>
                    </div>
                </div>
            </div>
            
            <div class="flex gap-2 mb-4" style="justify-content: center;">
                <button class="btn btn-outline btn-sm" onclick="editProfile()">
                    <i class="fas fa-edit"></i> Edit Profile
                </button>
                <button class="btn btn-outline btn-sm" onclick="showUserBible()">
                    <i class="fas fa-book-bible"></i> My Bible
                </button>
            </div>
            
            <div class="card mb-3">
                <h3 style="font-weight: 600; margin-bottom: 16px;">Recent Activity</h3>
                ${AppState.readingHistory.length > 0 ? `
                    ${AppState.readingHistory.slice(-5).reverse().map(entry => `
                        <div class="flex items-center justify-between p-2" style="border-bottom: 1px solid rgba(0,0,0,0.06);">
                            <span>${entry.book} ${entry.chapter}</span>
                            <span style="font-size: 12px; color: var(--text-slate);">${formatDate(entry.timestamp)}</span>
                        </div>
                    `).join('')}
                ` : `
                    <p class="text-center text-muted">No reading activity yet</p>
                `}
            </div>
            
            <div class="card">
                <h3 style="font-weight: 600; margin-bottom: 16px;">My Bookmarks</h3>
                ${AppState.bookmarks.length > 0 ? `
                    ${AppState.bookmarks.slice(-5).reverse().map(bookmark => `
                        <div class="p-2" style="border-bottom: 1px solid rgba(0,0,0,0.06); cursor: pointer;" onclick="openBookmark('${bookmark.reference}')">
                            <div style="font-weight: 600;">${escapeHtml(bookmark.reference)}</div>
                            ${bookmark.text ? `<div style="font-size: 12px; color: var(--text-slate);">${truncate(escapeHtml(bookmark.text), 80)}</div>` : ''}
                        </div>
                    `).join('')}
                ` : `
                    <p class="text-center text-muted">No bookmarks yet</p>
                `}
            </div>
        </div>
    `;
}

function editProfile() {
    const profile = AppState.userProfile || {};
    
    const modalContent = `
        <h3 style="margin-bottom: 16px;">Edit Profile</h3>
        
        <div class="form-group">
            <label class="form-label">Username</label>
            <input type="text" id="edit-username" class="form-input" value="${escapeHtml(profile.username || '')}">
        </div>
        
        <div class="form-group">
            <label class="form-label">Bio</label>
            <textarea id="edit-bio" class="form-textarea" rows="3">${escapeHtml(profile.bio || '')}</textarea>
        </div>
        
        <button id="save-profile-btn" class="btn btn-primary btn-block mt-3">Save Changes</button>
    `;
    
    showModal(modalContent);
    
    $('#save-profile-btn').addEventListener('click', async () => {
        const username = $('#edit-username').value.trim();
        const bio = $('#edit-bio').value.trim();
        
        if (!username) {
            showToast('Username is required', 'warning');
            return;
        }
        
        if (!AppState.currentUser) return;
        
        try {
            await database.ref(`users/${AppState.currentUser.uid}/profile`).update({
                username,
                bio
            });
            
            AppState.userProfile = {
                ...AppState.userProfile,
                username,
                bio
            };
            
            closeModal();
            showToast('Profile updated!', 'success');
            updateProfileNavIcon();
            renderProfilePage();
        } catch (error) {
            showToast('Failed to update profile', 'error');
        }
    });
}

/* ---- Profile photo upload ---- */
function triggerAvatarUpload() {
    if (!requireAuth('Sign in to upload a profile photo.', triggerAvatarUpload)) return;

    let fileInput = document.getElementById('avatar-file-input');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.id = 'avatar-file-input';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        fileInput.addEventListener('change', handleAvatarFileSelected);
    }
    fileInput.value = '';
    fileInput.click();
}

async function handleAvatarFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'warning');
        return;
    }

    showToast('Uploading photo…', 'success');

    try {
        const resizedBlob = await resizeImageFile(file, 320);
        const uid = AppState.currentUser.uid;
        const storageRef = storage.ref(`avatars/${uid}.jpg`);
        await storageRef.put(resizedBlob);
        const url = await storageRef.getDownloadURL();

        await database.ref(`users/${uid}/profile/avatar`).set(url);
        AppState.userProfile = { ...AppState.userProfile, avatar: url };

        updateProfileNavIcon();
        renderProfilePage();
        showToast('Profile photo updated!', 'success');
    } catch (error) {
        console.error('Avatar upload error:', error);
        showToast('Failed to upload photo', 'error');
    }
}

function resizeImageFile(file, maxSize) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
            img.onload = () => {
                let { width, height } = img;
                if (width > height && width > maxSize) {
                    height = Math.round(height * (maxSize / width));
                    width = maxSize;
                } else if (height >= width && height > maxSize) {
                    width = Math.round(width * (maxSize / height));
                    height = maxSize;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob); else reject(new Error('Canvas toBlob failed'));
                }, 'image/jpeg', 0.85);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function showUserBible() {
    navigateTo('bible');
}

function openBookmark(reference) {
    // Parse reference to open Bible
    const parts = reference.split(' ');
    if (parts.length >= 2) {
        const book = parts.slice(0, -1).join(' ');
        const chapter = parseInt(parts[parts.length - 1].split(':')[0]);
        openBibleChapter(book, chapter);
    }
}

/* ============================================
   SETTINGS PAGE
   ============================================ */
function renderSettingsPage() {
    DOM.pageContainer.innerHTML = `
        <div class="planner-container">
            <h2 style="font-weight: 700; margin-bottom: 24px;">Settings</h2>
            
            <div class="card mb-3">
                <h3 style="font-weight: 600; margin-bottom: 16px;">Appearance</h3>
                
                <div class="flex items-center justify-between p-2" style="border-bottom: 1px solid rgba(0,0,0,0.06);">
                    <div>
                        <div style="font-weight: 600;">Dark Mode</div>
                        <div style="font-size: 12px; color: var(--text-slate);">Switch between light and dark theme</div>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="toggleTheme()">
                        ${AppState.currentTheme === 'dark' ? '<i class="fas fa-sun"></i> Light' : '<i class="fas fa-moon"></i> Dark'}
                    </button>
                </div>
                
                <div class="flex items-center justify-between p-2" style="border-bottom: 1px solid rgba(0,0,0,0.06);">
                    <div>
                        <div style="font-weight: 600;">Bible Font Size</div>
                        <div style="font-size: 12px; color: var(--text-slate);">Adjust reading font size</div>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="showFontSizeOptions()">
                        <i class="fas fa-font"></i> Font
                    </button>
                </div>
            </div>
            
            <div class="card mb-3">
                <h3 style="font-weight: 600; margin-bottom: 16px;">Notifications</h3>
                
                <div class="flex items-center justify-between p-2" style="border-bottom: 1px solid rgba(0,0,0,0.06);">
                    <div>
                        <div style="font-weight: 600;">Daily Verse</div>
                        <div style="font-size: 12px; color: var(--text-slate);">Receive daily verse notification</div>
                    </div>
                    <input type="checkbox" id="notif-daily-verse" checked style="width: 20px; height: 20px;">
                </div>
                
                <div class="flex items-center justify-between p-2">
                    <div>
                        <div style="font-weight: 600;">Community Alerts</div>
                        <div style="font-size: 12px; color: var(--text-slate);">Get notified about community activity</div>
                    </div>
                    <input type="checkbox" id="notif-community" checked style="width: 20px; height: 20px;">
                </div>
            </div>
            
            <div class="card mb-3">
                <h3 style="font-weight: 600; margin-bottom: 16px;">About</h3>
                <p style="line-height: 1.6; margin-bottom: 8px;">ADULLAM v1.0.0</p>
                <p style="font-size: 12px; color: var(--text-slate);">Your AI Christian Companion</p>
            </div>
            
            <div class="card">
                <h3 style="font-weight: 600; margin-bottom: 16px;">Account</h3>
                <button class="btn btn-accent btn-block" onclick="handleLogout()">
                    <i class="fas fa-sign-out-alt"></i> Sign Out
                </button>
            </div>
        </div>
    `;
}

/* ============================================
   NOTIFICATIONS
   ============================================ */
async function loadNotifications() {
    if (!AppState.currentUser) return;
    
    try {
        const uid = AppState.currentUser.uid;
        const snapshot = await database.ref(`users/${uid}/notifications`).once('value');
        AppState.notifications = snapshot.val() || [];
        
        updateNotificationBadge();
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function updateNotificationBadge() {
    const unreadCount = AppState.notifications.filter(n => !n.read).length;
    if (unreadCount > 0) {
        DOM.notifBadge.classList.remove('hidden');
        DOM.notifBadge.textContent = unreadCount;
    } else {
        DOM.notifBadge.classList.add('hidden');
    }
}

async function addNotification(userId, notification) {
    try {
        await database.ref(`users/${userId}/notifications`).push({
            ...notification,
            read: false,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Error adding notification:', error);
    }
}

/* ============================================
   EVENT LISTENERS
   ============================================ */
function initEventListeners() {
    // Theme toggle
    DOM.themeToggle.addEventListener('click', toggleTheme);
    
    // Menu
    DOM.menuBtn.addEventListener('click', openDrawer);
    DOM.drawerClose.addEventListener('click', () => closeDrawer());
    DOM.drawerOverlay.addEventListener('click', () => closeDrawer());
    
    // Drawer navigation
    $$('.drawer-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const route = link.dataset.route;
            navigateTo(route);
        });
    });
    
    // Bottom navigation
    $$('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const route = item.dataset.route;
            navigateTo(route);
        });
    });
    
    // Logout
    DOM.drawerLogout.addEventListener('click', handleLogout);
    
    // Notifications
    DOM.notifBtn.addEventListener('click', () => {
        showNotificationPanel();
    });

    // Profile / avatar button in top bar
    DOM.profileNavBtn.addEventListener('click', handleProfileNavClick);
    
    // Handle back/forward navigation. Closing overlays and navigating
    // between routes both consume a history entry, so the hardware/browser
    // back button steps through the app instead of exiting it.
    window.addEventListener('popstate', (e) => {
        const state = e.state || {};

        // A modal/sheet/drawer was just closed via its own UI (X button,
        // backdrop click, etc.) and called history.back() purely to keep
        // the URL/history stack tidy. That should never re-render the
        // current page — it would wipe out scroll position, form input,
        // reel playback position, and any other in-progress UI state.
        if (AppState.suppressNextPopstateNav) {
            AppState.suppressNextPopstateNav = false;
            if (AppState.modalOpen) closeModal(true);
            if (AppState.sheetOpen) closeSheet(true);
            if (AppState.drawerOpen) closeDrawer(true);
            return;
        }

        if (AppState.modalOpen) {
            closeModal(true);
            return;
        }
        if (AppState.sheetOpen) {
            closeSheet(true);
            return;
        }
        if (AppState.drawerOpen) {
            closeDrawer(true);
            return;
        }

        if (!authReady) return;

        const route = state.route || (window.location.hash.replace('#/', '') || 'home');
        navigateTo(route, { fromPopstate: true });
    });
    
    // Online/offline
    window.addEventListener('online', () => {
        AppState.isOnline = true;
        showToast('Back online', 'success');
    });
    
    window.addEventListener('offline', () => {
        AppState.isOnline = false;
        showToast('You are offline', 'warning');
    });
}

function showNotificationPanel() {
    if (!requireAuth('Sign in to view notifications.')) return;
    
    const sheetContent = `
        <h3 style="margin-bottom: 16px;">Notifications</h3>
        ${AppState.notifications.length > 0 ? `
            ${AppState.notifications.slice(-10).reverse().map(notif => `
                <div class="p-2" style="border-bottom: 1px solid rgba(0,0,0,0.06);">
                    <div style="font-weight: ${notif.read ? '400' : '600'};">${escapeHtml(notif.message)}</div>
                    <div style="font-size: 12px; color: var(--text-slate);">${formatDate(notif.timestamp)}</div>
                </div>
            `).join('')}
        ` : `
            <p class="text-center text-muted">No notifications</p>
        `}
    `;
    
    showSheet(sheetContent);
    
    // Mark all as read
    if (AppState.currentUser && AppState.notifications.length > 0) {
        const uid = AppState.currentUser.uid;
        database.ref(`users/${uid}/notifications`).once('value')
            .then(snapshot => {
                const notifications = snapshot.val();
                if (notifications) {
                    Object.keys(notifications).forEach(key => {
                        notifications[key].read = true;
                    });
                    database.ref(`users/${uid}/notifications`).set(notifications);
                    AppState.notifications = Object.values(notifications);
                    updateNotificationBadge();
                }
            });
    }
}

/* ============================================
   INITIALIZATION
   ============================================ */
async function initApp() {
    console.log('🚀 Initializing ADULLAM...');
    
    // Initialize theme
    initTheme();

    // Initialize text-to-speech voices for Shepherd's replies
    initVoices();
    
    // Initialize event listeners
    initEventListeners();
    
    // Initialize authentication
    initAuth();
    
    // Initial route
    const initialRoute = window.location.hash.replace('#/', '') || 'home';
    
    console.log('✅ ADULLAM initialized successfully');
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);

// Export functions for use in HTML onclick attributes
window.navigateTo = navigateTo;
window.toggleVerseSelection = toggleVerseSelection;
window.sendChatMessage = sendChatMessage;
window.toggleSpeakMessage = toggleSpeakMessage;
window.showVoicePickerSheet = showVoicePickerSheet;
window.selectVoice = selectVoice;
window.previewVoice = previewVoice;
window.discussReflectionWithShepherd = discussReflectionWithShepherd;
window.askSuggestedQuestion = askSuggestedQuestion;
window.showFontSizeOptions = showFontSizeOptions;
window.setBibleFontSize = setBibleFontSize;
window.shareVerse = shareVerse;
window.saveVerse = saveVerse;
window.openBibleChapter = openBibleChapter;
window.showAuthModal = showAuthModal;
window.requireAuth = requireAuth;
window.handleProfileNavClick = handleProfileNavClick;
window.triggerAvatarUpload = triggerAvatarUpload;
window.postSelectedVersesAsReel = postSelectedVersesAsReel;
window.showCreateReelModal = showCreateReelModal;
window.loveReel = loveReel;
window.showReelComments = showReelComments;
window.submitReelComment = submitReelComment;
window.shareReel = shareReel;
window.submitShareReelToGroup = submitShareReelToGroup;
window.deleteReel = deleteReel;
window.confirmDeleteReel = confirmDeleteReel;
window.showCreateGroupModal = showCreateGroupModal;
window.openGroup = openGroup;
window.joinGroup = joinGroup;
window.sendGroupMessage = sendGroupMessage;
window.showGroupAttachMenu = showGroupAttachMenu;
window.shareVerseToGroup = shareVerseToGroup;
window.sharePlanToGroup = sharePlanToGroup;
window.submitSharePlanToGroup = submitSharePlanToGroup;
window.viewUserProfile = viewUserProfile;
window.toggleFollowUser = toggleFollowUser;
window.toggleFriendUser = toggleFriendUser;
window.reportUser = reportUser;
window.submitUserReport = submitUserReport;
window.blockUser = blockUser;
window.confirmBlockUser = confirmBlockUser;
window.openConversation = openConversation;
window.sendDirectMessage = sendDirectMessage;
window.executeAIAction = executeAIAction;
window.startNewConversation = startNewConversation;
window.loadConversation = loadConversation;
window.showConversationHistory = showConversationHistory;
window.renameConversation = renameConversation;
window.deleteConversation = deleteConversation;
window.confirmDeleteConversation = confirmDeleteConversation;
window.createNewPlan = createNewPlan;
window.togglePlannerDay = togglePlannerDay;
window.editProfile = editProfile;
window.showUserBible = showUserBible;
window.openBookmark = openBookmark;
window.highlightSelectedVerses = highlightSelectedVerses;
window.bookmarkSelectedVerses = bookmarkSelectedVerses;
window.addNoteToSelectedVerses = addNoteToSelectedVerses;
window.shareSelectedVerses = shareSelectedVerses;
window.askAIAboutSelectedVerses = askAIAboutSelectedVerses;
window.toggleTheme = toggleTheme;
window.closeModal = closeModal;
window.closeSheet = closeSheet;
window.handleLogout = handleLogout;
