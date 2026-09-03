/* ============================================
   GraceGuide — js/core.js
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
    cachedBibleVersions: ['KJV', 'NLT', 'MSG', 'AMP'],
    bibleIdMap: {},
    bibleIdsResolving: null,
    isOnline: navigator.onLine,
    isLoading: false,
    currentPlan: null,
    readingHistory: [],
    bookmarks: [],
    highlights: [],
    notes: [],
    communityPosts: [],
    userConnections: new Map(), // otherUid -> 'pending_sent' | 'pending_received' | 'brethren'
    eventData: [],
    modalOpen: false,
    sheetOpen: false,
    drawerOpen: false,
    suppressNextPopstateNav: false,
    aiConversations: [],
    currentConversationId: null,
    viewedProfileId: null,
    viewedProfileName: null,
    todayReflection: '',
    selectedVoiceId: null,
    communityGroups: [],
    currentGroupId: null,
    dmConversations: [],
    currentDMUserId: null,
    currentDMUserName: null,
    spacePosts: [],
    interestProfile: null,
    spaceStreak: { count: 0, lastPostDate: null },
    scrollPositions: {},
    unreadChatsCount: 0,
    unreadForumGroupIds: new Set()
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
    menuBtn: document.getElementById('menu-btn'),
    drawerClose: document.getElementById('drawer-close'),
    drawerLogout: document.getElementById('drawer-logout'),
    notifBtn: document.getElementById('notif-btn'),
    spaceAddBtn: document.getElementById('space-add-btn'),
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
        // This history.back() only exists to unwind the entry we pushed
        // when the modal opened — it must NOT trigger a route re-render.
        AppState.suppressNextPopstateNav = true;
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
        AppState.suppressNextPopstateNav = true;
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
    const savedTheme = localStorage.getItem('graceguide_theme') || 'light';
    AppState.currentTheme = savedTheme;
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    AppState.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('graceguide_theme', theme);
}

function toggleTheme() {
    const newTheme = AppState.currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    showToast(`Theme switched to ${newTheme} mode`, 'success');
    if (AppState.currentRoute === 'settings') renderSettingsPage();
}

/* ============================================
   AUTHENTICATION
   ============================================ */
let authReady = false;

