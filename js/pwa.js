/* ============================================
   GraceGuide — js/pwa.js
   Load LAST — depends on config.js (messaging, database, auth),
   core.js (AppState, showToast, showModal, $) and the drawer's
   #drawer-install-btn element.

   Handles:
   - Registering sw.js (app shell / offline caching)
   - Registering firebase-messaging-sw.js (push, its own scope so it
     doesn't collide with sw.js)
   - The one-tap "Install App" button in the drawer
   - Requesting notification permission + saving the FCM token
   - Foreground push messages (toast) 
   ============================================ */

/* ============================================
   SERVICE WORKER REGISTRATION
   ============================================ */
let fcmServiceWorkerRegistration = null;

async function registerServiceWorkers() {
    if (!('serviceWorker' in navigator)) return;

    try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch (e) {
        console.warn('App service worker registration failed:', e);
    }

    // Registered at its own scope specifically so it can coexist with
    // sw.js above — otherwise the two would fight over which one
    // controls the page, and push events could silently stop firing.
    try {
        fcmServiceWorkerRegistration = await navigator.serviceWorker.register(
            '/firebase-messaging-sw.js',
            { scope: '/firebase-cloud-messaging-push-scope' }
        );
    } catch (e) {
        console.warn('FCM service worker registration failed:', e);
    }
}

/* ============================================
   INSTALL PROMPT
   ============================================ */
let deferredInstallPrompt = null;

function isRunningStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true; // iOS Safari
}

function isIOSDevice() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function updateInstallButtonVisibility() {
    const btn = document.getElementById('drawer-install-btn');
    if (!btn) return;

    if (isRunningStandalone()) {
        btn.classList.add('hidden');
        return;
    }

    // Chrome/Edge/Android fired beforeinstallprompt — we can install
    // with a single tap. iOS never fires that event but still supports
    // "Add to Home Screen" manually, so we still surface the button
    // there and show instructions instead of a native prompt.
    if (deferredInstallPrompt || isIOSDevice()) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallButtonVisibility();
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallButtonVisibility();
    showToast('GraceGuide installed! You can now open it like any other app.', 'success');
});

async function handleInstallButtonClick() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        updateInstallButtonVisibility();
        if (outcome !== 'accepted') {
            showToast('You can install GraceGuide any time from this menu.', 'info');
        }
        return;
    }

    if (isIOSDevice()) {
        showIOSInstallInstructions();
        return;
    }

    showToast("Your browser doesn't support one-tap install — look for \"Add to Home Screen\" in your browser menu.", 'info');
}

function showIOSInstallInstructions() {
    showModal(`
        <h3 style="margin-bottom: 16px;">Install GraceGuide</h3>
        <p style="margin-bottom: 12px; line-height: 1.6;">iOS doesn't allow apps to trigger installation directly, but it only takes a few taps:</p>
        <ol style="padding-left: 20px; line-height: 2;">
            <li>Tap the <i class="fas fa-arrow-up-from-bracket"></i> Share icon in Safari's toolbar</li>
            <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
            <li>Tap <strong>Add</strong> in the top right</li>
        </ol>
        <button class="btn btn-primary btn-block mt-3" onclick="closeModal()">Got it</button>
    `);
}

/* ============================================
   FCM — PUSH NOTIFICATIONS
   ============================================ */

/**
 * Requests notification permission, gets this device's FCM token, and
 * saves it to the Realtime Database under the signed-in user so server
 * side logic (see functions/index.js) can deliver push notifications
 * to every device the user is signed into.
 */
async function enableNotifications() {
    if (!requireAuth('Sign in to enable notifications.')) return;

    if (!('Notification' in window)) {
        showToast("This browser doesn't support notifications.", 'warning');
        return;
    }

    if (!messaging) {
        showToast("Push notifications aren't supported in this browser/context.", 'warning');
        return;
    }

    if (FCM_VAPID_KEY === 'REPLACE_WITH_YOUR_VAPID_KEY') {
        showToast('Notifications are not fully configured yet (missing VAPID key). Contact the site owner.', 'warning');
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showToast('Notification permission was not granted.', 'warning');
            return;
        }

        if (!fcmServiceWorkerRegistration) {
            fcmServiceWorkerRegistration = await navigator.serviceWorker.register(
                '/firebase-messaging-sw.js',
                { scope: '/firebase-cloud-messaging-push-scope' }
            );
        }

        const token = await messaging.getToken({
            vapidKey: FCM_VAPID_KEY,
            serviceWorkerRegistration: fcmServiceWorkerRegistration
        });

        if (!token) {
            showToast('Could not generate a notification token. Please try again.', 'error');
            return;
        }

        const uid = AppState.currentUser.uid;
        // Keyed by token (not pushed) so re-enabling on the same device
        // updates the same entry rather than creating duplicates — and
        // multiple devices per user are all kept, each getting notified.
        await database.ref(`users/${uid}/fcmTokens/${token}`).set({
            createdAt: Date.now(),
            userAgent: navigator.userAgent
        });

        localStorage.setItem('graceguide_notifications_enabled', 'true');
        showToast('Notifications enabled! 🔔', 'success');
        refreshNotificationSettingsUI();
    } catch (error) {
        console.error('Error enabling notifications:', error);
        showToast('Failed to enable notifications. Please try again.', 'error');
    }
}

/** Lets the settings page reflect whether push is currently enabled. */
function refreshNotificationSettingsUI() {
    const btn = document.getElementById('enable-notifications-btn');
    if (!btn) return;
    const enabled = Notification.permission === 'granted' && localStorage.getItem('graceguide_notifications_enabled') === 'true';
    btn.innerHTML = enabled
        ? '<i class="fas fa-bell"></i> Notifications Enabled'
        : '<i class="fas fa-bell"></i> Enable Notifications';
    btn.disabled = enabled;
    btn.classList.toggle('btn-outline', !enabled);
    btn.classList.toggle('btn-primary', enabled);
}

/** Foreground messages: the OS won't show a system banner for these
    (the tab is focused), so we surface them as an in-app toast instead. */
function initForegroundMessageHandler() {
    if (!messaging) return;
    messaging.onMessage((payload) => {
        const title = payload?.notification?.title || 'GraceGuide';
        const body = payload?.notification?.body || '';
        showToast(`${title}${body ? ' — ' + body : ''}`, 'info');

        if (typeof AppState !== 'undefined' && AppState.currentUser && typeof loadNotifications === 'function') {
            loadNotifications();
        }
    });
}

/* ============================================
   INIT
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
    registerServiceWorkers();
    updateInstallButtonVisibility();
    initForegroundMessageHandler();

    const installBtn = document.getElementById('drawer-install-btn');
    if (installBtn) installBtn.addEventListener('click', handleInstallButtonClick);

    window.matchMedia('(display-mode: standalone)').addEventListener('change', updateInstallButtonVisibility);
});

window.enableNotifications = enableNotifications;
window.handleInstallButtonClick = handleInstallButtonClick;
