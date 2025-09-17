const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendPushNotificationOnNewRequest = onDocumentCreated("clientRequests/{requestId}", async (event) => {
  const newRequest = event.data.data();
  const payload = {
    notification: {
      title: "🔔 בקשה חדשה התקבלה!",
      body: `מאת: ${newRequest.clientName} | סוג: ${newRequest.requestType}`,
      icon: "[https://i.postimg.cc/2SbDgD1B/1.png](https://i.postimg.cc/2SbDgD1B/1.png)",
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

exports.notifyClientOnStatusChange = onDocumentUpdated("clientRequests/{requestId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (before.status === after.status) return;

  const clientId = after.clientId;
  if (!clientId) return;

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
      icon: "[https://i.postimg.cc/2SbDgD1B/1.png](https://i.postimg.cc/2SbDgD1B/1.png)",
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
        tokensToDelete.push(admin.firestore().collection(collectionName).doc(docId).update({ fcmToken: null }));
      } else {
        tokensToDelete.push(admin.firestore().collection(collectionName).doc(tokens[index]).delete());
      }
    }
  });
  return Promise.all(tokensToDelete);
}
