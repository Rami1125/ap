// STEP 1: Import all necessary Firebase modules at the very top
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
    }

    // --- NEW FUNCTION TO SAVE CLIENT'S TOKEN ---
    async function saveTokenToFirestore(token, clientId) {
        if (!token || !clientId) return;
        try {
            // We create a new collection 'clients' to store profiles and tokens
            const clientRef = doc(db, 'clients', clientId);
            await setDoc(clientRef, { fcmToken: token, lastSeen: serverTimestamp() }, { merge: true });
            console.log('FCM Token saved for client:', clientId);
        } catch (error) {
            console.error('Error saving client FCM token:', error);
        }
    }

    // --- UPDATED FUNCTION TO REQUEST PERMISSION AND SAVE TOKEN ---
    async function requestNotificationPermission() {
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('Notifications permission not granted by client.');
                return null;
            }

            const VAPID_KEY = "BPkYpQ8Obf41BWjzMZD27tdpO8xCVQNwrTLznU-jjMb_S9i_y9XhRsdxE6ftEcmm0eJr6DoCM9JXh69dcGFio50";
            const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });

            if (currentToken && clientState.id) {
                console.log('Got Client FCM token:', currentToken);
                // Call the new function to save the token to the client's document
                await saveTokenToFirestore(currentToken, clientState.id);
            } else if (!clientState.id) {
                 console.log('Client not logged in, cannot save token yet.');
            } else {
                console.log('No registration token available for client.');
            }
            return currentToken;
        } catch (err) {
            console.error('An error occurred while retrieving client token. ', err);
            return null;
        }
    }

    // --- UPDATED LOGIN PROCESS TO TRIGGER NOTIFICATION SETUP ---
    async function loadClientData(clientId, isRefresh = false) {
        try {
            const data = await apiPost({ action: 'getClientData', identifier: clientId });
            if (data.status === 'error' || !data.clientName) throw new Error(data.message || "Client not found");
            
            clientState = { ...clientState, id: data.clientId, name: data.clientName, avatar: data.avatarUrl, orders: data.orders || [] };
            localStorage.setItem('saban_client_id', data.clientId);
            
            // AFTER client data is loaded and we have an ID, we ask for permission and save the token
            await requestNotificationPermission();

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
            dom.splashScreen.classList.remove('loading');
            dom.splashScreen.style.display = 'none';
            promptForClientId();
            showToast("שגיאה בטעינת נתונים. אנא נסה שוב.", '❌');
        }
    }

    // All other functions from your original file remain here...
    function cacheDomElements(){Object.assign(dom,{body:document.body,appShell:document.querySelector(".app-shell"),splashScreen:document.getElementById("splash-screen"),pages:document.querySelectorAll(".page"),navButtons:document.querySelectorAll(".nav-btn"),modalContainer:document.getElementById("modal-container"),toastContainer:document.getElementById("toast-container"),activeOrdersContainer:document.getElementById("active-orders-container"),containersList:document.getElementById("containers-list"),etaCardContainer:document.getElementById("eta-card-container"),greeting:document.getElementById("greeting"),clientNameHeader:document.getElementById("client-name-header"),profileContainer:document.getElementById("profile-container"),profileAvatar:document.getElementById("profile-avatar"),clock:document.getElementById("clock"),date:document.getElementById("date"),helpFab:document.querySelector(".help-fab"),helpModal:document.getElementById("help-modal"),historyContent:document.getElementById("history-content"),chatContent:document.getElementById("chat-content")})}
    async function apiPost(body) { const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 15000); try { const response = await fetch(API_URL, { method: 'POST', mode: 'cors', body: JSON.stringify(body), cache: 'no-cache', headers: { 'Content-Type': 'text/plain' } }); clearTimeout(timeoutId); if (!response.ok) throw new Error(`Network error`); const textResponse = await response.text(); if (textResponse.startsWith('<')) { throw new Error("Received HTML response instead of JSON. Check script URL or permissions."); } return JSON.parse(textResponse); } catch(error) { clearTimeout(timeoutId); console.error("API Post Error:", error); throw error; } }
    function promptForClientId() { dom.splashScreen.style.display = 'none'; dom.modalContainer.innerHTML = `<div class="modal-content"><h3>ברוכים הבאים</h3><p style="color: var(--text-light); margin: 10px 0 20px 0;">כדי להתחבר, אנא הזן מספר לקוח או טלפון.</p><form id="login-form"><input type="text" id="login-identifier" placeholder="מספר לקוח / טלפון" required style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--border); font-size: 16px; margin-bottom: 15px;"><button type="submit" class="btn" style="width: 100%;">התחבר</button></form></div>`; dom.modalContainer.classList.add('show'); document.getElementById('login-form').addEventListener('submit', (e) => { e.preventDefault(); const identifier = document.getElementById('login-identifier').value.trim(); if (identifier) { dom.modalContainer.classList.remove('show'); dom.splashScreen.style.display = 'flex'; dom.splashScreen.classList.add('loading'); loadClientData(identifier); } }); }
    onMessage(messaging,(payload)=>{console.log("Message received while app is in foreground. ",payload);showToast(`${payload.notification?.title||""}: ${payload.notification?.body||""}`,"🔔")});function updateClock(){if(dom.clock&&dom.date){const e=new Date;dom.clock.textContent=e.toLocaleTimeString("he-IL",{hour:"2-digit",minute:"2-digit"});dom.date.textContent=e.toLocaleDateString("he-IL",{weekday:"long",day:"2-digit",month:"2-digit"})}}async function playSplashScreenAnimation(){return new Promise(e=>{setTimeout(()=>{dom.splashScreen.style.opacity="0";dom.splashScreen.addEventListener("transitionend",()=>{dom.splashScreen.style.display="none";e()},{once:!0})},500)})}
    function navigateTo(e,t=!1){if(!t&&currentPageId===e)return;const o=document.getElementById(currentPageId),n=document.getElementById(e);if(!n)return;if(t)n.classList.add("active");else{const t=Array.from(dom.pages).findIndex(t=>t.id===currentPageId),s=Array.from(dom.pages).findIndex(t=>t.id===e),i=s>t;o.classList.add(i?"exit-to-left":"exit-to-right");n.classList.add(i?"enter-from-right":"enter-from-left");void n.offsetWidth;n.classList.add("active");o.addEventListener("transitionend",()=>{o.classList.remove("active","exit-to-left","exit-to-right");n.classList.remove("enter-from-left","enter-from-right")},{once:!0})}currentPageId=e;dom.navButtons.forEach(t=>t.classList.toggle("active",t.dataset.page===e))}
    function renderAllPages(){renderHeaderAndGreeting();renderHomePage();renderContainersPage();renderHistoryPage();renderChatPage()}
    function renderHeaderAndGreeting(){const e="https://img.icons8.com/?size=100&id=Ry7mumEprV9w&format=png&color=000000";dom.clientNameHeader.textContent=clientState.name;dom.profileAvatar.src=clientState.avatar||e;const t=(new Date).getHours();let o=t<12?"בוקר טוב":t<18?"צהריים טובים":"ערב טוב";dom.greeting.textContent=`${o}, ${clientState.name.split(" ")[0]}`}
    function renderHomePage(){const e=clientState.orders.filter(e=>"סגור"!==e["סטטוס"]&&e["מכולה ירדה"]),t=clientState.orders.filter(e=>"סגור"!==e["סטטוס"]&&!e["מכולה ירדה"]);if(t.length>0)dom.etaCardContainer.innerHTML=createEtaCardHTML(t[0]);else dom.etaCardContainer.innerHTML="";const o=dom.activeOrdersContainer;if(o.innerHTML="",e.length>0){const t=createContainerCardElement(e[0]);o.appendChild(t);renderLeafletMap(t.querySelector(".mini-map-container"),e[0]["כתובת"])}else 0===t.length&&(o.innerHTML='<div class="card" style="text-align:center;"><p>אין לך כרגע הזמנות פעילות.</p></div>')}
    function createEtaCardHTML(e){const t=e["זמן הגעה משוער"],o=e["שם נהג"];let n="static-truck",s="width: 0%;",i="right: 0%;";let d=`${o?`הנהג ${o} בדרך`:"הזמנה בדרך"}`,a=`צפי הגעה: ${t||"טרם עודכן"}`;if(t){n="";const[e,o]=t.split(":").map(Number),i=new Date;i.setHours(e,o,0,0);const d=new Date;d.setHours(8,0,0,0);const a=Math.min(100,Math.max(0,(Date.now()-d)/(i-d)*100));s=`width: ${a}%;`;truckStyle=`right: ${a}%;`}return`<div class="card eta-card ${t?"active":""}"><div style="color: var(--brand); font-weight: 700;">${d}</div><div>${a}</div><div class="eta-road"><div class="eta-progress" style="${s}"></div><div class="eta-truck ${n}" style="${truckStyle}">${t?'<div class="siren"></div>':""}🚛</div></div></div>`}
    function renderContainersPage(){const e=clientState.orders.filter(e=>"סגור"!==e["סטטוס"]&&e["מכולה ירדה"]),t=dom.containersList;t.innerHTML="";if(0===e.length){t.innerHTML='<div class="card" style="text-align:center;"><p>אין לך מכולות פעילות כרגע.</p></div>';return}e.forEach(e=>{const o=createContainerCardElement(e);t.appendChild(o);setTimeout(()=>renderLeafletMap(o.querySelector(".mini-map-container"),e["כתובת"]),100)})}
    function renderHistoryPage(e=clientState.currentHistoryFilter){clientState.currentHistoryFilter=e;const t=["all",...new Set(clientState.orders.map(e=>e["פרוייקט"]).filter(Boolean))],o=t.map(t=>`<button class="filter-btn ${e===t?"active":""}" data-action="filter-history" data-project="${t}">`+("all"===t?"הכל":t)+"</button>").join(""),n="all"===e?clientState.orders:clientState.orders.filter(t=>t["פרוייקט"]===e),s=`<div id="history-filters">${o}</div><div style="overflow-x: auto;"><table class="history-table"><thead><tr><th>פרויקט</th><th>תעודה</th><th>תאריך</th><th>פעולה</th></tr></thead><tbody>`+n.map(e=>`<tr class="history-row" data-action="show-history-details" data-order-id="${e["תעודה"]}" data-action-type="${e["סוג פעולה"]}"><td>${e["פרוייקט"]||"-"}</td><td>${e["תעודה"]||""}</td><td>`+(new Date(e["תאריך הזמנה"])?.toLocaleDateString("he-IL")||"")+`</td><td>${e["סוג פעולה"]||""}</td></tr>`).join("")+"</tbody></table></div>";dom.historyContent.innerHTML=s}
    function renderChatPage(){const e={"שאלות נפוצות":["מה צפי ההגעה?","האם ניתן להאריך שהייה?"],בקשות:["המכולה מלאה, לתאם פינוי.","פינוי דחוף, צרו קשר."]},t=Object.keys(e).map(t=>`<p style="font-weight: 600; margin-top: 15px; margin-bottom: 5px;">${t}</p>`+e[t].map(e=>`<button class="btn secondary" data-action="chat-template" style="width: 100%; justify-content: flex-start; text-align: right; margin-bottom: 5px;">${e}</button>`).join("")).join("");dom.chatContent.innerHTML=`<div id="chat-templates">${t}</div><form id="chat-form" style="margin-top: 20px;"><label for="chat-message">או כתוב הודעה חופשית: 👋</label><textarea id="chat-message" required placeholder="כתוב כאן..." style="width:100%; height:80px; padding:10px; border-radius:8px; border:1px solid var(--border); margin-top:5px;"></textarea><button type="submit" class="btn" style="width:100%; margin-top: 10px;">שלח הודעה</button></form>`}
    function createContainerCardElement(e){const t=document.createElement("div");t.className="card container-card";const o=new Date(e["תאריך הזמנה"]),n=new Date(e["תאריך סיום צפוי"]),s=Math.min(100,(Date.now()-o)/(n-o)*100),i=Math.ceil(Math.max(0,n-Date.now())/864e5),d=Date.now()>n;d&&t.classList.add("overdue");const a=(e.requests||[]).map(e=>`<div class="request-history-item"><span>בקשת ${e.type}</span><span style="color: var(--text-muted);">${e.date}</span></div>`).join("");return t.innerHTML=`${d?'<div class="overdue-badge">בחריגה</div>':""}<div style="display:flex; justify-content: space-between; align-items: flex-start;"><div><h3 style="font-size: 1.1rem; margin-bottom: 4px;">${e["שם פרויקט"]||`מכולה ${e["מכולה ירדה"]}`}</h3><p style="color: var(--text-light); font-size: 0.9rem;">${e["כתובת"]}</p></div><div style="text-align: center; flex-shrink: 0; margin-right: 15px;"><div style="font-weight: bold; font-size: 1.2rem;">${d?"!":i}</div><div style="font-size: 0.7rem; color: var(--text-muted);">${d?"בחריגה":"ימים נותרו"}</div></div></div><div class="progress-bar"><div class="progress-bar-inner" style="width: ${s}%;"></div></div><div class="mini-map-container" id="map-card-${e["תעודה"]}"></div><div class="request-history"><h4 style="font-size: 1rem; margin-bottom: 5px;">היסטוריית בקשות</h4>${a||'<p style="font-size: 14px; color: var(--text-muted);">אין בקשות קודמות.</p>'}</div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;"><button class="btn secondary" data-action="request-swap" data-order-id="${e["תעודה"]}">החלפה</button><button class="btn" data-action="request-pickup" data-order-id="${e["תעודה"]}">פינוי</button></div>`,t}
    async function sendClientRequest(e,t){try{showToast("שולח בקשה...","💬");await apiPost({action:"clientRequest",timestamp:(new Date).toISOString(),clientId:clientState.id,clientName:clientState.name,requestType:e,details:t});await addDoc(collection(db,"clientRequests"),{clientId:clientState.id,clientName:clientState.name,requestType:e,details:t,timestamp:serverTimestamp(),status:"new"});showToast("בקשתך נשלחה בהצלחה!","✅")}catch(e){showToast("שגיאה בשליחת הבקשה","❌")}}
    function openOrderModal(e,t){const o=!t;let n=o?"הזמנת מכולה חדשה":`בקשת ${e}`;let s=o?`<div class="form-group"><label>בחר כתובת או הקלד חדשה</label><select id="address-select" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border); margin-top:5px;"><option value="">-- בחר כתובת --</option>${Array.from(clientState.addresses).map(e=>`<option value="${e}">${e}</option>`).join("")}<option value="new">כתובת חדשה...</option></select></div><div id="new-address-group" style="display:none; margin-top:10px;"><input type="text" id="new-address" placeholder="עיר, רחוב, מספר בית" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border);"></div><div style="margin-top:10px;"><input type="text" id="placement-location" placeholder="מיקום מדויק להצבה (ליד השער וכו')" style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border);"></div>`:`<p style="margin-bottom: 20px;">עבור מכולה בכתובת: <strong>${t["כתובת"]}</strong></p>`;dom.modalContainer.innerHTML=`<div class="modal-content"><h3 style="margin-bottom: 20px;">${n}</h3>${s}<form id="order-request-form"><div style="margin-top:15px;"><label>הערות</label><textarea id="order-notes" placeholder="לדוגמה: נא לתאם הגעה טלפונית..." style="width:100%; height:80px; padding:10px; border-radius:8px; border:1px solid var(--border); margin-top:5px;"></textarea></div><div style="display: flex; gap: 10px; margin-top:20px;"><button type="button" class="btn secondary" data-action="close-modal" style="flex:1;">ביטול</button><button type="submit" class="btn" style="flex:2;">שלח בקשה</button></div></form></div>`;dom.modalContainer.classList.add("show");o&&(document.getElementById("address-select").onchange=e=>{document.getElementById("new-address-group").style.display="new"===e.target.value?"block":"none"});dom.modalContainer.querySelector('[data-action="close-modal"]').onclick=()=>dom.modalContainer.classList.remove("show");document.getElementById("order-request-form").onsubmit=o=>{o.preventDefault();let n,s;const i=document.getElementById("order-notes").value;if(t){details=`מכולה קיימת: ${t["תעודה"]}. כתובת: ${t["כתובת"]}. הערות: ${i||"אין"}`}else{const e=document.getElementById("new-address").value.trim(),t=document.getElementById("placement-location").value.trim();if(s=e||document.getElementById("address-select").value,!s||"new"===s||""===s)return void showToast("אנא בחר או הקלד כתובת.","error");details=`כתובת: ${s}. מיקום להצבה: ${t||"לא צוין"}. הערות: ${i||"אין"}`}sendClientRequest(e,details);dom.modalContainer.classList.remove("show")}}
    function openHistoryDetailModal(e){if(!e)return;dom.modalContainer.innerHTML=`<div class="modal-content" style="padding:0;"><div style="padding: 20px 20px 0 20px;"><h3 style="margin-bottom: 10px;">פרטי הזמנה ${e["תעודה"]}</h3><p><strong>פרויקט:</strong> ${e["פרוייקט"]||"-"}</p><p><strong>כתובת:</strong> ${e["כתובת"]}</p><p><strong>תאריך:</strong> `+(new Date(e["תאריך הזמנה"])?.toLocaleDateString("he-IL"))+`</p><p><strong>פעולה:</strong> ${e["סוג פעולה"]}</p></div><div id="history-map" style="height: 200px; width: 100%; margin-top: 15px; border-bottom-left-radius: var(--radius); border-bottom-right-radius: var(--radius);"></div></div>`;dom.modalContainer.classList.add("show");renderLeafletMap(document.getElementById("history-map"),e["כתובת"]);dom.modalContainer.onclick=e=>{e.target===dom.modalContainer&&dom.modalContainer.classList.remove("show")}}
    function renderLeafletMap(e,t){if(!e||!t)return;const o=e.id;mapInstances[o]&&mapInstances[o].remove();e.innerHTML='<div style="text-align:center; padding-top: 50px; color: var(--text-muted);">טוען מפה...</div>';fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(t)}`).then(e=>e.json()).then(t=>{if(t&&t.length>0){e.innerHTML="";const{lat:n,lon:s}=t[0],i=L.map(e,{zoomControl:!1,scrollWheelZoom:!1,dragging:!0,doubleClickZoom:!1}).setView([n,s],15);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(i);L.marker([n,s]).addTo(i);mapInstances[o]=i}else e.innerHTML='<div style="text-align:center; padding-top: 50px; color: var(--text-muted);">כתובת לא נמצאה.</div>'}).catch(t=>{e.innerHTML='<div style="text-align:center; padding-top: 50px; color: var(--text-muted);">שגיאה בטעינת מפה.</div>'})}
    function showToast(e,t="ℹ️"){const o=document.createElement("div");o.className="toast";o.innerHTML=`<span class="toast-icon">${t}</span> <span>${e}</span>`;dom.toastContainer.appendChild(o);setTimeout(()=>o.classList.add("show"),100);setTimeout(()=>{o.classList.remove("show");o.addEventListener("transitionend",()=>o.remove())},3e3)}
    function setupEventListeners(){dom.body.addEventListener("click",e=>{const t=e.target.closest("[data-action]");if(!t){e.target.closest("#profile-container")||dom.profileContainer.classList.remove("active");e.target.classList.contains("modal-overlay")&&e.target.classList.remove("show");return}const o=t.dataset.action;switch(o){case"navigate":navigateTo(t.dataset.page);break;case"help-fab":dom.helpModal.classList.add("show");break;case"help-close":dom.helpModal.classList.remove("show");break;case"toggle-profile":dom.profileContainer.classList.toggle("active");break;case"logout":localStorage.clear();window.location.reload();break;case"new-order":openOrderModal("הזמנה חדשה");break;case"chat-template":document.getElementById("chat-message").value=t.textContent;break;case"refresh-data":if(clientState.id){const e=t;e.style.transition="transform 0.5s ease";e.style.transform="rotate(360deg)";e.disabled=!0;showToast("מרענן נתונים...","🔄");loadClientData(clientState.id,!0).then(()=>{showToast("הנתונים עודכנו!","✅")}).catch(e=>{console.error("Refresh failed:",e);showToast("שגיאה ברענון הנתונים","❌")}).finally(()=>{setTimeout(()=>{e.style.transition="";e.style.transform="";e.disabled=!1},500)})}break;case"filter-history":renderHistoryPage(t.dataset.project);break;case"show-history-details":const e=clientState.orders.find(e=>e["תעודה"]==t.dataset.orderId);openHistoryDetailModal(e);break;case"request-swap":case"request-pickup":{const e=t.dataset.orderId,n=clientState.orders.find(t=>t["תעודה"]==e);n&&openOrderModal("request-swap"===o?"החלפה":"פינוי",n);break}}});dom.body.addEventListener("submit",e=>{if("chat-form"===e.target.id){e.preventDefault();const t=document.getElementById("chat-message");t.value.trim()&&(sendClientRequest("הודעת צאט",t.value.trim()),t.value="")}})}
    initApp();
});