function initAuth() {
    // Safety net: no matter what happens with Firebase Auth (slow network,
    // blocked script, offline device, a thrown error inside the callback),
    // the splash screen must never be able to hang forever with no
    // feedback. If the very first auth check hasn't resolved within a few
    // seconds, drop the user into guest mode and let them retry signing in
    // normally — instead of staring at a stuck loader.
    const SPLASH_TIMEOUT_MS = 6000;
    let settled = false;

    // Known routes that can legitimately be deep-linked / restored on
    // launch. Anything else (or missing) falls back to the default tab
    // instead of forcing everyone onto Shepherd every time the app opens.
    const VALID_INITIAL_ROUTES = ['home', 'bible', 'ask', 'space', 'community', 'planner', 'messages', 'profile', 'settings', 'talk-to-someone'];
    const hashRoute = window.location.hash.replace('#/', '');
    const initialRoute = VALID_INITIAL_ROUTES.includes(hashRoute) ? hashRoute : 'ask';

    const enterAppOnce = (isTimeout) => {
        if (settled) return;
        settled = true;
        authReady = true;
        updateProfileNavIcon();
        updateDrawerAuthButton();
        showMainApp();
        navigateTo(initialRoute, { replace: true });
        if (isTimeout) {
            showToast("Taking longer than usual to connect — you're browsing as a guest for now.", 'warning');
        }
    };

    const splashTimer = setTimeout(() => enterAppOnce(true), SPLASH_TIMEOUT_MS);

    try {
        auth.onAuthStateChanged(async (user) => {
            try {
                if (user) {
                    AppState.currentUser = user;
                    await loadUserProfile(user.uid);
                    await loadUserData();
                } else {
                    if (typeof stopRealtimeListeners === 'function') stopRealtimeListeners();
                    AppState.currentUser = null;
                    AppState.userProfile = null;
                    AppState.bookmarks = [];
                    AppState.highlights = [];
                    AppState.notes = [];
                    AppState.readingHistory = [];
                    AppState.plannerData = [];
                    AppState.userConnections = new Map();
                    AppState.aiConversations = [];
                    AppState.notifications = [];
                    AppState.dmConversations = [];
                    AppState.unreadChatsCount = 0;
                    AppState.unreadForumGroupIds = new Set();
                    if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
                    if (typeof updateChatDrawerBadge === 'function') updateChatDrawerBadge();
                    if (typeof updateForumDrawerBadge === 'function') updateForumDrawerBadge();
                    if (typeof loadInterestProfile === 'function') await loadInterestProfile();
                }

                updateProfileNavIcon();
                updateDrawerAuthButton();

                if (!settled) {
                    // First auth check resolved before the timeout — normal path.
                    clearTimeout(splashTimer);
                    enterAppOnce(false);
                } else {
                    // Auth state changed mid-session (user signed in/out from the
                    // modal) — refresh whatever page is currently showing.
                    navigateTo(AppState.currentRoute, { replace: true });
                }
            } catch (innerError) {
                console.error('Error handling auth state change:', innerError);
                clearTimeout(splashTimer);
                enterAppOnce(false);
                showToast('Something went wrong loading your account. You can try signing in again.', 'error');
            }
        }, (authError) => {
            // Firebase's own error callback for onAuthStateChanged.
            console.error('Firebase auth error:', authError);
            clearTimeout(splashTimer);
            enterAppOnce(true);
        });
    } catch (syncError) {
        // Firebase itself failed to initialize (e.g. SDK didn't load).
        console.error('Failed to start auth listener:', syncError);
        clearTimeout(splashTimer);
        enterAppOnce(true);
    }
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
        const [bookmarksSnap, highlightsSnap, notesSnap, historySnap, plannerSnap, connectionsSnap] = await Promise.all([
            database.ref(`users/${uid}/bookmarks`).once('value'),
            database.ref(`users/${uid}/highlights`).once('value'),
            database.ref(`users/${uid}/notes`).once('value'),
            database.ref(`users/${uid}/readingHistory`).once('value'),
            database.ref(`users/${uid}/planner`).once('value'),
            database.ref(`users/${uid}/connections`).once('value')
        ]);
        
        AppState.bookmarks = bookmarksSnap.val() || [];
        AppState.highlights = highlightsSnap.val() || [];
        AppState.notes = notesSnap.val() || [];
        AppState.readingHistory = historySnap.val() || [];
        AppState.plannerData = plannerSnap.val() || [];
        AppState.currentPlan = AppState.plannerData[0] || null;

        AppState.userConnections = new Map();
        const connections = connectionsSnap.val() || {};
        Object.entries(connections).forEach(([otherUid, info]) => {
            if (!info) return;
            if (info.status === 'accepted') {
                AppState.userConnections.set(otherUid, 'brethren');
            } else if (info.status === 'pending') {
                AppState.userConnections.set(otherUid, info.direction === 'incoming' ? 'pending_received' : 'pending_sent');
            }
        });
    } catch (error) {
        console.error('Error loading user data:', error);
    }
    
    // Start realtime listeners (notifications, chat unread, forum unread) —
    // these update live via Firebase's .on('value'), no refresh needed.
    if (typeof startRealtimeListeners === 'function') startRealtimeListeners();
    // Load the personalization profile (books/tags of interest)
    if (typeof loadInterestProfile === 'function') loadInterestProfile();
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
        return true;
    }
    showAuthModal({ message, onSuccess: onAuthenticated });
    return false;
}

