/* ============================================
   ADULLAM — js/core.js
   Load AFTER config.js.
   Contains: app state, DOM refs, utilities, theme,
   authentication, routing, home page, Bible reader.
   ============================================ */

/* ============================================
   APPLICATION STATE
   ============================================ */
const AppState = {
    currentUser: null,
    userProfile: null,
    currentRoute: 'home',
    currentTheme: 'light',
    bibleVersion: 'KJV',
    currentChapter: null,
    currentBook: null,
    selectedVerses: new Set(),
    plannerData: [],
    notifications: [],
    unreadMessages: 0,
    aiChatHistory: [],
    moderationQueue: [],
    cachedBibleVersions: ['KJV', 'NKJV', 'NLT', 'GOODNEWS', 'AMP'],
    isOnline: navigator.onLine,
    isLoading: false,
    currentPlan: null,
    readingHistory: [],
    bookmarks: [],
    highlights: [],
    notes: [],
    communityPosts: [],
    userFollowing: new Set(),
    userFollowers: new Set(),
    userFriends: new Set(),
    eventData: [],
    modalOpen: false,
    sheetOpen: false,
    drawerOpen: false,
    aiConversations: [],
    currentConversationId: null,
    viewedProfileId: null,
    todayReflection: '',
    reels: [],
    communityGroups: [],
    currentGroupId: null,
    dmConversations: [],
    currentDMUserId: null,
    currentDMUserName: null
};

/* ============================================
   DOM ELEMENTS
   ============================================ */
const DOM = {
    splashScreen: document.getElementById('splash-screen'),
    mainContent: document.getElementById('main-content'),
    pageContainer: document.getElementById('page-container'),
    topBarTitle: document.getElementById('top-bar-title'),
    bottomNav: document.getElementById('bottom-nav'),
    drawer: document.getElementById('side-drawer'),
    drawerOverlay: document.getElementById('drawer-overlay'),
    toastContainer: document.getElementById('toast-container'),
    modalContainer: document.getElementById('modal-container'),
    sheetContainer: document.getElementById('sheet-container'),
    notifBadge: document.getElementById('notif-badge'),
    themeToggle: document.getElementById('theme-toggle'),
    menuBtn: document.getElementById('menu-btn'),
    drawerClose: document.getElementById('drawer-close'),
    drawerLogout: document.getElementById('drawer-logout'),
    notifBtn: document.getElementById('notif-btn'),
    profileNavBtn: document.getElementById('profile-nav-btn'),
    profileNavAvatar: document.getElementById('profile-nav-avatar')
};

/* ============================================
   UTILITY FUNCTIONS
   ============================================ */
function $(selector, parent = document) {
    return parent.querySelector(selector);
}

function $$(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function generateId() {
    return `adl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });
}

function truncate(text, length = 100) {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
        <span>${escapeHtml(message)}</span>
    `;
    DOM.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showModal(content, options = {}) {
    // Close any open sheet first to avoid stacked overlays
    if (AppState.sheetOpen) closeSheet();

    const modal = document.createElement('div');
    modal.className = 'modal-container';
    modal.innerHTML = `
        <div class="modal-content">
            ${content}
        </div>
    `;

    if (options.closeOnOverlay !== false) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    DOM.modalContainer.innerHTML = '';
    DOM.modalContainer.appendChild(modal);
    DOM.modalContainer.classList.remove('hidden');

    if (!AppState.modalOpen) {
        history.pushState({ overlay: 'modal' }, '');
    }
    AppState.modalOpen = true;

    return modal;
}

function closeModal(fromPopstate = false) {
    DOM.modalContainer.innerHTML = '';
    DOM.modalContainer.classList.add('hidden');

    const wasOpen = AppState.modalOpen;
    AppState.modalOpen = false;

    if (wasOpen && !fromPopstate && history.state && history.state.overlay === 'modal') {
        history.back();
    }
}

function showSheet(content, options = {}) {
    // Close any open modal first to avoid stacked overlays
    if (AppState.modalOpen) closeModal();

    const sheet = document.createElement('div');
    sheet.className = 'sheet-container';
    sheet.innerHTML = `
        <div class="sheet-backdrop"></div>
        <div class="sheet-content">
            <div class="sheet-handle"></div>
            ${content}
        </div>
    `;

    if (options.closeOnOverlay !== false) {
        sheet.querySelector('.sheet-backdrop').addEventListener('click', () => closeSheet());
    }

    DOM.sheetContainer.innerHTML = '';
    DOM.sheetContainer.appendChild(sheet);
    DOM.sheetContainer.classList.remove('hidden');

    if (!AppState.sheetOpen) {
        history.pushState({ overlay: 'sheet' }, '');
    }
    AppState.sheetOpen = true;

    return sheet;
}

function closeSheet(fromPopstate = false) {
    DOM.sheetContainer.innerHTML = '';
    DOM.sheetContainer.classList.add('hidden');

    const wasOpen = AppState.sheetOpen;
    AppState.sheetOpen = false;

    if (wasOpen && !fromPopstate && history.state && history.state.overlay === 'sheet') {
        history.back();
    }
}

function setLoading(isLoading) {
    AppState.isLoading = isLoading;
    if (isLoading) {
        document.body.style.cursor = 'wait';
    } else {
        document.body.style.cursor = 'default';
    }
}

/* ============================================
   THEME MANAGEMENT
   ============================================ */
function initTheme() {
    const savedTheme = localStorage.getItem('adullam_theme') || 'light';
    AppState.currentTheme = savedTheme;
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    AppState.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('adullam_theme', theme);
    
    const icon = DOM.themeToggle.querySelector('i');
    if (theme === 'dark') {
        icon.className = 'fas fa-sun';
    } else {
        icon.className = 'fas fa-moon';
    }
}

function toggleTheme() {
    const newTheme = AppState.currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    showToast(`Theme switched to ${newTheme} mode`, 'success');
}

/* ============================================
   AUTHENTICATION
   ============================================ */
let authReady = false;

function initAuth() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            AppState.currentUser = user;
            await loadUserProfile(user.uid);
            await loadUserData();
        } else {
            AppState.currentUser = null;
            AppState.userProfile = null;
            AppState.bookmarks = [];
            AppState.highlights = [];
            AppState.notes = [];
            AppState.readingHistory = [];
            AppState.plannerData = [];
            AppState.userFollowing = new Set();
            AppState.userFriends = new Set();
            AppState.aiConversations = [];
        }

        updateProfileNavIcon();

        if (!authReady) {
            // First auth check on load — the app is usable immediately,
            // signed in or not (guest mode).
            authReady = true;
            showMainApp();
            navigateTo('home', { replace: true });
        } else {
            // Auth state changed mid-session (user signed in/out from the
            // modal) — refresh whatever page is currently showing.
            navigateTo(AppState.currentRoute, { replace: true });
        }
    });
}

