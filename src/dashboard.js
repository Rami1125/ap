// STEP 1: Import all necessary Firebase modules at the very top
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, where, orderBy, doc, updateDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

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

// STEP 3: Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const messaging = getMessaging(app);

// --- Main Dashboard Logic ---
document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loaded');

    // --- NEW: Manager Identification ---
    let managerName = sessionStorage.getItem('managerName');
    const managerNameDisplay = document.getElementById('manager-name-display');

    if (!managerName) {
        managerName = prompt("אנא הזן את שמך לצורך זיהוי:", "מנהל");
        if (managerName) {
            sessionStorage.setItem('managerName', managerName);
        } else {
            managerName = "מנהל המערכת"; // Fallback name
        }
    }
    managerNameDisplay.textContent = `מחובר/ת: ${managerName}`;
    // --- End of Manager Identification ---


    const newRequestsContainer = document.getElementById('new-requests-container');
    const inProgressContainer = document.getElementById('in-progress-container');
    const completedContainer = document.getElementById('completed-container');
    const newCountEl = document.getElementById('new-requests-count');
    const inProgressCountEl = document.getElementById('in-progress-count');
    const notificationSound = new Audio('https://freesound.org/data/previews/320/320662_5121236-lq.mp3');
    
    async function setupPushNotifications() {
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                alert('כדי לקבל התראות על הזמנות חדשות, יש לאשר קבלת התראות בהגדרות הדפדפן.');
                return;
            }
            const VAPID_KEY = "BPkYpQ8Obf41BWjzMZD27tdpO8xCVQNwrTLznU-jjMb_S9i_y9XhRsdxE6ftEcmm0eJr6DoCM9JXh69dcGFio50";
            const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
            if (currentToken) {
                const tokenRef = doc(db, "dashboardTokens", currentToken);
                await setDoc(tokenRef, { createdAt: serverTimestamp(), managerName: managerName });
                console.log('Dashboard token saved to Firestore for manager:', managerName);
            }
        } catch (err) {
            console.error('An error occurred while setting up notifications:', err);
        }
    }

    function createRequestCard(request) {
        const date = request.timestamp?.toDate().toLocaleString('he-IL') || 'זמן לא ידוע';
        let actionsHtml = '';
        if (request.status === 'new') {
            actionsHtml = `<button class="card-btn start" data-id="${request.id}">התחל טיפול</button>`;
        } else if (request.status === 'in-progress') {
            actionsHtml = `<button class="card-btn complete" data-id="${request.id}">סיים טיפול</button>`;
        }

        return `
            <div class="kanban-card" id="card-${request.id}" data-status="${request.status}">
                <div class="card-header">
                    <strong class="client-name">${request.clientName}</strong>
                    <span class="request-type">${request.requestType}</span>
                </div>
                <p class="card-details">${request.details}</p>
                <div class="card-footer">
                    <span class="timestamp">${date}</span>
                    <div class="card-actions">${actionsHtml}</div>
                </div>
            </div>
        `;
    }
    
    // --- UPDATED: Now includes the manager's name ---
    async function updateRequestStatus(id, newStatus) {
        const requestRef = doc(db, "clientRequests", id);
        try {
            await updateDoc(requestRef, { 
                status: newStatus,
                handledBy: managerName // Add the manager's name to the request document
            });
            console.log(`Request ${id} status updated to ${newStatus} by ${managerName}`);
        } catch (error) {
            console.error("Error updating status: ", error);
        }
    }

    function listenToRequests() {
        const q = query(collection(db, "clientRequests"), orderBy("timestamp", "desc"));

        onSnapshot(q, 
            (snapshot) => {
                // This is the SUCCESS callback
                console.log(`Successfully fetched ${snapshot.size} requests.`);
                newRequestsContainer.innerHTML = '';
                inProgressContainer.innerHTML = '';
                completedContainer.innerHTML = '';
                let newCount = 0;
                let inProgressCount = 0;

                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added" && change.doc.data().status === 'new') {
                        notificationSound.play();
                        if (Notification.permission === "granted") {
                            new Notification("בקשה חדשה התקבלה!", {
                                body: `מאת: ${change.doc.data().clientName}`,
                                icon: "https://i.postimg.cc/2SbDgD1B/1.png"
                            });
                        }
                    }
                });

                snapshot.forEach(doc => {
                    const request = { id: doc.id, ...doc.data() };
                    const cardHtml = createRequestCard(request);
                    
                    if (request.status === 'new') {
                        newRequestsContainer.innerHTML += cardHtml;
                        newCount++;
                    } else if (request.status === 'in-progress') {
                        inProgressContainer.innerHTML += cardHtml;
                        inProgressCount++;
                    } else if (request.status === 'completed') {
                        const today = new Date().setHours(0, 0, 0, 0);
                        const requestDate = request.timestamp?.toDate().setHours(0, 0, 0, 0);
                        if (requestDate === today) {
                            completedContainer.innerHTML += cardHtml;
                        }
                    }
                });

                newCountEl.textContent = newCount;
                inProgressCountEl.textContent = inProgressCount;
            },
            (error) => {
                // This is the NEW ERROR callback
                console.error("Firestore listen failed: ", error);
                alert("שגיאה בקבלת נתונים מ-Firestore. בדוק את ה-Console (F12) לקבלת פרטים נוספים. ייתכן שאין הרשאות קריאה.");
            }
        );
    }

    document.body.addEventListener('click', (event) => {
        const target = event.target;
        if (target.matches('.card-btn.start')) {
            const id = target.dataset.id;
            updateRequestStatus(id, 'in-progress');
        } else if (target.matches('.card-btn.complete')) {
            const id = target.dataset.id;
            updateRequestStatus(id, 'completed');
        }
    });

    setupPushNotifications();
    listenToRequests();
});