// Turns any Firebase Auth error into a short, plain-English sentence —
// no error codes, no jargon — shown right in the modal as it happens.
function describeAuthError(error) {
    switch (error?.code) {
        case 'auth/invalid-email':
            return "That email address doesn't look right. Double-check it and try again.";
        case 'auth/user-disabled':
            return 'This account has been disabled. Contact support if you think this is a mistake.';
        case 'auth/user-not-found':
            return "We couldn't find an account with that email. Check the spelling, or create a new account.";
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
        case 'auth/invalid-login-credentials':
            return "That password doesn't match this email. Try again, or reset your password below.";
        case 'auth/missing-password':
            return 'Please enter a password.';
        case 'auth/email-already-in-use':
            return 'An account already exists with this email. Try signing in instead.';
        case 'auth/weak-password':
            return 'Please choose a stronger password — at least 8 characters, with both letters and numbers.';
        case 'auth/too-many-requests':
            return "Too many attempts. Please wait a bit before trying again.";
        case 'auth/network-request-failed':
            return "We couldn't reach the server. Check your internet connection and try again.";
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
            return 'The Google sign-in window was closed before finishing.';
        case 'auth/popup-blocked':
            return 'Your browser blocked the Google sign-in popup. Please allow popups for this site and try again.';
        case 'auth/account-exists-with-different-credential':
            return 'An account already exists with this email using a different sign-in method.';
        default:
            return error?.message || 'Something went wrong. Please try again.';
    }
}

// Password rule: at least 8 characters, letters-and-numbers only, and must
// contain at least one letter and one number.
const PASSWORD_RULE_TEXT = 'Password must be at least 8 characters and contain both letters and numbers.';
function isPasswordValid(password) {
    return /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{8,}$/.test(password || '');
}

