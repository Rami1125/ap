const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Triggers when a new client request is created.
 * Sends a push notification to all registered dashboard devices.
 */
exports.sendPushNotificationOnNewRequest = onDocumentCreated("clientRequests/{requestId}", async (event) => {
  const snap = event.data;
  if (!snap) {
    logger.log("No data associated with the event");
    return;
  }
  const newRequest = snap.data();
  const payload = {
    notification: {
      title: "🔔 בקשה חדשה התקבלה!",
      body: `מאת: ${newRequest.clientName} | סוג: ${newRequest.requestType}`,
      icon: "https://i.postimg.cc/2SbDgD1B/1.png",
    },
    webpush: {
      fcmOptions: {
        link: "/dashboard.html",
      },
    },
  };

  const tokensSnapshot = await admin.firestore().collection("dashboardTokens").get();
  if (tokensSnapshot.empty) {
    logger.log("No dashboard tokens to send notification to.");
    return;
  }

  const tokens = tokensSnapshot.docs.map((doc) => doc.id);
  logger.log(`Sending notification to ${tokens.length} dashboard(s).`);
  const response = await admin.messaging().sendToDevice(tokens, payload);
  await cleanupInvalidTokens(response, tokens, "dashboardTokens");
});

/**
 * --- UPDATED FUNCTION ---
 * Triggers when a client request status is updated.
 * Sends a personalized push notification to the specific client.
 */
exports.notifyClientOnStatusChange = onDocumentUpdated("clientRequests/{requestId}", async (event) => {
  if (!event.data) {
    logger.log("No data associated with the event");
    return;
  }
  const before = event.data.before.data();
  const after = event.data.after.data();

  // Only send a notification if the status actually changed
  if (before.status === after.status) {
    logger.log("Status unchanged, no notification sent.");
    return;
  }

  const clientId = after.clientId;
  if (!clientId) {
    logger.log("No clientId found in the request, cannot send notification.");
    return;
  }

  const clientDoc = await admin.firestore().collection("clients").doc(clientId).get();
  if (!clientDoc.exists || !clientDoc.data().fcmToken) {
    logger.log(`Client ${clientId} has no FCM token.`);
    return;
  }
  const clientToken = clientDoc.data().fcmToken;

  let statusMessage = "";
  // --- NEW LOGIC: Create personalized message ---
  const managerName = after.handledBy || "מחלקת ההזמנות";
  if (after.status === "in-progress") {
    statusMessage = `${managerName} החל/ה לטפל בבקשה שלך.`;
  } else if (after.status === "completed") {
    statusMessage = `הבקשה שלך הושלמה על ידי ${managerName}. תודה!`;
  } else {
    return; // Don't send notifications for other statuses like 'new'
  }
  
  const payload = {
    notification: {
      title: "עדכון סטטוס הזמנה",
      body: statusMessage,
      icon: "https://i.postimg.cc/2SbDgD1B/1.png",
    },
    webpush: {
      fcmOptions: {
        link: "/", // Link to the client's home page
      },
    },
  };

  logger.log(`Sending status update to client ${clientId}`);
  const response = await admin.messaging().sendToDevice([clientToken], payload);
  await cleanupInvalidTokens(response, [clientToken], "clients", clientId);
});

/**
 * Helper function to remove invalid FCM tokens from Firestore.
 */
async function cleanupInvalidTokens(response, tokens, collectionName, docId = null) {
  const tokensToDelete = [];
  response.results.forEach((result, index) => {
    const error = result.error;
    if (error) {
      logger.error("Failure sending notification to", tokens[index], error);
      if (
        error.code === "messaging/invalid-registration-token" ||
        error.code === "messaging/registration-token-not-registered"
      ) {
        if (collectionName === "clients" && docId) {
          tokensToDelete.push(admin.firestore().collection(collectionName).doc(docId).update({ fcmToken: null }));
        } else {
          tokensToDelete.push(admin.firestore().collection(collectionName).doc(tokens[index]).delete());
        }
      }
    }
  });
  return Promise.all(tokensToDelete);
}