async function loadUserProfile(uid) {
    try {
        const snapshot = await database.ref(`users/${uid}/profile`).once('value');
        AppState.userProfile = snapshot.val() || {
            username: AppState.currentUser.email?.split('@')[0] || 'User',
            bio: '',
            avatar: '',
            createdAt: Date.now()
        };
    } catch (error) {
        console.error('Error loading user profile:', error);
        AppState.userProfile = {
            username: 'User',
            bio: '',
            avatar: ''
        };
    }
}

async function loadUserData() {
    if (!AppState.currentUser) return;
    const uid = AppState.currentUser.uid;
    
    try {
        // Load bookmarks, highlights, notes, reading history
        const [bookmarksSnap, highlightsSnap, notesSnap, historySnap, plannerSnap, followingSnap, friendsSnap] = await Promise.all([
            database.ref(`users/${uid}/bookmarks`).once('value'),
            database.ref(`users/${uid}/highlights`).once('value'),
            database.ref(`users/${uid}/notes`).once('value'),
            database.ref(`users/${uid}/readingHistory`).once('value'),
            database.ref(`users/${uid}/planner`).once('value'),
            database.ref(`users/${uid}/following`).once('value'),
            database.ref(`users/${uid}/friends`).once('value')
        ]);
        
        AppState.bookmarks = bookmarksSnap.val() || [];
        AppState.highlights = highlightsSnap.val() || [];
        AppState.notes = notesSnap.val() || [];
        AppState.readingHistory = historySnap.val() || [];
        AppState.plannerData = plannerSnap.val() || [];
        AppState.userFollowing = new Set(Object.keys(followingSnap.val() || {}));
        AppState.userFriends = new Set(Object.keys(friendsSnap.val() || {}));
    } catch (error) {
        console.error('Error loading user data:', error);
    }
    
    // Load notifications
    loadNotifications();
}

function showMainApp() {
    DOM.splashScreen.classList.add('hidden');
    DOM.mainContent.classList.remove('hidden');

    const topBarEl = document.getElementById('top-bar');
    if (topBarEl) topBarEl.style.display = 'flex';
    DOM.bottomNav.style.display = 'flex';
    DOM.drawer.style.display = 'flex';
}

/**
 * Gate an action behind sign-in without forcing a full-page login.
 * Guests can use the whole app; this only pops a modal at the moment
 * something needs to be saved to their account. Returns true if the
 * user is already signed in (so the caller can proceed immediately).
 */
function requireAuth(message, onAuthenticated) {
    if (AppState.currentUser) {
        if (onAuthenticated) onAuthenticated();
        return true;
    }
    showAuthModal({ message, onSuccess: onAuthenticated });
    return false;
}

function showAuthModal(options = {}) {
    const { message, onSuccess } = options;

    const authHTML = `
        <div class="auth-modal">
            <div class="auth-modal-icon">
                <i class="fas fa-dove"></i>
            </div>
            <h2 class="auth-title">Welcome to ADULLAM</h2>
            <p class="auth-subtitle">${message ? escapeHtml(message) : 'Your AI Christian Companion'}</p>
            
            <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" id="auth-email" class="form-input" placeholder="Enter your email">
            </div>
            
            <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" id="auth-password" class="form-input" placeholder="Enter your password">
            </div>
            
            <div class="form-group" id="auth-username-group" style="display: none;">
                <label class="form-label">Username</label>
                <input type="text" id="auth-username" class="form-input" placeholder="Choose a username">
            </div>
            
            <button id="auth-submit" class="btn btn-primary btn-block btn-lg mt-3">
                <span class="auth-submit-label">Sign In</span>
            </button>
            
            <div class="text-center mt-3">
                <button id="auth-toggle-mode" class="btn btn-outline btn-sm">Create Account</button>
            </div>
            
            <div class="text-center mt-2">
                <button id="auth-reset" class="btn btn-sm" style="color: var(--text-slate);">Forgot Password?</button>
            </div>
        </div>
    `;

    showModal(authHTML);

    let isSignUp = false;

    $('#auth-toggle-mode').addEventListener('click', () => {
        isSignUp = !isSignUp;
        $('.auth-submit-label').textContent = isSignUp ? 'Create Account' : 'Sign In';
        $('#auth-toggle-mode').textContent = isSignUp ? 'Back to Sign In' : 'Create Account';
        $('#auth-username-group').style.display = isSignUp ? 'block' : 'none';
        $('.auth-subtitle').textContent = isSignUp ? 'Create your ADULLAM account' : (message || 'Your AI Christian Companion');
    });

    $('#auth-submit').addEventListener('click', async () => {
        const email = $('#auth-email').value.trim();
        const password = $('#auth-password').value;
        const username = $('#auth-username')?.value.trim();

        if (!email || !password) {
            showToast('Please enter email and password', 'error');
            return;
        }

        if (isSignUp && !username) {
            showToast('Please enter a username', 'error');
            return;
        }

        const submitBtn = $('#auth-submit');
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-loading');
        submitBtn.innerHTML = `<span class="btn-spinner"></span> ${isSignUp ? 'Creating account…' : 'Signing in…'}`;

        try {
            if (isSignUp) {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                await database.ref(`users/${userCredential.user.uid}/profile`).set({
                    username: username,
                    bio: '',
                    avatar: '',
                    createdAt: Date.now()
                });
                showToast('Account created successfully!', 'success');
            } else {
                await auth.signInWithEmailAndPassword(email, password);
                showToast('Welcome back!', 'success');
            }
            closeModal();
            if (onSuccess) onSuccess();
        } catch (error) {
            let errorMessage = 'Authentication failed';
            switch (error.code) {
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'This account has been disabled';
                    break;
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password';
                    break;
                case 'auth/email-already-in-use':
                    errorMessage = 'Email is already registered';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Password should be at least 6 characters';
                    break;
                default:
                    errorMessage = error.message;
            }
            showToast(errorMessage, 'error');
            submitBtn.disabled = false;
            submitBtn.classList.remove('btn-loading');
            submitBtn.innerHTML = `<span class="auth-submit-label">${isSignUp ? 'Create Account' : 'Sign In'}</span>`;
        }
    });

    $('#auth-reset').addEventListener('click', async () => {
        const email = $('#auth-email').value.trim();
        if (!email) {
            showToast('Please enter your email address', 'warning');
            return;
        }

        try {
            await auth.sendPasswordResetEmail(email);
            showToast('Password reset email sent!', 'success');
        } catch (error) {
            showToast('Failed to send reset email', 'error');
        }
    });
}

