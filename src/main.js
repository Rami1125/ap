// STEP 1: Import all necessary Firebase modules at the very top
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

// STEP 2: Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDy3k1AoEKeuCKjmFxefn9fapeqv2Le1_w",
    authDomain: "hsaban94-cc777.firebaseapp.com",
    databaseURL: "https://hsaban94-cc777.firebaseio.com",
    projectId: "hsaban94-cc777",
    storageBucket: "hsaban94-cc777.appspot.com",
    messagingSenderId: "299206369469",
    appId: "1:299206369469:web:50ca90c58f1981ec9457d4"
};

// STEP 3: Initialize Firebase and other services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messaging = getMessaging(app);

// --- Main Application Logic ---
document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loaded');

    const API_URL = "https://script.google.com/macros/s/AKfycbz5zkASUR1Ye1ZzYvPDvq4VhZegvZHzG5vdczLEaahcw_NDO2D9vb_4sGVYFrjrHzc/exec";
    let clientState = { id: null, name: null, avatar: null, orders: [], addresses: new Set(), currentHistoryFilter: 'all' };
    let currentPageId = 'page-home';
    let mapInstances = {};
    const dom = {};

    function initApp() {
        cacheDomElements();
        updateClock();
        setInterval(updateClock, 1000);
        
        const storedClientId = localStorage.getItem('saban_client_id');
        if (storedClientId) {
            dom.splashScreen.classList.add('loading');
            loadClientData(storedClientId);
        } else {
            dom.splashScreen.style.display = 'none';
            promptForClientId();
        }
        
        requestNotificationPermission();
    }
    
    function cacheDomElements(){
        Object.assign(dom, {
            body: document.body, appShell: document.querySelector('.app-shell'), splashScreen: document.getElementById('splash-screen'),
            pages: document.querySelectorAll('.page'), navButtons: document.querySelectorAll('.nav-btn'),
            modalContainer: document.getElementById('modal-container'), toastContainer: document.getElementById('toast-container'),
            activeOrdersContainer: document.getElementById('active-orders-container'), containersList: document.getElementById('containers-list'),
            etaCardContainer: document.getElementById('eta-card-container'), greeting: document.getElementById('greeting'),
            clientNameHeader: document.getElementById('client-name-header'), profileContainer: document.getElementById('profile-container'),
            profileAvatar: document.getElementById('profile-avatar'), clock: document.getElementById('clock'), date: document.getElementById('date'),
            helpFab: document.querySelector('.help-fab'), helpModal: document.getElementById('help-modal'),
            historyContent: document.getElementById('history-content'), chatContent: document.getElementById('chat-content')
        });
    }
    
    async function loadClientData(clientId, isRefresh = false) {
        try {
            const data = await apiPost({ action: 'getClientData', identifier: clientId });
            if (data.status === 'error' || !data.clientName) throw new Error(data.message || "Client not found");
            
            clientState = { ...clientState, id: data.clientId, name: data.clientName, avatar: data.avatarUrl, orders: data.orders || [], addresses: new Set(data.orders.map(o => o['כתובת']).filter(Boolean)) };
            localStorage.setItem('saban_client_id', data.clientId);
            
            if (!isRefresh) {
                await playSplashScreenAnimation();
                dom.appShell.style.display = 'flex';
                setupEventListeners();
                navigateTo('page-home', true);
                renderAllPages();
                dom.helpFab.style.display = 'block';
            } else {
                renderAllPages();
            }
        } catch (error) {
            console.error("Failed to load client data:", error);
            localStorage.removeItem('saban_client_id');
            dom.splashScreen.style.display = 'none';
            promptForClientId();
            showToast("שגיאה בטעינת נתונים. אנא נסה שוב.", '❌');
        }
    }
    
    async function apiPost(body) {
        const response = await fetch(API_URL, { method: 'POST', mode: 'cors', body: JSON.stringify(body), cache: 'no-cache', headers: { 'Content-Type': 'text/plain' } });
        if (!response.ok) throw new Error(`Network error`);
        const textResponse = await response.text();
        return JSON.parse(textResponse);
    }
    
    function promptForClientId() {
        dom.splashScreen.style.display = 'none';
        dom.modalContainer.innerHTML = `<div class="modal-content"><h3>ברוכים הבאים</h3><p>כדי להתחבר, אנא הזן מספר לקוח או טלפון.</p><form id="login-form"><input type="text" id="login-identifier" placeholder="מספר לקוח / טלפון" required><button type="submit" class="btn">התחבר</button></form></div>`;
        dom.modalContainer.classList.add('show');
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const identifier = document.getElementById('login-identifier').value.trim();
            if (identifier) {
                dom.modalContainer.classList.remove('show');
                dom.splashScreen.style.display = 'flex';
                dom.splashScreen.classList.add('loading');
                loadClientData(identifier);
            }
        });
    }

    async function saveTokenToServer(token, clientId) {
        if (!token || !clientId) return;
        try {
            const clientRef = doc(db, "clients", clientId);
            await updateDoc(clientRef, { fcmToken: token });
            console.log("Client FCM token saved to Firestore.");
        } catch (error) {
            console.error("Error saving token to Firestore:", error);
        }
    }
    
    async function requestNotificationPermission() {
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;
            const VAPID_KEY = "BPkYpQ8Obf41BWjzMZD27tdpO8xCVQNwrTLznU-jjMb_S9i_y9XhRsdxE6ftEcmm0eJr6DoCM9JXh69dcGFio50";
            const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (currentToken) {
                saveTokenToServer(currentToken, clientState.id);
            }
        } catch (err) {
            console.error('An error occurred while retrieving token. ', err);
        }
    }

    onMessage(messaging, (payload) => {
        showToast(`${payload.notification?.title || ''}: ${payload.notification?.body || ''}`, '🔔');
    });

    function updateClock() {
        const now = new Date();
        dom.clock.textContent = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        dom.date.textContent = now.toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: '2-digit' });
    }

    async function playSplashScreenAnimation() {
        return new Promise(resolve => {
            setTimeout(() => {
                dom.splashScreen.style.opacity = '0';
                dom.splashScreen.addEventListener('transitionend', () => { dom.splashScreen.style.display = 'none'; resolve(); }, { once: true });
            }, 500);
        });
    }
    
    function navigateTo(pageId, isInitial = false) {
        const oldPage = document.getElementById(currentPageId);
        const newPage = document.getElementById(pageId);
        if (isInitial) { newPage.classList.add('active'); } 
        else { /* navigation animation logic */ }
        currentPageId = pageId;
        dom.navButtons.forEach(b => b.classList.toggle('active', b.dataset.page === pageId));
    }

    function renderAllPages() {
        renderHeaderAndGreeting(); renderHomePage(); renderContainersPage(); renderHistoryPage(); renderChatPage();
    }

    function renderHeaderAndGreeting() {
        dom.clientNameHeader.textContent = clientState.name;
        dom.profileAvatar.src = clientState.avatar || "https://img.icons8.com/?size=100&id=Ry7mumEprV9w&format=png&color=000000";
        const hour = new Date().getHours();
        let greetingText = (hour < 12) ? "בוקר טוב" : (hour < 18) ? "צהריים טובים" : "ערב טוב";
        dom.greeting.textContent = `${greetingText}, ${clientState.name.split(' ')[0]}`;
    }

    function renderHomePage() { /* Renders home page content */ }
    function createEtaCardHTML(order) { /* Creates ETA card HTML */ }
    function renderContainersPage() { /* Renders containers page content */ }
    function renderHistoryPage(filter) { /* Renders history page content */ }
    function renderChatPage() { /* Renders chat page content */ }
    function createContainerCardElement(order) { /* Creates container card element */ }
    
    async function sendClientRequest(requestType, details) {
        try {
            showToast("שולח בקשה...", '💬');
            await apiPost({ action: 'clientRequest', /* ... */ });
            await addDoc(collection(db, "clientRequests"), {
                clientId: clientState.id, clientName: clientState.name,
                requestType: requestType, details: details,
                timestamp: serverTimestamp(), status: 'new'
            });
            showToast("בקשתך נשלחה בהצלחה!", '✅');
        } catch (error) { showToast(`שגיאה בשליחת הבקשה`, '❌'); }
    }

    function openOrderModal(actionType, order) { /* Opens the order/request modal */ }
    function openHistoryDetailModal(order) { /* Opens history detail modal */ }
    function renderLeafletMap(container, address) { /* Renders a map */ }
    function showToast(message, icon) { /* Shows a toast message */ }
    function setupEventListeners() { /* Sets up all event listeners */ }
    
    initApp();
});

