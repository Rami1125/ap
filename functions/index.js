import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import admin from "firebase-admin";
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

admin.initializeApp();

// --- This is our new magic function ---
export const getProductCatalog = onCall({ cors: true }, async (request) => {
    try {
        // --- 1. Authenticate with Google Sheets ---
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const doc = new GoogleSpreadsheet('1lEAKmQwf71eMRQ1Z_yHF7-9Bf66LAjOa2DuC0cKcKJA', serviceAccountAuth);
        await doc.loadInfo();
        
        // --- 2. Get the Product Catalog sheet ---
        const sheet = doc.sheetsByTitle['קטלוג מוצרים']; // Make sure the sheet name is correct
        
        // --- 3. Read rows and transform them into our smart product objects ---
        const rows = await sheet.getRows();
        const catalog = rows.map(row => ({
            sku: row.get('מק"ט'),
            name: row.get('שם מוצר'),
            spec: row.get('מפרט מוצר'),
            imageUrl: row.get('תמונת מוצר'),
            unitOfMeasure: row.get('unitOfMeasure'), 
            standardQuantityPerUnit: row.get('standardQuantityPerUnit'),
            baseUnit: row.get('baseUnit') 
        }));

        console.log(`Successfully loaded ${catalog.length} products from catalog.`);
        
        // --- 4. Return the catalog to the app ---
        return { success: true, catalog: catalog };

    } catch (error) {
        console.error("Error fetching product catalog:", error);
        return { success: false, error: "Failed to load product catalog." };
    }
});


// --- Your existing functions ---
export const sendPushNotificationOnNewRequest = onDocumentCreated("clientRequests/{requestId}", async (event) => {
  const newRequest = event.data.data();
  const payload = {
    notification: {
      title: "🔔 בקשה חדשה התקבלה!",
      body: `מאת: ${newRequest.clientName} | סוג: ${newRequest.requestType}`,
      icon: "https://i.postimg.cc/2SbDgD1B/1.png",
    },
    webpush: { fcmOptions: { link: "/dashboard.html" } },
  };

  const tokensSnapshot = await admin.firestore().collection("dashboardTokens").get();
  if (tokensSnapshot.empty) {
    logger.log("No dashboard tokens to send notification to.");
    return;
  }

  const tokens = tokensSnapshot.docs.map((doc) => doc.id);
  const response = await admin.messaging().sendToDevice(tokens, payload);
  await cleanupInvalidTokens(response, tokens, "dashboardTokens");
});

export const notifyClientOnStatusChange = onDocumentUpdated("clientRequests/{requestId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (before.status === after.status) return;

  const clientId = after.clientId;
  const clientDoc = await admin.firestore().collection("clients").doc(clientId).get();
  if (!clientDoc.exists || !clientDoc.data().fcmToken) return;
  
  const clientToken = clientDoc.data().fcmToken;
  let statusMessage = "";
  if (after.status === "in-progress") statusMessage = "הבקשה שלך התקבלה והיא בטיפול!";
  else if (after.status === "completed") statusMessage = "הבקשה שלך הושלמה. תודה!";
  else return;

  const payload = {
    notification: {
      title: "סטטוס בקשה התעדכן",
      body: statusMessage,
      icon: "https://i.postimg.cc/2SbDgD1B/1.png",
    },
    webpush: { fcmOptions: { link: "/" } },
  };

  const response = await admin.messaging().sendToDevice([clientToken], payload);
  await cleanupInvalidTokens(response, [clientToken], "clients", clientId);
});

async function cleanupInvalidTokens(response, tokens, collectionName, docId = null) {
  const tokensToDelete = [];
  response.results.forEach((result, index) => {
    const error = result.error;
    if (error && (error.code === "messaging/invalid-registration-token" || error.code === "messaging/registration-token-not-registered")) {
      if (collectionName === "clients" && docId) {
        tokensToDelete.push(admin.firestore().collection(collectionName).doc(docId).update({ fcmToken: admin.firestore.FieldValue.delete() }));
      } else {
        const tokenRef = admin.firestore().collection(collectionName).doc(tokens[index]);
        tokensToDelete.push(tokenRef.delete());
      }
    }
  });
  return Promise.all(tokensToDelete);
}

