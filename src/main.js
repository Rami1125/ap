// קובץ זה מאחד את הלוגיקה של האפליקציה וההתראות לקובץ אחד חזק ויציב.

// ========== 1. FIREBASE SETUP ==========
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

const firebaseConfig = {
    apiKey: "AIzaSyDy3k1AoEKeuCKjmFxefn9fapeqv2Le1_w",
    authDomain: "hsaban94-cc777.firebaseapp.com",
    projectId: "hsaban94-cc777",
    storageBucket: "hsaban94-cc777.appspot.com",
    messagingSenderId: "299206369469",
    appId: "1:299206369469:web:50ca90c58f1981ec9457d4"
};

let app, db, messaging;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    messaging = getMessaging(app);
} catch (e) {
    console.warn("Firebase already initialized.");
}

// ========== 2. NOTIFICATION MODULE LOGIC (Integrated) ==========

async function setupNotificationsForClient(clientId) {
    if (!clientId) return console.error("Client ID is required for notifications.");
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
        
        const VAPID_KEY = "BPkYpQ8Obf41BWjzMZD27tdpO8xCVQNwrTLznU-jjMb_S9i_y9XhRsdxE6ftEcmm0eJr6DoCM9JXh69dcGFio50";
        const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
        
        if (currentToken) {
            await setDoc(doc(db, 'clients', clientId), { 
                fcmToken: currentToken, 
                lastUpdated: serverTimestamp() 
            }, { merge: true });
            console.log(`FCM Token for client ${clientId} updated.`);
        }
    } catch (e) {
        console.error('Notification setup error: ', e);
    }
}

async function sendRequestToDashboard(client, requestType, data) {
    if (!client || !client.id || !client.name || !requestType || !data) {
        return false;
    }
    try {
        await addDoc(collection(db, "clientRequests"), {
            clientId: client.id,
            clientName: client.name,
            requestType: requestType,
            details: data,
            timestamp: serverTimestamp(),
            status: "new"
        });
        return true;
    } catch (error) {
        console.error(`Error sending request:`, error);
        return false;
    }
}