function updateProfileNavIcon() {
    const avatarEl = document.getElementById('profile-nav-avatar');
    if (!avatarEl) return;

    if (AppState.currentUser && AppState.userProfile?.avatar) {
        avatarEl.innerHTML = `<img src="${AppState.userProfile.avatar}" alt="Profile">`;
    } else if (AppState.currentUser) {
        const initial = (AppState.userProfile?.username || AppState.currentUser.email || 'U')[0].toUpperCase();
        avatarEl.innerHTML = `<span class="profile-nav-initial">${escapeHtml(initial)}</span>`;
    } else {
        avatarEl.innerHTML = `<i class="fas fa-user"></i>`;
    }
}

function handleProfileNavClick() {
    if (AppState.currentUser) {
        navigateTo('profile');
    } else {
        showAuthModal({ message: 'Sign in to view and set up your profile.' });
    }
}

function handleLogout() {
    auth.signOut().then(() => {
        AppState.currentUser = null;
        AppState.userProfile = null;
        showToast('Signed out successfully', 'success');
    }).catch((error) => {
        showToast('Failed to sign out', 'error');
    });
}

/* ============================================
   ROUTING
   ============================================ */
function navigateTo(route, options = {}) {
    const { fromPopstate = false, replace = false } = options;

    // Close any open overlays first (they manage their own history entries)
    if (AppState.modalOpen) closeModal(true);
    if (AppState.sheetOpen) closeSheet(true);
    if (AppState.drawerOpen) closeDrawer(true);

    AppState.currentRoute = route;
    updateNavigation(route);

    // Update browser history / URL hash so the back button navigates
    // within the app instead of leaving it.
    if (!fromPopstate) {
        const url = `#/${route}`;
        if (replace) {
            history.replaceState({ route }, '', url);
        } else if (window.location.hash !== url) {
            history.pushState({ route }, '', url);
        }
    }

    switch(route) {
        case 'home':
            renderHomePage();
            break;
        case 'bible':
            renderBiblePage();
            break;
        case 'ask':
            renderAskPage();
            break;
        case 'community':
            renderCommunityPage();
            break;
        case 'planner':
            renderPlannerPage();
            break;
        case 'reels':
            renderReelsPage();
            break;
        case 'messages':
            renderMessagesPage();
            break;
        case 'group-chat':
            renderGroupChatPage();
            break;
        case 'dm-thread':
            renderDMThreadPage();
            break;
        case 'profile':
            renderProfilePage();
            break;
        case 'settings':
            renderSettingsPage();
            break;
        default:
            renderHomePage();
    }
    
    // Scroll to top
    DOM.pageContainer.scrollTop = 0;
}

function updateNavigation(route) {
    // Update drawer links
    $$('.drawer-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.route === route) {
            link.classList.add('active');
        }
    });
    
    // Update bottom nav
    $$('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.route === route) {
            item.classList.add('active');
        }
    });
    
    // Update top bar title
    const titles = {
        home: 'ADULLAM',
        bible: 'Bible',
        ask: 'Shepherd',
        reels: 'Reels',
        community: 'Community',
        planner: 'Bible Planner',
        messages: 'Messages',
        profile: 'My Profile',
        settings: 'Settings'
    };
    DOM.topBarTitle.textContent = titles[route] || 'ADULLAM';
}

function openDrawer() {
    DOM.drawer.classList.add('open');
    DOM.drawerOverlay.classList.add('show');
    DOM.drawerOverlay.classList.remove('hidden');

    if (!AppState.drawerOpen) {
        history.pushState({ overlay: 'drawer' }, '');
    }
    AppState.drawerOpen = true;
}

function closeDrawer(fromPopstate = false) {
    DOM.drawer.classList.remove('open');
    DOM.drawerOverlay.classList.remove('show');
    DOM.drawerOverlay.classList.add('hidden');

    const wasOpen = AppState.drawerOpen;
    AppState.drawerOpen = false;

    if (wasOpen && !fromPopstate && history.state && history.state.overlay === 'drawer') {
        history.back();
    }
}

/* ============================================
   HOME PAGE
   ============================================ */