function showAuthModal(options = {}) {
    const { message, onSuccess } = options;

    const authHTML = `
        <div class="auth-modal">
            <div class="auth-modal-icon">
                <i class="fas fa-dove"></i>
            </div>
            <h2 class="auth-title">Welcome to GraceGuide</h2>
            <p class="auth-subtitle">${message ? escapeHtml(message) : 'Your AI Christian Companion'}</p>

            <div id="auth-error-banner" class="auth-error-banner hidden">
                <i class="fas fa-circle-exclamation"></i>
                <span id="auth-error-text"></span>
            </div>

            <button id="auth-google-btn" class="btn btn-google btn-block">
                <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"/></svg>
                Continue with Google
            </button>

            <div class="auth-divider">or use your email</div>

            <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" id="auth-email" class="form-input" placeholder="Enter your email" autocomplete="email">
            </div>

            <div class="form-group">
                <label class="form-label">Password</label>
                <div class="password-field-wrap">
                    <input type="password" id="auth-password" class="form-input" placeholder="Enter your password" autocomplete="current-password">
                    <button type="button" class="password-toggle-btn" id="auth-password-toggle" aria-label="Show password">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
                <p class="password-hint" id="auth-password-hint">${PASSWORD_RULE_TEXT}</p>
            </div>

            <div class="form-group" id="auth-username-group" style="display: none;">
                <label class="form-label">Username</label>
                <input type="text" id="auth-username" class="form-input" placeholder="Choose a username" autocomplete="nickname">
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

    const errorBanner = $('#auth-error-banner');
    const errorText = $('#auth-error-text');
    const passwordInput = $('#auth-password');
    const passwordHint = $('#auth-password-hint');

    function showAuthError(text) {
        errorText.textContent = text;
        errorBanner.classList.remove('hidden');
    }
    function clearAuthError() {
        errorBanner.classList.add('hidden');
    }

    // Show/hide password toggle
    $('#auth-password-toggle').addEventListener('click', () => {
        const nowVisible = passwordInput.type === 'password';
        passwordInput.type = nowVisible ? 'text' : 'password';
        $('#auth-password-toggle i').className = nowVisible ? 'fas fa-eye-slash' : 'fas fa-eye';
    });

    // Live password validation feedback (sign-up mode only, where it matters)
    passwordInput.addEventListener('input', () => {
        if (!isSignUp) return;
        const valid = isPasswordValid(passwordInput.value);
        passwordHint.classList.toggle('invalid', passwordInput.value.length > 0 && !valid);
    });

    $('#auth-toggle-mode').addEventListener('click', () => {
        isSignUp = !isSignUp;
        clearAuthError();
        $('.auth-submit-label').textContent = isSignUp ? 'Create Account' : 'Sign In';
        $('#auth-toggle-mode').textContent = isSignUp ? 'Back to Sign In' : 'Create Account';
        $('#auth-username-group').style.display = isSignUp ? 'block' : 'none';
        $('.auth-subtitle').textContent = isSignUp ? 'Create your GraceGuide account' : (message || 'Your AI Christian Companion');
        passwordHint.classList.remove('invalid');
    });

    $('#auth-google-btn').addEventListener('click', async () => {
        clearAuthError();
        const googleBtn = $('#auth-google-btn');
        googleBtn.disabled = true;
        googleBtn.classList.add('btn-loading');

        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            const user = result.user;

            // First-time Google sign-ins need a profile record, same as email sign-up.
            const existingProfile = await database.ref(`users/${user.uid}/profile`).once('value');
            if (!existingProfile.exists()) {
                await database.ref(`users/${user.uid}/profile`).set({
                    username: user.displayName || user.email?.split('@')[0] || 'User',
                    bio: '',
                    avatar: user.photoURL || '',
                    createdAt: Date.now()
                });
            }

            showToast(`Welcome, ${user.displayName || 'friend'}!`, 'success');
            closeModal();
            if (onSuccess) onSuccess();
        } catch (error) {
            showAuthError(describeAuthError(error));
            googleBtn.disabled = false;
            googleBtn.classList.remove('btn-loading');
        }
    });

    $('#auth-submit').addEventListener('click', async () => {
        clearAuthError();
        const email = $('#auth-email').value.trim();
        const password = $('#auth-password').value;
        const username = $('#auth-username')?.value.trim();

        if (!email) {
            showAuthError('Please enter your email address.');
            return;
        }
        if (!password) {
            showAuthError('Please enter your password.');
            return;
        }
        if (isSignUp && !username) {
            showAuthError('Please choose a username.');
            return;
        }
        if (isSignUp && !isPasswordValid(password)) {
            showAuthError(PASSWORD_RULE_TEXT);
            passwordHint.classList.add('invalid');
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

                // Email verification — sent on every sign-up to cut down on fake accounts.
                try {
                    await userCredential.user.sendEmailVerification();
                    showToast("Account created! We've sent a verification link to your email.", 'success');
                } catch (verifyError) {
                    console.error('Error sending verification email:', verifyError);
                    showToast('Account created! (We could not send a verification email — you can resend it from Settings.)', 'warning');
                }
            } else {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                if (userCredential.user && !userCredential.user.emailVerified) {
                    showToast("Welcome back! Reminder: your email isn't verified yet — check your inbox, or resend from Settings.", 'warning');
                } else {
                    showToast('Welcome back!', 'success');
                }
            }
            closeModal();
            if (onSuccess) onSuccess();
        } catch (error) {
            showAuthError(describeAuthError(error));
            submitBtn.disabled = false;
            submitBtn.classList.remove('btn-loading');
            submitBtn.innerHTML = `<span class="auth-submit-label">${isSignUp ? 'Create Account' : 'Sign In'}</span>`;
        }
    });

    $('#auth-reset').addEventListener('click', async () => {
        clearAuthError();
        const email = $('#auth-email').value.trim();
        if (!email) {
            showAuthError('Enter your email address above first, then tap "Forgot Password?" again.');
            return;
        }

        try {
            await auth.sendPasswordResetEmail(email);
            showToast(`Password reset email sent to ${email}. Check your inbox.`, 'success');
        } catch (error) {
            showAuthError(describeAuthError(error));
        }
    });
}

/**
 * Resends the verification email for the currently signed-in user.
 * Exposed for use from the Settings page.
 */
async function resendVerificationEmail() {
    if (!AppState.currentUser) {
        showToast('Sign in first.', 'warning');
        return;
    }
    if (AppState.currentUser.emailVerified) {
        showToast('Your email is already verified!', 'success');
        return;
    }
    try {
        await AppState.currentUser.sendEmailVerification();
        showToast('Verification email sent — check your inbox.', 'success');
    } catch (error) {
        showToast(describeAuthError(error), 'error');
    }
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

/**
 * The drawer footer button doubles as "Sign In" for guests. Once signed in,
 * it's hidden entirely — signing out lives on the Settings page instead.
 */
function updateDrawerAuthButton() {
    if (!DOM.drawerLogout) return;

    if (AppState.currentUser) {
        DOM.drawerLogout.classList.add('hidden');
    } else {
        DOM.drawerLogout.classList.remove('hidden');
        DOM.drawerLogout.innerHTML = `<i class="fas fa-right-to-bracket"></i> Sign In`;
    }
}

function handleDrawerAuthButtonClick() {
    if (AppState.currentUser) return;
    // Deliberately NOT calling closeDrawer() here: closeDrawer() unwinds
    // its own history entry via history.back(), which is asynchronous.
    // Immediately pushing a new history entry for the auth modal right
    // after that (as showAuthModal/showModal does) races with the pending
    // back() navigation — the eventual back() lands on the freshly-pushed
    // modal entry instead of the drawer entry, closing the modal the
    // instant it opens. Closing the drawer visually without touching
    // history sidesteps the race; the modal's own pushState still gives
    // the hardware back button correct behavior.
    DOM.drawer.classList.remove('open');
    DOM.drawerOverlay.classList.remove('show');
    DOM.drawerOverlay.classList.add('hidden');
    AppState.drawerOpen = false;
    showAuthModal({ message: 'Sign in to your GraceGuide account.' });
}

function handleLogout() {
    auth.signOut().then(() => {
        if (typeof stopRealtimeListeners === 'function') stopRealtimeListeners();
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

    // Stop any Shepherd voice playback before leaving/changing pages
    if (typeof stopSpeaking === 'function') stopSpeaking();

    // Close any open overlays first (they manage their own history entries)
    if (AppState.modalOpen) closeModal(true);
    if (AppState.sheetOpen) closeSheet(true);
    if (AppState.drawerOpen) closeDrawer(true);

    // Remember where the user was scrolled to on the page they're leaving,
    // so coming back to it later (or a same-route refresh, e.g. after
    // signing in) doesn't yank them back up to the top.
    if (DOM.pageContainer && AppState.currentRoute) {
        AppState.scrollPositions[AppState.currentRoute] = DOM.pageContainer.scrollTop;
    }

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

    let renderResult;
    switch(route) {
        case 'home':
            renderResult = renderHomePage();
            break;
        case 'bible':
            renderResult = renderBiblePage();
            break;
        case 'ask':
            renderResult = renderAskPage();
            break;
        case 'community':
            renderResult = renderCommunityPage();
            break;
        case 'planner':
            renderResult = renderPlannerPage();
            break;
        case 'space':
            renderResult = renderSpacePage();
            break;
        case 'messages':
            renderResult = renderMessagesPage();
            break;
        case 'group-chat':
            renderResult = renderGroupChatPage();
            break;
        case 'dm-thread':
            renderResult = renderDMThreadPage();
            break;
        case 'profile':
            renderResult = renderProfilePage();
            break;
        case 'settings':
            renderResult = renderSettingsPage();
            break;
        case 'talk-to-someone':
            renderResult = renderTalkToSomeonePage();
            break;
        case 'view-profile':
            renderResult = renderViewProfilePage();
            break;
        default:
            renderResult = renderHomePage();
    }

    // Restore this page's last scroll position once its content has
    // actually finished rendering (many pages render a skeleton first,
    // then fill in real content after an async fetch — restoring too
    // early gets clamped back to 0 by the shorter skeleton). Brand-new
    // pages simply have no saved position yet, so they naturally open
    // at the top.
    Promise.resolve(renderResult).then(() => {
        requestAnimationFrame(() => {
            if (AppState.currentRoute === route && DOM.pageContainer) {
                DOM.pageContainer.scrollTop = AppState.scrollPositions[route] || 0;
            }
        });
    });

    // The "add post" button only makes sense on the Space page.
    if (DOM.spaceAddBtn) DOM.spaceAddBtn.classList.toggle('hidden', route !== 'space');
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
        home: 'GraceGuide',
        bible: 'Bible',
        ask: 'Shepherd',
        space: 'Space',
        community: 'Forum',
        planner: 'Study Planner',
        messages: 'Chats',
        profile: 'My Profile',
        settings: 'Settings',
        'talk-to-someone': 'Talk to Someone',
        'view-profile': AppState.viewedProfileName || 'Profile'
    };
    DOM.topBarTitle.textContent = titles[route] || 'GraceGuide';
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
        AppState.suppressNextPopstateNav = true;
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
                
                <button class="btn btn-gold btn-sm" onclick="navigateTo('planner')">
                    <i class="fas fa-calendar-check"></i> Study Planner
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
                    ${getPersonalizedRecommendations().map(rec => `
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

/* ============================================
   BIBLE PAGE
   ============================================ */
const BIBLE_VERSION_LABELS = {
    KJV: 'King James Version',
    NLT: 'New Living Translation',
    MSG: 'The Message',
    AMP: 'Amplified Bible'
};

// api.bible identifies books by USFM codes rather than full names.
const USFM_BOOK_IDS = {
    'Genesis': 'GEN', 'Exodus': 'EXO', 'Leviticus': 'LEV', 'Numbers': 'NUM', 'Deuteronomy': 'DEU',
    'Joshua': 'JOS', 'Judges': 'JDG', 'Ruth': 'RUT', '1 Samuel': '1SA', '2 Samuel': '2SA',
    '1 Kings': '1KI', '2 Kings': '2KI', '1 Chronicles': '1CH', '2 Chronicles': '2CH', 'Ezra': 'EZR',
    'Nehemiah': 'NEH', 'Esther': 'EST', 'Job': 'JOB', 'Psalm': 'PSA', 'Proverbs': 'PRO',
    'Ecclesiastes': 'ECC', 'Song of Solomon': 'SNG', 'Isaiah': 'ISA', 'Jeremiah': 'JER', 'Lamentations': 'LAM',
    'Ezekiel': 'EZK', 'Daniel': 'DAN', 'Hosea': 'HOS', 'Joel': 'JOL', 'Amos': 'AMO',
    'Obadiah': 'OBA', 'Jonah': 'JON', 'Micah': 'MIC', 'Nahum': 'NAM', 'Habakkuk': 'HAB',
    'Zephaniah': 'ZEP', 'Haggai': 'HAG', 'Zechariah': 'ZEC', 'Malachi': 'MAL',
    'Matthew': 'MAT', 'Mark': 'MRK', 'Luke': 'LUK', 'John': 'JHN', 'Acts': 'ACT',
    'Romans': 'ROM', '1 Corinthians': '1CO', '2 Corinthians': '2CO', 'Galatians': 'GAL', 'Ephesians': 'EPH',
    'Philippians': 'PHP', 'Colossians': 'COL', '1 Thessalonians': '1TH', '2 Thessalonians': '2TH',
    '1 Timothy': '1TI', '2 Timothy': '2TI', 'Titus': 'TIT', 'Philemon': 'PHM', 'Hebrews': 'HEB',
    'James': 'JAS', '1 Peter': '1PE', '2 Peter': '2PE', '1 John': '1JN', '2 John': '2JN',
    '3 John': '3JN', 'Jude': 'JUD', 'Revelation': 'REV'
};

function getUSFMBookId(book) {
    return USFM_BOOK_IDS[book] || null;
}

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

/**
 * Parse a free-form Bible reference like "Romans 8:28-39", "Psalm 23",
 * "1 Corinthians 13:4-7", or "John 3:16" into { book, chapter, verse }.
 * Returns null if no known book name can be matched.
 */
function parsePassageReference(passage) {
    if (!passage || typeof passage !== 'string') return null;

    const match = passage.trim().match(/^((?:[1-3]\s+)?[A-Za-z][A-Za-z ]*?)\s+(\d+)(?::(\d+))?/);
    if (!match) return null;

    const rawBook = match[1].trim();
    const chapter = parseInt(match[2], 10) || 1;
    const verse = match[3] ? parseInt(match[3], 10) : null;

    // Match case-insensitively against the known list of books.
    const books = getBibleBooks();
    const book = books.find(b => b.toLowerCase() === rawBook.toLowerCase())
        || books.find(b => b.toLowerCase().startsWith(rawBook.toLowerCase()));

    if (!book) return null;
    return { book, chapter, verse };
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

    let verses = [];
    let loadError = null;
    try {
        verses = await fetchBibleChapter(book, chapter, AppState.bibleVersion);
    } catch (error) {
        console.error('Error loading Bible chapter:', error);
        loadError = error;
    }

    // Bail out quietly if the user has since navigated to a different
    // book/chapter/page while this was loading.
    if (AppState.currentBook !== book || AppState.currentChapter !== chapter || AppState.currentRoute !== 'bible') return;

    if (loadError || verses.length === 0) {
        $('#bible-content').innerHTML = `
            <div class="text-center text-muted" style="padding: 60px 20px;">
                <i class="fas fa-triangle-exclamation" style="font-size: 40px; opacity: 0.4; margin-bottom: 16px;"></i>
                <h3 style="margin-bottom: 8px;">Couldn't load ${escapeHtml(book)} ${chapter}</h3>
                <p style="margin-bottom: 16px;">${loadError ? escapeHtml(loadError.message || 'Something went wrong reaching the Bible service.') : 'No verses were returned.'}</p>
                <button class="btn btn-outline btn-sm" onclick="loadBibleChapter('${book.replace(/'/g, "\\'")}', ${chapter})">
                    <i class="fas fa-rotate-right"></i> Try Again
                </button>
            </div>
        `;
        return;
    }
    
    // Update chapter navigation
    $('#chapter-navigation').style.display = 'flex';
    $('#chapter-indicator').textContent = `${book} ${chapter}`;
    
    // Render verses
    $('#bible-content').innerHTML = `
        <h3 style="font-size: 20px; margin-bottom: 20px; font-weight: 700;">${book} ${chapter}</h3>
        ${verses.map(verse => `
            <div class="bible-verse" data-verse="${verse.verse}" onclick="toggleVerseSelection(${verse.verse})">
                <span class="verse-number">${verse.verse}</span>
                <span class="bible-text">${escapeHtml(verse.text)}</span>
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

        // Feed the personalization engine (see features.js) — reading a
        // book is a strong signal of interest in it.
        if (typeof recordInterestSignal === 'function') recordInterestSignal('book', book, 1);
    }
}

