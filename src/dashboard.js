// STEP 1: Import all necessary Firebase modules at the very top
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

// --- Main Dashboard Logic ---
document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loaded');

    const newRequestsContainer = document.getElementById('new-requests-container');
    const inProgressContainer = document.getElementById('in-progress-container');
    const completedContainer = document.getElementById('completed-container');
    const newCountEl = document.getElementById('new-requests-count');
    const inProgressCountEl = document.getElementById('in-progress-count');
    const notificationSound = new Audio('https://freesound.org/data/previews/320/320662_5121236-lq.mp3');

    function createRequestCard(request) { /* ... implementation ... */ }
    
    async function updateRequestStatus(id, newStatus) {
        const requestRef = doc(db, "clientRequests", id);
        try {
            await updateDoc(requestRef, { status: newStatus });
        } catch (error) { console.error("Error updating status: ", error); }
    }

    function listenToRequests() {
        const q = query(collection(db, "clientRequests"), orderBy("timestamp", "desc"));
        onSnapshot(q, (snapshot) => {
            newRequestsContainer.innerHTML = '';
            inProgressContainer.innerHTML = '';
            completedContainer.innerHTML = '';
            let newCount = 0, inProgressCount = 0;

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
                if (request.status === 'new') { /* ... */ } 
                else if (request.status === 'in-progress') { /* ... */ }
                else if (request.status === 'completed') { /* ... */ }
            });

            newCountEl.textContent = newCount;
            inProgressCountEl.textContent = inProgressCount;
        });
    }

    document.body.addEventListener('click', (event) => { /* ... implementation ... */ });

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }
    listenToRequests();
});