async function renderHomePage() {
    DOM.bottomNav.style.display = 'flex';
    DOM.drawer.style.display = 'flex';
    
    const dailyVerse = await getDailyVerse();
    const reflection = await getDailyReflection();
    AppState.todayReflection = reflection;
    
    DOM.pageContainer.innerHTML = `
        <div class="home-container" style="max-width: 768px; margin: 0 auto; padding: 16px;">
            <!-- Daily Verse Card -->
            <div class="card mb-4" style="background: linear-gradient(135deg, var(--primary-deep-olive), var(--primary-dark)); color: white; border: none;">
                <div class="flex items-center justify-between mb-2">
                    <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8;">Today's Verse</span>
                    <span style="font-size: 12px; opacity: 0.8;">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
                </div>
                <p style="font-size: 20px; font-weight: 600; margin-bottom: 8px; font-family: 'Playfair Display', serif; line-height: 1.5;">"${dailyVerse.text}"</p>
                <p style="font-size: 14px; opacity: 0.9;">${dailyVerse.reference}</p>
                <div class="flex gap-2 mt-3">
                    <button class="btn btn-sm" style="background: rgba(255,255,255,0.2); color: white;" onclick="shareVerse('${escapeHtml(dailyVerse.reference)}: ${escapeHtml(dailyVerse.text)}')">
                        <i class="fas fa-share"></i> Share
                    </button>
                    <button class="btn btn-sm" style="background: rgba(255,255,255,0.2); color: white;" onclick="saveVerse('${escapeHtml(dailyVerse.reference)}', '${escapeHtml(dailyVerse.text)}')">
                        <i class="fas fa-bookmark"></i> Save
                    </button>
                </div>
            </div>
            
            <!-- Quick Actions -->
            <div class="flex gap-2 mb-4" style="overflow-x: auto; padding-bottom: 8px;">
                <button class="btn btn-secondary btn-sm" onclick="navigateTo('bible')">
                    <i class="fas fa-book-bible"></i> Read Bible
                </button>
                <button class="btn btn-accent btn-sm" onclick="navigateTo('ask')">
                    <i class="fas fa-dove"></i> Ask Shepherd
                </button>
                <button class="btn btn-gold btn-sm" onclick="navigateTo('planner')">
                    <i class="fas fa-calendar-check"></i> Plan Study
                </button>
                
            </div>

            <!-- Meet Shepherd -->
            <div class="card mb-4 shepherd-promo-card" onclick="navigateTo('ask')" style="cursor: pointer; display: flex; align-items: center; gap: 16px; background: linear-gradient(135deg, rgba(199,166,90,0.16), rgba(48,72,58,0.08)); border: 1px solid rgba(199,166,90,0.35);">
                <div style="width: 52px; height: 52px; flex-shrink: 0; border-radius: 50%; background: var(--primary-deep-olive); display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-dove" style="color: var(--bg-warm-ivory); font-size: 22px;"></i>
                </div>
                <div style="flex: 1;">
                    <h3 style="font-weight: 700; font-size: 16px; margin-bottom: 2px;">Talk with Shepherd</h3>
                    <p style="font-size: 13px; color: var(--text-slate); line-height: 1.4;">Your companion for questions, prayer, and study — ask anything, anytime.</p>
                </div>
                <i class="fas fa-chevron-right" style="color: var(--text-slate);"></i>
            </div>

            <!-- Reflection -->
            <div class="card mb-4">
                <div class="flex items-center gap-2 mb-3">
                    <i class="fas fa-lightbulb" style="color: var(--accent-muted-gold);"></i>
                    <h3 style="font-weight: 700; font-size: 18px;">Today's Reflection</h3>
                </div>
                <p style="color: var(--text-slate); line-height: 1.7;">${reflection}</p>
                <button class="btn btn-outline btn-sm mt-3" onclick="discussReflectionWithShepherd()">
                    <i class="fas fa-dove"></i> Discuss with Shepherd
                </button>
            </div>
            
            <!-- Reading Progress -->
            <div class="card mb-4">
                <h3 style="font-weight: 700; margin-bottom: 16px;">Your Journey</h3>
                <div class="flex gap-2" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                    <div class="text-center" style="background: rgba(48,72,58,0.08); padding: 16px; border-radius: 12px;">
                        <div style="font-size: 28px; font-weight: 800; color: var(--primary-deep-olive);">${AppState.readingHistory.length || 0}</div>
                        <div style="font-size: 11px; color: var(--text-slate);">Chapters Read</div>
                    </div>
                    <div class="text-center" style="background: rgba(48,72,58,0.08); padding: 16px; border-radius: 12px;">
                        <div style="font-size: 28px; font-weight: 800; color: var(--primary-deep-olive);">${AppState.bookmarks.length || 0}</div>
                        <div style="font-size: 11px; color: var(--text-slate);">Bookmarks</div>
                    </div>
                    <div class="text-center" style="background: rgba(48,72,58,0.08); padding: 16px; border-radius: 12px;">
                        <div style="font-size: 28px; font-weight: 800; color: var(--primary-deep-olive);">${AppState.notes.length || 0}</div>
                        <div style="font-size: 11px; color: var(--text-slate);">Notes</div>
                    </div>
                </div>
            </div>
            
            <!-- Recommended Reading -->
            <div class="card">
                <h3 style="font-weight: 700; margin-bottom: 16px;">Recommended for You</h3>
                <div id="recommendations-list">
                    ${getRecommendations().map(rec => `
                        <div class="flex items-center justify-between p-2" style="border-bottom: 1px solid rgba(0,0,0,0.06); cursor: pointer;" onclick="openBibleChapter('${rec.book}', ${rec.chapter})">
                            <div>
                                <div style="font-weight: 600;">${rec.title}</div>
                                <div style="font-size: 12px; color: var(--text-slate);">${rec.reference} • ${rec.duration} min read</div>
                            </div>
                            <i class="fas fa-chevron-right" style="color: var(--text-slate);"></i>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

async function getDailyVerse() {
    const verses = [
        { text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.", reference: "Jeremiah 29:11" },
        { text: "Trust in the Lord with all your heart and lean not on your own understanding.", reference: "Proverbs 3:5" },
        { text: "I can do all things through Christ who strengthens me.", reference: "Philippians 4:13" },
        { text: "The Lord is my shepherd; I shall not want.", reference: "Psalm 23:1" },
        { text: "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.", reference: "Joshua 1:9" },
        { text: "Come to me, all you who are weary and burdened, and I will give you rest.", reference: "Matthew 11:28" }
    ];
    
    // Use day of year for consistency
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    return verses[dayOfYear % verses.length];
}

async function getDailyReflection() {
    const reflections = [
        "Take a moment today to pause and reflect on God's faithfulness in your life. Even in the midst of challenges, He is working all things together for your good. Consider journaling three things you're grateful for.",
        "God's love for you is not based on your performance. Rest in the truth that you are deeply loved and fully known. Let this assurance free you to live boldly and love others well.",
        "In a world full of noise, find time to be still and know that He is God. Your soul needs rest. Schedule intentional quiet time today, even if it's just five minutes.",
        "Consider the areas of your life where you need God's wisdom. He promises to give wisdom generously to those who ask. Bring your decisions before Him in prayer today.",
        "Your identity is found in Christ, not in what you do or what others think of you. Meditate on who God says you are: loved, chosen, forgiven, and called for a purpose."
    ];
    
    const now = new Date();
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    
    return reflections[dayOfYear % reflections.length];
}

function getRecommendations() {
    return [
        { book: 'Matthew', chapter: 5, title: 'The Beatitudes', reference: 'Matthew 5', duration: 5 },
        { book: 'Psalm', chapter: 23, title: 'The Lord is My Shepherd', reference: 'Psalm 23', duration: 3 },
        { book: 'Romans', chapter: 8, title: 'Life in the Spirit', reference: 'Romans 8', duration: 8 },
        { book: 'Proverbs', chapter: 3, title: 'Trust in the Lord', reference: 'Proverbs 3', duration: 5 }
    ];
}

/* ============================================
   BIBLE PAGE
   ============================================ */
const BIBLE_VERSION_LABELS = {
    KJV: 'King James Version',
    NKJV: 'New King James Version',
    NLT: 'New Living Translation',
    GOODNEWS: 'Good News Translation',
    AMP: 'Amplified Bible'
};

const BIBLE_BOOK_CHAPTERS = {
    'Genesis': 50, 'Exodus': 40, 'Leviticus': 27, 'Numbers': 36, 'Deuteronomy': 34,
    'Joshua': 24, 'Judges': 21, 'Ruth': 4, '1 Samuel': 31, '2 Samuel': 24,
    '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36, 'Ezra': 10,
    'Nehemiah': 13, 'Esther': 10, 'Job': 42, 'Psalm': 150, 'Proverbs': 31,
    'Ecclesiastes': 12, 'Song of Solomon': 8, 'Isaiah': 66, 'Jeremiah': 52, 'Lamentations': 5,
    'Ezekiel': 48, 'Daniel': 12, 'Hosea': 14, 'Joel': 3, 'Amos': 9,
    'Obadiah': 1, 'Jonah': 4, 'Micah': 7, 'Nahum': 3, 'Habakkuk': 3,
    'Zephaniah': 3, 'Haggai': 2, 'Zechariah': 14, 'Malachi': 4,
    'Matthew': 28, 'Mark': 16, 'Luke': 24, 'John': 21, 'Acts': 28,
    'Romans': 16, '1 Corinthians': 16, '2 Corinthians': 13, 'Galatians': 6, 'Ephesians': 6,
    'Philippians': 4, 'Colossians': 4, '1 Thessalonians': 5, '2 Thessalonians': 3,
    '1 Timothy': 6, '2 Timothy': 4, 'Titus': 3, 'Philemon': 1, 'Hebrews': 13,
    'James': 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5, '2 John': 1,
    '3 John': 1, 'Jude': 1, 'Revelation': 22
};

function getBookChapterCount(book) {
    return BIBLE_BOOK_CHAPTERS[book] || 1;
}

function renderBiblePage() {
    DOM.pageContainer.innerHTML = `
        <div class="bible-reader">
            <div class="bible-header">
                <div style="display: flex; gap: 8px; align-items: center;">
                    <select id="bible-version-select" class="form-select" style="min-width: 140px;">
                        ${AppState.cachedBibleVersions.map(v => `<option value="${v}" ${v === AppState.bibleVersion ? 'selected' : ''}>${v} — ${BIBLE_VERSION_LABELS[v] || v}</option>`).join('')}
                    </select>
                    <button id="search-bible-btn" class="btn btn-outline btn-sm">
                        <i class="fas fa-search"></i> Search
                    </button>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button id="bookmark-chapter-btn" class="btn btn-outline btn-sm">
                        <i class="fas fa-bookmark"></i> Bookmark
                    </button>
                    <button id="font-size-btn" class="btn btn-outline btn-sm">
                        <i class="fas fa-font"></i> Font
                    </button>
                </div>
            </div>

            <div class="bible-nav-picker">
                <select id="bible-book-select" class="form-select">
                    <option value="">Book</option>
                    ${getBibleBooks().map(book => `<option value="${book}">${book}</option>`).join('')}
                </select>
                <select id="bible-chapter-select" class="form-select" disabled>
                    <option value="">Chapter</option>
                </select>
                <div class="verse-jump">
                    <input type="number" id="bible-verse-jump" min="1" placeholder="Verse" disabled>
                    <button id="verse-jump-btn" class="btn btn-outline btn-sm" disabled>Go</button>
                </div>
            </div>
            
            <div id="bible-content" style="min-height: 400px;">
                <div class="text-center text-muted" style="padding: 60px 20px;">
                    <i class="fas fa-book-bible" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px;"></i>
                    <h3 style="margin-bottom: 8px;">Select a Book</h3>
                    <p>Choose a book, chapter, and verse above to start reading.</p>
                </div>
            </div>
            
            <div id="chapter-navigation" class="flex justify-between mt-3" style="display: none;">
                <button id="prev-chapter-btn" class="btn btn-outline btn-sm">
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
                <span id="chapter-indicator" style="font-weight: 600;"></span>
                <button id="next-chapter-btn" class="btn btn-outline btn-sm">
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        </div>
    `;

    const bookSelect = $('#bible-book-select');
    const chapterSelect = $('#bible-chapter-select');
    const verseInput = $('#bible-verse-jump');
    const verseJumpBtn = $('#verse-jump-btn');

    function populateChapters(book, selectedChapter = 1) {
        const total = getBookChapterCount(book);
        chapterSelect.innerHTML = Array.from({ length: total }, (_, i) => i + 1)
            .map(n => `<option value="${n}" ${n === selectedChapter ? 'selected' : ''}>Chapter ${n}</option>`)
            .join('');
        chapterSelect.disabled = false;
        verseInput.disabled = false;
        verseJumpBtn.disabled = false;
    }

    // Event listeners
    $('#bible-version-select').addEventListener('change', (e) => {
        AppState.bibleVersion = e.target.value;
        showToast(`Bible version set to ${e.target.value}`, 'success');
        if (AppState.currentBook && AppState.currentChapter) {
            loadBibleChapter(AppState.currentBook, AppState.currentChapter);
        }
    });
    
    bookSelect.addEventListener('change', (e) => {
        const book = e.target.value;
        if (book) {
            populateChapters(book, 1);
            loadBibleChapter(book, 1);
        } else {
            chapterSelect.innerHTML = '<option value="">Chapter</option>';
            chapterSelect.disabled = true;
            verseInput.disabled = true;
            verseJumpBtn.disabled = true;
        }
    });

    chapterSelect.addEventListener('change', (e) => {
        const chapter = parseInt(e.target.value);
        if (bookSelect.value && chapter) {
            loadBibleChapter(bookSelect.value, chapter);
        }
    });

    function jumpToVerse() {
        const verseNum = parseInt(verseInput.value);
        if (!verseNum) return;
        const verseEl = $(`.bible-verse[data-verse="${verseNum}"]`);
        if (verseEl) {
            verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            verseEl.classList.add('verse-flash');
            setTimeout(() => verseEl.classList.remove('verse-flash'), 1500);
        } else {
            showToast(`Verse ${verseNum} not found in this chapter`, 'warning');
        }
    }

    verseJumpBtn.addEventListener('click', jumpToVerse);
    verseInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') jumpToVerse();
    });
    
    $('#search-bible-btn').addEventListener('click', () => {
        showSearchModal();
    });
    
    $('#bookmark-chapter-btn').addEventListener('click', () => {
        if (AppState.currentBook && AppState.currentChapter) {
            bookmarkChapter(AppState.currentBook, AppState.currentChapter);
        } else {
            showToast('No chapter selected', 'warning');
        }
    });
    
    $('#font-size-btn').addEventListener('click', () => {
        showFontSizeOptions();
    });
    
    $('#prev-chapter-btn').addEventListener('click', () => {
        if (AppState.currentChapter > 1) {
            populateChapters(AppState.currentBook, AppState.currentChapter - 1);
            bookSelect.value = AppState.currentBook;
            loadBibleChapter(AppState.currentBook, AppState.currentChapter - 1);
        }
    });
    
    $('#next-chapter-btn').addEventListener('click', () => {
        const total = getBookChapterCount(AppState.currentBook);
        if (AppState.currentChapter < total) {
            populateChapters(AppState.currentBook, AppState.currentChapter + 1);
            bookSelect.value = AppState.currentBook;
            loadBibleChapter(AppState.currentBook, AppState.currentChapter + 1);
        }
    });
    
    // Load last read chapter if available
    if (AppState.readingHistory.length > 0) {
        const lastRead = AppState.readingHistory[AppState.readingHistory.length - 1];
        if (lastRead && lastRead.book && lastRead.chapter) {
            bookSelect.value = lastRead.book;
            populateChapters(lastRead.book, lastRead.chapter);
            loadBibleChapter(lastRead.book, lastRead.chapter);
        }
    }
}

