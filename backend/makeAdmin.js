// makeAdmin.js
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccount = require(path.join(__dirname, 'learninghub-7ac22-firebase-adminsdk-fbsvc-778c735521.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Replace with the UID of the user you want to make admin
const uid = "SpGnaJV7sRMiPJlTMvDHsiKcPHE3";

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log('✅ User is now an admin!');
    process.exit(0); // exit the script
  })
  .catch((err) => {
    console.error('❌ Error setting admin claim:', err);
    process.exit(1);
  });
