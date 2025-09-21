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
        link: "/dashboard-pro.html",
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
 * Triggers when a client request is updated.
 * Checks for status changes OR ETA updates and sends the correct notification.
 */
exports.notifyClientOnStatusChange = onDocumentUpdated("clientRequests/{requestId}", async (event) => {
  if (!event.data) {
    logger.log("No data associated with the event for", event.params.requestId);
    return;
  }
  const before = event.data.before.data();
  const after = event.data.after.data();
  const clientId = after.clientId;

  if (!clientId) {
    logger.log("No clientId found in the request, cannot send notification.");
    return;
  }

  let payloadToSend = null;

  // Check 1: Did the ETA change?
  const etaWasAddedOrChanged = after.etaDate && (before.etaDate !== after.etaDate || before.etaTime !== after.etaTime);
  if (etaWasAddedOrChanged) {
    const etaDateFormatted = new Date(after.etaDate).toLocaleDateString('he-IL');
    payloadToSend = {
      notification: {
        title: "🚚 עדכון צפי הגעה",
        body: `צפי ההגעה לבקשתך עודכן ל-${etaDateFormatted} בשעה ${after.etaTime}.`,
        icon: "https://i.postimg.cc/2SbDgD1B/1.png",
      },
      webpush: { fcmOptions: { link: "/" } },
    };
  }
  // Check 2: Did the status change? (Use 'else if' to avoid sending two notifications for one update)
  else if (before.status !== after.status) {
    let statusMessage = "";
    const managerName = after.handledBy || "מחלקת ההזמנות";
    if (after.status === "in-progress") {
      statusMessage = `${managerName} החל/ה לטפל בבקשה שלך.`;
    } else if (after.status === "completed") {
      statusMessage = `הבקשה שלך הושלמה על ידי ${managerName}. תודה!`;
    }

    if (statusMessage) {
      payloadToSend = {
        notification: {
          title: "עדכון סטטוס הזמנה",
          body: statusMessage,
          icon: "https://i.postimg.cc/2SbDgD1B/1.png",
        },
        webpush: { fcmOptions: { link: "/" } },
      };
    }
  }

  // If we have a payload, find the client's token and send it.
  if (payloadToSend) {
    const clientDoc = await admin.firestore().collection("clients").doc(clientId).get();
    if (!clientDoc.exists || !clientDoc.data().fcmToken) {
      logger.log(`Client ${clientId} has no FCM token.`);
      return;
    }
    const clientToken = clientDoc.data().fcmToken;

    logger.log(`Sending notification to client ${clientId}`);
    const response = await admin.messaging().sendToDevice([clientToken], payloadToSend);
    await cleanupInvalidTokens(response, [clientToken], "clients", clientId);
  } else {
    logger.log(`No relevant changes for notification on request ${event.params.requestId}.`);
  }
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
          // For clients, we just nullify the token, not delete the doc
          tokensToDelete.push(admin.firestore().collection(collectionName).doc(docId).update({ fcmToken: null }));
        } else {
          // For dashboard tokens, we delete the token document
          tokensToDelete.push(admin.firestore().collection(collectionName).doc(tokens[index]).delete());
        }
      }
    }
  });
  return Promise.all(tokensToDelete);
}