function getBibleBooks() {
    return [
        'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
        'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
        '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
        'Nehemiah', 'Esther', 'Job', 'Psalm', 'Proverbs',
        'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations',
        'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
        'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
        'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
        'Matthew', 'Mark', 'Luke', 'John', 'Acts',
        'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
        'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
        '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
        'James', '1 Peter', '2 Peter', '1 John', '2 John',
        '3 John', 'Jude', 'Revelation'
    ];
}

async function loadBibleChapter(book, chapter) {
    AppState.currentBook = book;
    AppState.currentChapter = chapter;
    AppState.selectedVerses.clear();
    
    // Show loading
    $('#bible-content').innerHTML = `
        <div class="skeleton" style="height: 40px; margin-bottom: 16px;"></div>
        <div class="skeleton" style="height: 24px; margin-bottom: 12px;"></div>
        <div class="skeleton" style="height: 24px; margin-bottom: 12px;"></div>
        <div class="skeleton" style="height: 24px; margin-bottom: 12px;"></div>
    `;
    
    // Use free Bible API (this is a placeholder - you'd integrate with a proper Bible API)
    // For demo purposes, we'll generate mock verses
    const verses = await mockBibleAPI(book, chapter);
    
    // Update chapter navigation
    $('#chapter-navigation').style.display = 'flex';
    $('#chapter-indicator').textContent = `${book} ${chapter}`;
    
    // Render verses
    $('#bible-content').innerHTML = `
        <h3 style="font-size: 20px; margin-bottom: 20px; font-weight: 700;">${book} ${chapter}</h3>
        ${verses.map(verse => `
            <div class="bible-verse" data-verse="${verse.verse}" onclick="toggleVerseSelection(${verse.verse})">
                <span class="verse-number">${verse.verse}</span>
                <span class="bible-text">${verse.text}</span>
            </div>
        `).join('')}
    `;
    
    // Save to reading history
    if (AppState.currentUser) {
        const uid = AppState.currentUser.uid;
        const historyEntry = {
            book,
            chapter,
            timestamp: Date.now()
        };
        
        // Avoid duplicate consecutive entries
        const lastEntry = AppState.readingHistory[AppState.readingHistory.length - 1];
        if (!lastEntry || lastEntry.book !== book || lastEntry.chapter !== chapter) {
            AppState.readingHistory.push(historyEntry);
            await database.ref(`users/${uid}/readingHistory`).set(AppState.readingHistory);
        }
    }
}