function generateWhatsAppLink(orderData) {
    const WA_NUMBER = "972508860896";
    let message = `*הזמנה חדשה מאפליקציית הלקוח* 🔥\n\n`;
    message += `*סוג הזמנה:* ${orderData.type}\n`;
    message += `*מאת:* ${orderData.clientName}\n\n`;
    message += `*פרטי משלוח:*\n`;
    message += `*איש קשר:* ${orderData.contactPerson} (${orderData.contactPhone})\n`;
    message += `*כתובת:* ${orderData.deliveryAddress}\n\n`;

    if (orderData.type === 'חומרי בנין' && orderData.items) {
        message += `*פירוט פריטים:*\n`;
        orderData.items.forEach((item, i) => {
            message += `${i + 1}. ${item.product} (כמות: *${item.quantity}*)\n`;
        });
    }

    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${WA_NUMBER}?text=${encodedMessage}`;
}

// ========== 3. MAIN APP LOGIC ==========
document.addEventListener('DOMContentLoaded', () => {
    let clientState = { id: null, name: null, avatar: null };
    let materialOrder = { items: [], deliveryDetails: {} };
    let currentPageId = 'page-home';
    const dom = {};

    function initApp() {
        if (!cacheDomElements()) {
             document.body.innerHTML = `<div style="padding: 20px; text-align: center; font-family: Assistant, sans-serif;"><h1>שגיאת טעינה</h1><p>רכיבים חיוניים חסרים. לא ניתן להפעיל את האפליקציה.</p><p>בדוק את הקונסול (F12) לפרטים.</p></div>`;
            document.body.classList.add('loaded');
            return;
        }
        
        document.body.classList.add('loaded');
        setupEventListeners();
        
        // Placeholder for a real login mechanism
        clientState = { id: 'mock_client_123', name: 'ישראל ישראלי' };
        
        if (clientState.id) {
            setupNotificationsForClient(clientState.id);
            renderAllPages();
            navigateTo('page-home', true);
        }
    }

    function cacheDomElements() {
        const elements = {
            appHeader: document.querySelector('.app-header'),
            pages: document.querySelectorAll('.page'),
            navButtons: document.querySelectorAll('.nav-btn'),
            greeting: document.getElementById('greeting'),
            homeContent: document.getElementById('home-content'),
            materialsProgress: document.getElementById('materials-progress'),
            materialInput: document.getElementById('material-input'),
            materialsListContainer: document.getElementById('materials-list-container'),
            materialsStep1Next: document.getElementById('materials-step1-next'),
            materialsDeliveryForm: document.getElementById('materials-delivery-form'),
            matContactPerson: document.getElementById('mat-contact-person'),
            matContactPhone: document.getElementById('mat-contact-phone'),
            matDeliveryAddress: document.getElementById('mat-delivery-address'),
            matAddLocationBtn: document.getElementById('mat-add-location-btn'),
            materialsStep2Back: document.getElementById('materials-step2-back'),
            materialsStep2Next: document.getElementById('materials-step2-next'),
            materialsSummary: document.getElementById('materials-summary'),
            materialsStep3Back: document.getElementById('materials-step3-back'),
            submitMaterialOrderBtn: document.getElementById('submit-material-order-btn'),
            historyContent: document.getElementById('history-content'),
            modalContainer: document.getElementById('modal-container'),
            toastContainer: document.getElementById('toast-container')
        };
        for (const key in elements) {
            if (!elements[key]) {
                console.error(`DOM Caching Error: Element "${key}" not found.`);
                return false;
            }
        }
        Object.assign(dom, elements);
        return true;
    }

    function setupEventListeners() {
        dom.navButtons.forEach(btn => btn.addEventListener('click', () => navigateTo(btn.dataset.page)));
        dom.materialsStep1Next.addEventListener('click', () => navigateWizard('materials', 2));
        dom.materialsStep2Back.addEventListener('click', () => navigateWizard('materials', 1));
        dom.materialsStep2Next.addEventListener('click', () => {
            renderMaterialSummary();
            navigateWizard('materials', 3);
        });
        dom.materialsStep3Back.addEventListener('click', () => navigateWizard('materials', 2));
        dom.materialInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleMaterialAdd(); });
        dom.materialsListContainer.addEventListener('click', handleMaterialsListClick);
        dom.materialsDeliveryForm.addEventListener('input', validateMaterialStep2);
        dom.submitMaterialOrderBtn.addEventListener('click', handleMaterialOrderSubmit);
        dom.matAddLocationBtn.addEventListener('click', getGeoLocation);
    }
    
    function renderAllPages() {
        renderHeader();
        renderHomePage();
        renderHistoryPage();
    }
    
    function renderHeader() {
        dom.appHeader.innerHTML = `<div id="profile-container"><img src="https://i.postimg.cc/2SbDgD1B/1.png" alt="Logo" style="width: 40px; height: 40px; border-radius: 50%;"></div><h1 style="font-weight: 800; font-size: 20px;">ח. סבן</h1><div style="width: 40px;"></div>`;
    }

    function renderHomePage() {
        dom.greeting.textContent = `בוקר טוב, ${clientState.name.split(' ')[0]}`;
        dom.homeContent.innerHTML = `<div class="card"><p>ברוך הבא לאזור האישי. כאן תוכל לנהל את כל ההזמנות שלך בקלות ובמהירות.</p></div>`;
    }
    
    function renderHistoryPage() {
        dom.historyContent.innerHTML = `<div class="card"><p>היסטוריית ההזמנות שלך תופיע כאן.</p></div>`;
    }

    function navigateTo(pageId, isInitial = false) {
        if (!isInitial && pageId === currentPageId) return;
        dom.pages.forEach(p => p.classList.remove('active'));
        document.getElementById(pageId)?.classList.add('active');
        currentPageId = pageId;
        dom.navButtons.forEach(b => b.classList.toggle('active', b.dataset.page === pageId));
    }
    
    function navigateWizard(wizard, step) {
        document.querySelectorAll(`.wizard-step`).forEach(s => s.classList.remove('active'));
        document.getElementById(`${wizard}-step-${step}`).classList.add('active');
        dom[`${wizard}Progress`].style.width = `${step * 33.3}%`;
        if (navigator.vibrate) navigator.vibrate(50);
    }

    function handleMaterialAdd() {
        const productName = dom.materialInput.value.trim();
        if (productName) {
            materialOrder.items.push({ product: productName, quantity: 1 });
            renderMaterialsList();
            dom.materialInput.value = '';
            dom.materialInput.focus();
        }
    }

    function renderMaterialsList() {
        if (materialOrder.items.length === 0) {
            dom.materialsListContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted);">רשימת המוצרים שלך תופיע כאן.</p>`;
        } else {
            dom.materialsListContainer.innerHTML = materialOrder.items.map((item, index) => `
                <div class="material-item">
                    <span class="material-name">${index + 1}. ${item.product}</span>
                    <div class="quantity-control">
                        <button class="quantity-btn" data-index="${index}" data-op="-">-</button>
                        <input type="number" class="material-quantity" value="${item.quantity}" min="1" data-index="${index}">
                        <button class="quantity-btn" data-index="${index}" data-op="+">+</button>
                    </div>
                    <button class="material-delete-btn" data-index="${index}">✖</button>
                </div>
            `).join('');
        }
        dom.materialsStep1Next.disabled = materialOrder.items.length === 0;
    }
    
    function handleMaterialsListClick(e) {
        const target = e.target;
        const index = parseInt(target.dataset.index);

        if (target.classList.contains('material-delete-btn')) {
            materialOrder.items.splice(index, 1);
        } else if (target.classList.contains('quantity-btn')) {
            const op = target.dataset.op;
            if (op === '+') materialOrder.items[index].quantity++;
            if (op === '-') materialOrder.items[index].quantity = Math.max(1, materialOrder.items[index].quantity - 1);
        } else if (target.classList.contains('material-quantity')) {
             target.addEventListener('change', () => {
                materialOrder.items[index].quantity = parseInt(target.value) || 1;
             });
             return;
        }
        renderMaterialsList();
    }

    function validateMaterialStep2() {
        const isFormValid = dom.matContactPerson.value.trim() && dom.matContactPhone.value.trim() && dom.matDeliveryAddress.value.trim();
        dom.materialsStep2Next.disabled = !isFormValid;
    }
    
    function renderMaterialSummary() {
        const deliveryDetails = {
            contactPerson: dom.matContactPerson.value,
            contactPhone: dom.matContactPhone.value,
            deliveryAddress: dom.matDeliveryAddress.value
        };
        materialOrder.deliveryDetails = deliveryDetails;
        const itemsList = materialOrder.items.map((item, i) => `${i + 1}. ${item.product} (כמות: ${item.quantity})`).join('\n');
        dom.materialsSummary.innerHTML = `<p><strong>איש קשר:</strong> ${deliveryDetails.contactPerson} (${deliveryDetails.contactPhone})</p><p><strong>כתובת:</strong> ${deliveryDetails.deliveryAddress}</p><h4 style="margin-top: 15px;">פריטים: (${materialOrder.items.length})</h4><pre>${itemsList}</pre>`;
    }

    async function handleMaterialOrderSubmit() {
        const orderData = {
            type: 'חומרי בנין',
            clientName: clientState.name,
            contactPerson: materialOrder.deliveryDetails.contactPerson,
            contactPhone: materialOrder.deliveryDetails.contactPhone,
            deliveryAddress: materialOrder.deliveryDetails.deliveryAddress,
            items: materialOrder.items
        };
        showToast('שולח הזמנה...', 'info');
        const success = await sendRequestToDashboard(clientState, 'הזמנת חומרי בנין', orderData);
        if (success) {
            const whatsappLink = generateWhatsAppLink(orderData);
            window.open(whatsappLink, '_blank');
            showToast('הזמנה נשלחה בהצלחה!', 'success');
            resetMaterialOrder();
            navigateTo('page-home');
        } else {
            showToast('שגיאה בשליחת ההזמנה', 'error');
        }
    }

    function resetMaterialOrder() {
        materialOrder = { items: [], deliveryDetails: {} };
        renderMaterialsList();
        dom.materialsDeliveryForm.reset();
        validateMaterialStep2();
        navigateWizard('materials', 1);
    }
    
    function getGeoLocation() {
        if (!navigator.geolocation) return showToast("שירותי מיקום לא נתמכים.", 'warning');
        showToast("מאחזר מיקום...", 'info');
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await response.json();
                const addressField = currentPageId === 'page-materials' ? dom.matDeliveryAddress : null;
                if (addressField) {
                    addressField.value = data.display_name || `קואורדינטות: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                    validateMaterialStep2();
                }
                showToast("המיקום עודכן!", 'success');
            } catch (error) {
                showToast("שגיאה באחזור כתובת", 'error');
            }
        }, () => showToast("לא ניתן היה לקבל את מיקומך.", 'error'));
    }

    function showToast(message, type = 'info') {
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${message}</span>`;
        dom.toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    }
    
    initApp();
});
```

**2. תוכנית הפעולה (בצע במחשב שלך)**
עכשיו, פתח טרמינל (CMD או PowerShell) במחשב שלך, וודא שאתה נמצא בתיקייה `C:\Users\User\Documents\ap`. לאחר מכן, בצע את הפקודות הבאות בסדר המדויק הזה:

**שלב א': התקנת כלי Firebase (פעולה חד-פעמית)**
הפקודה הבאה תתקין את כלי הפיקוד של Firebase על המחשב שלך. אם כבר התקנת אותם, היא פשוט תוודא שהם מעודכנים.
```bash
npm install -g firebase-tools
```


**שלב ב': בניית הפרויקט**
הפעם, הפקודה הזו תעבוד כי הקוד שלנו מסודר ונקי. היא תיצור את תיקיית `dist`.
```bash
npm run build
```

**שלב ג': פריסת הפרויקט**
עכשיו, כשהכלים מותקנים והפרויקט בנוי, הפקודה הזו תפעל ותעלה את האתר שלך לאוויר.
```bash
firebase deploy --only hosting

