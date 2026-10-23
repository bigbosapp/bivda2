import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { browserLocalPersistence, getAuth, setPersistence } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Konfigurasi klien Firebase memang berada di browser; akses data diamankan
// dengan Firebase Authentication dan Firestore Rules berdasarkan UID.
const firebaseConfig = {
  apiKey: "AIzaSyB3gZbhHWy67H9uSM1YduSi1S2cPrwQ_Mo",
  authDomain: "musicgo-d7c61.firebaseapp.com",
  projectId: "musicgo-d7c61",
  storageBucket: "musicgo-d7c61.firebasestorage.app",
  messagingSenderId: "651668722403",
  appId: "1:651668722403:web:41cd902cd5698b9c11ebd6",
  measurementId: "G-VR51P0BMQ1"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const authReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn("Persistensi login browser tidak tersedia:", error);
  return null;
});

// Cache persisten membantu refresh/offline dan beberapa tab pada perangkat
// yang sama. Data lintas perangkat tetap berasal dari Firestore di Cloud.
let firestore;
try {
  firestore = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (error) {
  console.warn("Cache persisten Firestore tidak tersedia; memakai cache standar:", error);
  firestore = getFirestore(firebaseApp);
}

export const db = firestore;