async function mockBibleAPI(book, chapter) {
    // This is a placeholder - integrate with a real Bible API (using the
    // selected AppState.bibleVersion) to fetch actual scripture text.
    const verses = [];
    const verseCount = Math.floor(Math.random() * 20) + 15; // Random verse count between 15-35

    for (let i = 1; i <= verseCount; i++) {
        verses.push({
            verse: i,
            text: `This is a placeholder for ${book} ${chapter}:${i} (${AppState.bibleVersion}). Integrate with a proper Bible API to get real scripture text. The verse continues with meaningful content about faith, hope, and love in the context of biblical teaching.`
        });
    }

    return verses;
}

function toggleVerseSelection(verseNumber) {
    const verseElement = $(`.bible-verse[data-verse="${verseNumber}"]`);
    
    if (AppState.selectedVerses.has(verseNumber)) {
        AppState.selectedVerses.delete(verseNumber);
        verseElement.classList.remove('selected');
    } else {
        AppState.selectedVerses.add(verseNumber);
        verseElement.classList.add('selected');
    }
    
    // Show action sheet if verses are selected
    if (AppState.selectedVerses.size > 0) {
        showVerseActions();
    }
}

function showVerseActions() {
    const selectedCount = AppState.selectedVerses.size;
    const verseNumbers = Array.from(AppState.selectedVerses).join(', ');
    
    const sheetContent = `
        <h3 style="margin-bottom: 16px;">${selectedCount} verse${selectedCount > 1 ? 's' : ''} selected</h3>
        <p style="color: var(--text-slate); margin-bottom: 16px;">${AppState.currentBook} ${AppState.currentChapter}:${verseNumbers}</p>
        
        <div style="display: grid; gap: 8px;">
            <button class="btn btn-primary btn-block" onclick="highlightSelectedVerses()">
                <i class="fas fa-highlighter"></i> Highlight
            </button>
            <button class="btn btn-secondary btn-block" onclick="bookmarkSelectedVerses()">
                <i class="fas fa-bookmark"></i> Bookmark
            </button>
            <button class="btn btn-outline btn-block" onclick="addNoteToSelectedVerses()">
                <i class="fas fa-sticky-note"></i> Add Note
            </button>
            <button class="btn btn-outline btn-block" onclick="shareSelectedVerses()">
                <i class="fas fa-share"></i> Share
            </button>
            <button class="btn btn-gold btn-block" onclick="postSelectedVersesAsReel()">
                <i class="fas fa-play"></i> Post as Reel
            </button>
            <button class="btn btn-accent btn-block" onclick="askAIAboutSelectedVerses()">
                <i class="fas fa-dove"></i> Ask Shepherd
            </button>
        </div>
    `;
    
    showSheet(sheetContent);
}

