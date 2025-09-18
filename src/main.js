// STEP 1: Import all necessary Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
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

// STEP 3: Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messaging = getMessaging(app);

// --- Main Application Logic ---
document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loaded');

    const API_URL = "https://script.google.com/macros/s/AKfycbz5zkASUR1Ye1ZzYvPDvq4VhZegvZHzG5vdczLEaahcw_NDO2D9vb_4sGVYFrjrHzc/exec";
    let clientState = { id: null, name: null, avatar: null, orders: [], materialOrder: { items: [], deliveryDetails: {} } };
    let currentPageId = 'page-home';
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
    }

    async function loadClientData(clientId) {
        try {
            const data = await apiPost({ action: 'getClientData', identifier: clientId });
            if (data.status === 'error' || !data.clientName) throw new Error(data.message || "Client not found");
            
            clientState = { ...clientState, id: data.clientId, name: data.clientName, avatar: data.avatarUrl, orders: data.orders || [] };
            localStorage.setItem('saban_client_id', data.clientId);
            
            await requestNotificationPermission();

            await playSplashScreenAnimation();
            dom.appShell.style.display = 'flex';
            setupEventListeners();
            navigateTo('page-home', true);
            renderAllPages();

        } catch (error) {
            console.error("Failed to load client data:", error);
            localStorage.removeItem('saban_client_id');
            promptForClientId();
            showToast("שגיאה בטעינת נתונים.", '❌');
        }
    }

    // --- RENDER FUNCTIONS ---
    function renderAllPages() {
        renderHeaderAndGreeting();
        renderHomePage();
        renderHistoryPage();
    }

    function renderHeaderAndGreeting() {
        const defaultAvatar = "https://img.icons8.com/?size=100&id=Ry7mumEprV9w&format=png&color=000000";
        dom.clientNameHeader.textContent = clientState.name;
        dom.profileAvatar.src = clientState.avatar || defaultAvatar;
        const hour = new Date().getHours();
        let greetingText = (hour < 12) ? "בוקר טוב" : (hour < 18) ? "צהריים טובים" : "ערב טוב";
        dom.greeting.textContent = `${greetingText}, ${clientState.name.split(' ')[0]}`;
    }

    function renderHomePage() {
        const activeOrders = clientState.orders.filter(o => o['סטטוס'] !== 'סגור');
        const container = dom.activeOrdersContainer;
        container.innerHTML = '';
        if (activeOrders.length > 0) {
            activeOrders.forEach(order => {
                const cardElement = createContainerCardElement(order);
                container.appendChild(cardElement);
                renderLeafletMap(cardElement.querySelector('.mini-map-container'), order['כתובת']);
            });
        } else {
            container.innerHTML = '<div class="card"><p>אין לך כרגע הזמנות פעילות.</p></div>';
        }
    }

    function renderHistoryPage() {
         const closedOrders = clientState.orders.filter(o => o['סטטוס'] === 'סגור');
         dom.historyContent.innerHTML = closedOrders.map(order => `<div class="card">${order['תאריך הזמנה']} - ${order['כתובת']}</div>`).join('');
    }

    function createContainerCardElement(order) {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <h3>${order['שם פרויקט'] || `הזמנה`}</h3>
            <p>${order['כתובת']}</p>
            <div class="mini-map-container" id="map-${order['תעודה']}"></div>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button class="btn secondary" data-action="request-swap" data-id="${order['תעודה']}">החלפה</button>
                <button class="btn" data-action="request-pickup" data-id="${order['תעודה']}">פינוי</button>
            </div>`;
        return card;
    }

    // --- BUILDING MATERIALS LOGIC ---
    function renderMaterialsList() {
        dom.materialsListContainer.innerHTML = clientState.materialOrder.items.map((item, index) => `
            <div class="material-item">
                <span class="material-name">${index + 1}. ${item.product}</span>
                <input type="number" class="material-quantity" value="${item.quantity}" min="1" data-index="${index}" placeholder="כמות">
                <button class="material-delete-btn" data-index="${index}">✖</button>
            </div>
        `).join('');
        updateMaterialsSummary();
    }

    function updateMaterialsSummary() {
        const totalItems = clientState.materialOrder.items.length;
        dom.materialsSummary.textContent = `סה"כ פריטים: ${totalItems}`;
    }
    
    function handleMaterialAdd() {
        const productName = dom.materialInput.value.trim();
        if (productName) {
            clientState.materialOrder.items.push({ product: productName, quantity: 1 });
            renderMaterialsList();
            dom.materialInput.value = '';
            dom.materialInput.focus();
        }
    }
    
    async function handleMaterialOrderSubmit() {
        const { items } = clientState.materialOrder;
        const contactPerson = dom.contactPerson.value.trim();
        const contactPhone = dom.contactPhone.value.trim();
        const deliveryAddress = dom.deliveryAddress.value.trim();

        if (items.length === 0) return showToast("יש להוסיף לפחות מוצר אחד.", '⚠️');
        if (!contactPerson || !contactPhone || !deliveryAddress) return showToast("יש למלא את כל פרטי האספקה.", '⚠️');

        const orderDetails = { clientName: clientState.name, clientId: clientState.id, contactPerson, contactPhone, deliveryAddress, items };
        showMaterialOrderConfirmation(orderDetails);
    }
    
    function showMaterialOrderConfirmation(order) {
        const itemsList = order.items.map((item, i) => `${i + 1}. ${item.product} (כמות: ${item.quantity})`).join('\n');
        dom.modalContainer.innerHTML = `
            <div class="modal-content">
                <h3>סיכום הזמנה</h3>
                <p><strong>מזמין:</strong> ${order.clientName}</p>
                <p><strong>איש קשר:</strong> ${order.contactPerson} (${order.contactPhone})</p>
                <p><strong>כתובת:</strong> ${order.deliveryAddress}</p>
                <h4 style="margin-top: 15px;">פריטים:</h4>
                <pre style="white-space: pre-wrap; background: var(--bg); padding: 10px; border-radius: 8px;">${itemsList}</pre>
                <div style="display: flex; gap: 10px; margin-top:20px;">
                    <button type="button" class="btn secondary" data-action="close-modal" style="flex:1;">ביטול</button>
                    <button type="button" id="confirm-and-send-order" class="btn" style="flex:2;">אשר ושלח</button>
                </div>
            </div>`;
        dom.modalContainer.classList.add('show');
        
        dom.modalContainer.querySelector('#confirm-and-send-order').onclick = async () => {
            await saveMaterialOrderToFirestore(order);
            sendMaterialOrderToWhatsapp(order);
            clientState.materialOrder.items = [];
            renderMaterialsList();
            dom.deliveryDetailsForm.reset();
            dom.modalContainer.classList.remove('show');
            showToast("ההזמנה נשלחה בהצלחה!", '✅');
            navigateTo('page-home');
        };
    }

    async function saveMaterialOrderToFirestore(order) {
        const itemsString = order.items.map(item => `${item.product} (x${item.quantity})`).join(', ');
        const details = `איש קשר: ${order.contactPerson} (${order.contactPhone}). כתובת: ${order.deliveryAddress}. פריטים: ${itemsString}`;
        try {
            await addDoc(collection(db, "clientRequests"), {
                clientId: order.clientId,
                clientName: order.clientName,
                requestType: "הזמנת חומרי בנין",
                details: details,
                timestamp: serverTimestamp(),
                status: "new"
            });
        } catch (error) {
            console.error("Error saving material order:", error);
            showToast("שגיאה בשמירת ההזמנה במערכת", '❌');
        }
    }
    
    function sendMaterialOrderToWhatsapp(order) {
        const WA_NUMBER = "972508860896";
        let message = `*הזמנה חדשה לחומרי בנין* 🔥\n\n*לקוח:* ${order.clientName}\n*איש קשר:* ${order.contactPerson} (${order.contactPhone})\n*כתובת:* ${order.deliveryAddress}\n\n*פירוט:*\n`;
        order.items.forEach((item, i) => { message += `${i + 1}. ${item.product} (כמות: *${item.quantity}*)\n`; });
        const whatsappUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    }

    function addLocationToOrder() {
        if (!navigator.geolocation) return showToast("שירותי מיקום לא נתמכים.", '⚠️');
        showToast("מאחזר מיקום...", '📍');
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await response.json();
                dom.deliveryAddress.value = data.display_name || `קואורדינטות: ${latitude}, ${longitude}`;
                showToast(data.display_name ? "המיקום עודכן!" : "צורפו קואורדינטות.", '✅');
            } catch (error) {
                dom.deliveryAddress.value = `Lat: ${latitude}, Lon: ${longitude}`;
                showToast("לא נמצאה כתובת, צורפו קואורדינטות.", 'ℹ️');
            }
        }, () => showToast("לא ניתן היה לקבל את מיקומך.", '❌'));
    }

    // --- UTILITY & HELPER FUNCTIONS ---
    function cacheDomElements(){
        Object.assign(dom, {
            appShell: document.querySelector('.app-shell'),
            splashScreen: document.getElementById('splash-screen'),
            pages: document.querySelectorAll('.page'),
            navButtons: document.querySelectorAll('.nav-btn'),
            modalContainer: document.getElementById('modal-container'),
            toastContainer: document.getElementById('toast-container'),
            activeOrdersContainer: document.getElementById('active-orders-container'),
            greeting: document.getElementById('greeting'),
            clientNameHeader: document.getElementById('client-name-header'),
            profileAvatar: document.getElementById('profile-avatar'),
            clock: document.getElementById('clock'),
            date: document.getElementById('date'),
            historyContent: document.getElementById('history-content'),
            // Material page elements
            materialInput: document.getElementById('material-input'),
            addMaterialBtn: document.getElementById('add-material-btn'),
            materialsListContainer: document.getElementById('materials-list-container'),
            deliveryDetailsForm: document.getElementById('delivery-details-form'),
            contactPerson: document.getElementById('contact-person'),
            contactPhone: document.getElementById('contact-phone'),
            deliveryAddress: document.getElementById('delivery-address'),
            addLocationBtn: document.getElementById('add-location-btn'),
            materialsSummary: document.getElementById('materials-summary'),
            submitMaterialOrderBtn: document.getElementById('submit-material-order-btn')
        });
    }
    
    function setupEventListeners() {
        // Main click handler for data-actions
        document.body.addEventListener('click', (e) => {
            const actionTarget = e.target.closest('[data-action]');
            if (actionTarget) {
                const action = actionTarget.dataset.action;
                if (action === 'navigate') navigateTo(actionTarget.dataset.page);
                else if (action === 'request-swap' || action === 'request-pickup') {
                    const orderId = actionTarget.dataset.id;
                    const type = action === 'request-swap' ? 'החלפה' : 'פינוי';
                    sendContainerRequest(type, orderId);
                }
            }
             // Modal closing
            if (e.target.classList.contains("modal-overlay") || e.target.dataset.action === 'close-modal') {
                dom.modalContainer.classList.remove("show");
            }
        });
    
        // Materials page specific listeners
        dom.materialInput.addEventListener('keyup', (e) => e.key === 'Enter' && handleMaterialAdd());
        dom.addMaterialBtn.addEventListener('click', handleMaterialAdd);
        dom.submitMaterialOrderBtn.addEventListener('click', handleMaterialOrderSubmit);
        dom.addLocationBtn.addEventListener('click', addLocationToOrder);
    
        dom.materialsListContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('material-delete-btn')) {
                clientState.materialOrder.items.splice(parseInt(e.target.dataset.index), 1);
                renderMaterialsList();
            }
        });
        dom.materialsListContainer.addEventListener('input', (e) => {
             if (e.target.classList.contains('material-quantity')) {
                clientState.materialOrder.items[parseInt(e.target.dataset.index)].quantity = parseInt(e.target.value) || 1;
            }
        });
    }

    async function sendContainerRequest(requestType, orderId) {
         try {
            showToast("שולח בקשה...", '💬');
            await addDoc(collection(db, "clientRequests"), {
                clientId: clientState.id,
                clientName: clientState.name,
                requestType: requestType,
                orderId: orderId,
                timestamp: serverTimestamp(),
                status: 'new'
            });
            showToast("בקשתך נשלחה בהצלחה!", '✅');
        } catch (error) { 
            showToast(`שגיאה בשליחת הבקשה`, '❌'); 
        }
    }

    function navigateTo(pageId, isInitial = false) {
        if (!isInitial && currentPageId === pageId) return;
        const oldPage = document.getElementById(currentPageId);
        const newPage = document.getElementById(pageId);
        if (isInitial) {
            newPage.classList.add('active');
        } else {
            const oldIndex = Array.from(dom.pages).findIndex(p => p.id === currentPageId);
            const newIndex = Array.from(dom.pages).findIndex(p => p.id === pageId);
            const isRight = newIndex > oldIndex;
            oldPage.classList.add(isRight ? 'exit-to-left' : 'exit-to-right');
            newPage.classList.add('active', isRight ? 'enter-from-right' : 'enter-from-left');
            
            oldPage.addEventListener('transitionend', () => {
                oldPage.className = 'page';
                newPage.className = 'page active';
            }, { once: true });
        }
        currentPageId = pageId;
        dom.navButtons.forEach(b => b.classList.toggle('active', b.dataset.page === pageId));
    }

    function renderLeafletMap(container, address) {
        if (!container || !address) return;
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    const { lat, lon } = data[0];
                    const map = L.map(container, { zoomControl: false, scrollWheelZoom: false }).setView([lat, lon], 15);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
                    L.marker([lat, lon]).addTo(map);
                } else { container.innerHTML = 'כתובת לא נמצאה.'; }
            }).catch(err => { container.innerHTML = 'שגיאה בטעינת מפה.'; });
    }

    async function apiPost(body) { /* ... implementation ... */ return fetch(API_URL, { method: 'POST', body: JSON.stringify(body) }).then(res => res.json()) }
    function promptForClientId() { /* ... implementation ... */ dom.modalContainer.innerHTML = `<div class="modal-content"><h3>ברוכים הבאים</h3><p>כדי להתחבר, אנא הזן מספר לקוח או טלפון.</p><form id="login-form"><input type="text" id="login-identifier" placeholder="מספר לקוח / טלפון" required style="width: 100%; padding: 12px; border: 1px solid var(--border); margin-bottom: 15px;"><button type="submit" class="btn" style="width: 100%;">התחבר</button></form></div>`; dom.modalContainer.classList.add('show'); document.getElementById('login-form').addEventListener('submit', (e) => { e.preventDefault(); const id = document.getElementById('login-identifier').value.trim(); if(id){ dom.modalContainer.classList.remove('show'); dom.splashScreen.style.display = 'flex'; loadClientData(id); } }); }
    async function playSplashScreenAnimation() { return new Promise(r => { setTimeout(() => { dom.splashScreen.style.opacity = '0'; dom.splashScreen.addEventListener('transitionend', () => { dom.splashScreen.style.display = 'none'; r(); }, { once: true }); }, 500); }); }
    function updateClock() { const n = new Date(); dom.clock.textContent = n.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); dom.date.textContent = n.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }); }
    function showToast(message, icon = 'ℹ️') { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = `<span>${icon}</span> <span>${message}</span>`; dom.toastContainer.appendChild(t); setTimeout(() => t.classList.add('show'), 10); setTimeout(() => { t.classList.remove('show'); t.addEventListener('transitionend', () => t.remove()); }, 3000); }
    async function requestNotificationPermission() { /* ... implementation ... */ try { const p = await Notification.requestPermission(); if (p !== 'granted') return; const t = await getToken(messaging, { vapidKey: "BPkYpQ8Obf41BWjzMZD27tdpO8xCVQNwrTLznU-jjMb_S9i_y9XhRsdxE6ftEcmm0eJr6DoCM9JXh69dcGFio50" }); if (t && clientState.id) saveTokenToFirestore(t, clientState.id); } catch (e) { console.error('Error getting token', e); } }
    async function saveTokenToFirestore(token, clientId) { /* ... implementation ... */ try { await setDoc(doc(db, 'clients', clientId), { fcmToken: token }, { merge: true }); } catch (e) { console.error('Error saving token', e); } }
    onMessage(messaging, (payload) => { showToast(payload.notification.body, '🔔'); });

    initApp();
});