/* ============================================
   BIBLE TEXT — api.bible integration
   ============================================
   Replaces the old mockBibleAPI() placeholder with real scripture text
   from https://scripture.api.bible, restricted to the four translations
   configured in config.js (KJV, NLT, MSG, AMP). Bible IDs are resolved
   dynamically from the account's available Bibles (rather than hard-coded)
   so this keeps working even if the exact IDs on api.bible change. */
async function resolveBibleIds() {
    if (Object.keys(AppState.bibleIdMap).length > 0) return AppState.bibleIdMap;
    if (AppState.bibleIdsResolving) return AppState.bibleIdsResolving;

    AppState.bibleIdsResolving = (async () => {
        // Cache in localStorage so we don't re-fetch the full Bible list
        // (which can be large) on every reload.
        const cached = localStorage.getItem('graceguide_bible_id_map');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed && Object.keys(parsed).length > 0) {
                    AppState.bibleIdMap = parsed;
                    return parsed;
                }
            } catch (e) { /* fall through to re-fetch */ }
        }

        const response = await fetch(`${BIBLE_API_BASE}/bibles?language=eng`, {
            headers: { 'api-key': BIBLE_API_KEY }
        });
        if (!response.ok) throw new Error(`Bible list request failed (${response.status})`);
        const json = await response.json();
        const bibles = json.data || [];

        const map = {};
        Object.keys(BIBLE_VERSIONS).forEach(code => {
            // Prefer an exact abbreviation match, then fall back to a
            // known bibleId hint from config.js, then a name match.
            const byAbbr = bibles.find(b => (b.abbreviation || '').toUpperCase() === code);
            const byHint = bibles.find(b => b.id === BIBLE_VERSIONS[code]);
            const byName = bibles.find(b => (b.abbreviationLocal || '').toUpperCase() === code);
            const found = byAbbr || byHint || byName;
            if (found) map[code] = found.id;
        });

        if (Object.keys(map).length === 0) throw new Error('None of the configured Bible versions were found for this API key.');

        AppState.bibleIdMap = map;
        localStorage.setItem('graceguide_bible_id_map', JSON.stringify(map));
        AppState.cachedBibleVersions = Object.keys(map);
        return map;
    })().catch(error => {
        AppState.bibleIdsResolving = null;
        throw error;
    });

    return AppState.bibleIdsResolving;
}