function postSelectedVersesAsReel() {
    if (AppState.selectedVerses.size === 0) return;

    const verses = Array.from(AppState.selectedVerses).sort((a, b) => a - b).map(v => {
        const el = $(`.bible-verse[data-verse="${v}"] .bible-text`);
        return {
            book: AppState.currentBook,
            chapter: AppState.currentChapter,
            verse: v,
            text: el ? el.textContent.trim() : '',
            version: AppState.bibleVersion
        };
    });

    closeSheet();
    showCreateReelModal({
        verses,
        sourceBook: AppState.currentBook,
        sourceChapter: AppState.currentChapter
    });
}

function highlightSelectedVerses() {
    if (!AppState.currentUser || AppState.selectedVerses.size === 0) return;
    
    const uid = AppState.currentUser.uid;
    const verses = Array.from(AppState.selectedVerses).map(v => ({
        book: AppState.currentBook,
        chapter: AppState.currentChapter,
        verse: v,
        timestamp: Date.now()
    }));
    
    AppState.highlights.push(...verses);
    database.ref(`users/${uid}/highlights`).set(AppState.highlights)
        .then(() => {
            showToast('Verses highlighted!', 'success');
            closeSheet();
            AppState.selectedVerses.clear();
        })
        .catch(() => showToast('Failed to highlight', 'error'));
}

function bookmarkSelectedVerses() {
    if (!AppState.currentUser || AppState.selectedVerses.size === 0) return;
    
    const uid = AppState.currentUser.uid;
    const verses = Array.from(AppState.selectedVerses).map(v => ({
        book: AppState.currentBook,
        chapter: AppState.currentChapter,
        verse: v,
        reference: `${AppState.currentBook} ${AppState.currentChapter}:${v}`,
        timestamp: Date.now()
    }));
    
    AppState.bookmarks.push(...verses);
    database.ref(`users/${uid}/bookmarks`).set(AppState.bookmarks)
        .then(() => {
            showToast('Verses bookmarked!', 'success');
            closeSheet();
            AppState.selectedVerses.clear();
        })
        .catch(() => showToast('Failed to bookmark', 'error'));
}

function addNoteToSelectedVerses() {
    const verseNumbers = Array.from(AppState.selectedVerses).join(', ');
    
    const modalContent = `
        <h3 style="margin-bottom: 16px;">Add Note</h3>
        <p style="font-size: 14px; color: var(--text-slate); margin-bottom: 16px;">${AppState.currentBook} ${AppState.currentChapter}:${verseNumbers}</p>
        <textarea id="note-text" class="form-textarea" placeholder="Write your note..." rows="4"></textarea>
        <button id="save-note-btn" class="btn btn-primary btn-block mt-3">Save Note</button>
    `;
    
    showModal(modalContent);
    
    $('#save-note-btn').addEventListener('click', async () => {
        const noteText = $('#note-text').value.trim();
        if (!noteText) {
            showToast('Please write a note', 'warning');
            return;
        }
        
        if (!AppState.currentUser) return;
        
        const uid = AppState.currentUser.uid;
        const note = {
            text: noteText,
            reference: `${AppState.currentBook} ${AppState.currentChapter}:${verseNumbers}`,
            book: AppState.currentBook,
            chapter: AppState.currentChapter,
            verses: Array.from(AppState.selectedVerses),
            timestamp: Date.now()
        };
        
        AppState.notes.push(note);
        await database.ref(`users/${uid}/notes`).set(AppState.notes);
        
        showToast('Note saved!', 'success');
        closeModal();
        closeSheet();
        AppState.selectedVerses.clear();
    });
}

function shareSelectedVerses() {
    const verseNumbers = Array.from(AppState.selectedVerses).join(', ');
    const reference = `${AppState.currentBook} ${AppState.currentChapter}:${verseNumbers}`;
    shareVerse(reference);
}

function askAIAboutSelectedVerses() {
    const verseNumbers = Array.from(AppState.selectedVerses).join(', ');
    const reference = `${AppState.currentBook} ${AppState.currentChapter}:${verseNumbers}`;
    
    closeSheet();
    navigateTo('ask');
    
    setTimeout(() => {
        const chatInput = $('#chat-input');
        if (chatInput) {
            chatInput.value = `Explain ${reference} to me`;
            sendChatMessage();
        }
    }, 500);
}

function shareVerse(reference, text = '') {
    const shareText = text ? `"${text}" - ${reference}` : reference;
    
    if (navigator.share) {
        navigator.share({
            title: 'Bible Verse',
            text: shareText
        }).catch(() => {});
    } else {
        // Fallback copy to clipboard
        navigator.clipboard.writeText(shareText).then(() => {
            showToast('Verse copied to clipboard!', 'success');
        });
    }
}

function saveVerse(reference, text) {
    if (!requireAuth('Sign in to save your history/progress.')) return;
    
    const uid = AppState.currentUser.uid;
    const bookmark = {
        reference,
        text,
        timestamp: Date.now()
    };
    
    AppState.bookmarks.push(bookmark);
    database.ref(`users/${uid}/bookmarks`).set(AppState.bookmarks)
        .then(() => showToast('Verse saved!', 'success'))
        .catch(() => showToast('Failed to save', 'error'));
}

function bookmarkChapter(book, chapter) {
    if (!requireAuth('Sign in to save your history/progress.')) return;
    
    const uid = AppState.currentUser.uid;
    const bookmark = {
        reference: `${book} ${chapter}`,
        book,
        chapter,
        type: 'chapter',
        timestamp: Date.now()
    };
    
    AppState.bookmarks.push(bookmark);
    database.ref(`users/${uid}/bookmarks`).set(AppState.bookmarks)
        .then(() => showToast('Chapter bookmarked!', 'success'))
        .catch(() => showToast('Failed to bookmark', 'error'));
}

function openBibleChapter(book, chapter) {
    navigateTo('bible');
    setTimeout(() => {
        const bookSelect = $('#bible-book-select');
        const chapterSelect = $('#bible-chapter-select');
        const verseInput = $('#bible-verse-jump');
        const verseJumpBtn = $('#verse-jump-btn');
        if (bookSelect) {
            bookSelect.value = book;
            if (chapterSelect) {
                const total = getBookChapterCount(book);
                chapterSelect.innerHTML = Array.from({ length: total }, (_, i) => i + 1)
                    .map(n => `<option value="${n}" ${n === chapter ? 'selected' : ''}>Chapter ${n}</option>`)
                    .join('');
                chapterSelect.disabled = false;
            }
            if (verseInput) verseInput.disabled = false;
            if (verseJumpBtn) verseJumpBtn.disabled = false;
            loadBibleChapter(book, chapter);
        }
    }, 300);
}

function showSearchModal() {
    const modalContent = `
        <h3 style="margin-bottom: 16px;">Search Bible</h3>
        <input type="text" id="bible-search-input" class="form-input" placeholder="Search by book, chapter, verse, or keyword...">
        <div id="bible-search-results" style="margin-top: 16px; max-height: 400px; overflow-y: auto;"></div>
    `;
    
    showModal(modalContent);
    
    const searchInput = $('#bible-search-input');
    searchInput.focus();
    
    const debouncedSearch = debounce((query) => {
        if (query.length < 2) {
            $('#bible-search-results').innerHTML = '';
            return;
        }
        
        // Search through books
        const results = getBibleBooks().filter(book => 
            book.toLowerCase().includes(query.toLowerCase())
        ).map(book => ({
            type: 'book',
            title: book,
            subtitle: 'Book of the Bible',
            action: () => {
                closeModal();
                openBibleChapter(book, 1);
            }
        })).slice(0, 10);
        
        if (results.length > 0) {
            $('#bible-search-results').innerHTML = results.map(result => `
                <div class="p-2" style="cursor: pointer; border-bottom: 1px solid rgba(0,0,0,0.06);" onclick="closeModal(); openBibleChapter('${result.title}', 1)">
                    <div style="font-weight: 600;">${result.title}</div>
                    <div style="font-size: 12px; color: var(--text-slate);">${result.subtitle}</div>
                </div>
            `).join('');
        } else {
            $('#bible-search-results').innerHTML = `
                <p class="text-center text-muted">No results found for "${query}"</p>
            `;
        }
    }, 300);
    
    searchInput.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
    });
}

function showFontSizeOptions() {
    const sizes = [14, 16, 18, 20, 22, 24];
    
    const sheetContent = `
        <h3 style="margin-bottom: 16px;">Font Size</h3>
        <div style="display: grid; gap: 8px;">
            ${sizes.map(size => `
                <button class="btn btn-outline btn-block" onclick="setBibleFontSize(${size})">
                    ${size}px
                </button>
            `).join('')}
        </div>
    `;
    
    showSheet(sheetContent);
}

function setBibleFontSize(size) {
    $$('.bible-text').forEach(el => {
        el.style.fontSize = `${size}px`;
    });
    closeSheet();
    showToast(`Font size set to ${size}px`, 'success');
}