/**
 * Parses the HTML content api.bible returns for a chapter (with
 * include-verse-spans=true) into a flat [{ verse, text }] array, since the
 * rest of the app renders one row per verse.
 */
function parseVerseSpansFromHTML(html) {
    const container = document.createElement('div');
    container.innerHTML = html;

    const verses = [];
    let currentVerse = null;
    let buffer = '';

    const flush = () => {
        if (currentVerse !== null) {
            const text = buffer.replace(/\s+/g, ' ').trim();
            if (text) verses.push({ verse: currentVerse, text });
        }
        buffer = '';
    };

    const walk = (node) => {
        node.childNodes.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                buffer += child.textContent;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                if (child.classList && child.classList.contains('v') && child.dataset.number) {
                    flush();
                    currentVerse = parseInt(child.dataset.number, 10);
                } else {
                    walk(child);
                }
            }
        });
    };

    walk(container);
    flush();

    return verses;
}

async function fetchBibleChapter(book, chapter, version) {
    const bookId = getUSFMBookId(book);
    if (!bookId) throw new Error(`Unknown Bible book: ${book}`);

    const idMap = await resolveBibleIds();
    const bibleId = idMap[version] || idMap[AppState.cachedBibleVersions[0]];
    if (!bibleId) throw new Error(`The ${version} translation isn't available with this API key.`);

    const url = `${BIBLE_API_BASE}/bibles/${bibleId}/chapters/${bookId}.${chapter}?content-type=html&include-verse-spans=true&include-notes=false&include-titles=false`;
    const response = await fetch(url, { headers: { 'api-key': BIBLE_API_KEY } });

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) throw new Error('The Bible API key was rejected. Check BIBLE_API_KEY in config.js.');
        throw new Error(`Bible service returned an error (${response.status}).`);
    }

    const json = await response.json();
    const html = json?.data?.content;
    if (!html) throw new Error('No content returned for this chapter.');

    return parseVerseSpansFromHTML(html);
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
            <button class="btn btn-gold btn-block" onclick="postSelectedVersesToSpace()">
                <i class="fas fa-layer-group"></i> Post to Space
            </button>
            <button class="btn btn-accent btn-block" onclick="askAIAboutSelectedVerses()">
                <i class="fas fa-dove"></i> Ask Shepherd
            </button>
        </div>
    `;
    
    showSheet(sheetContent);
}

function postSelectedVersesToSpace() {
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
    showCreateSpacePostModal({
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

function openBibleChapter(book, chapter, verse) {
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
            loadBibleChapter(book, chapter).then(() => {
                if (verse) {
                    setTimeout(() => {
                        const verseEl = $(`.bible-verse[data-verse="${verse}"]`);
                        if (verseEl) {
                            verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            verseEl.classList.add('verse-flash');
                            setTimeout(() => verseEl.classList.remove('verse-flash'), 1500);
                        }
                    }, 200);
                }
            });
        }
    }, 300);
}

/**
 * Open a passage referenced by a plain string such as "Romans 8:28-39".
 * Falls back gracefully if the reference can't be parsed.
 */
function openPassageReference(passage) {
    const parsed = parsePassageReference(passage);
    if (!parsed) {
        showToast("Couldn't open that passage — try browsing the Bible tab instead.", 'warning');
        return;
    }
    openBibleChapter(parsed.book, parsed.chapter, parsed.verse);
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

