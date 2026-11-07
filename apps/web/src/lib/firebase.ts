import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { logger } from "./logger";

// Configuração do Firebase - usando estritamente variáveis de ambiente (.env)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

if (!firebaseConfig.apiKey && import.meta.env.PROD) {
  console.error("⚠️ Configurações do Firebase ausentes no ambiente de produção. Verifique as variáveis de ambiente.");
}

// Debug: verificar configuração do Firebase (apenas em desenvolvimento)
if (import.meta.env.DEV) {
  logger.debug('Firebase Config Debug', {
    hasApiKey: !!firebaseConfig.apiKey,
    hasAuthDomain: !!firebaseConfig.authDomain,
    hasProjectId: !!firebaseConfig.projectId,
    usingEnvVars: !!import.meta.env.VITE_FIREBASE_API_KEY
  });
}

// Inicializa o aplicativo Firebase
const app = initializeApp(firebaseConfig);

import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";

// Inicializa os serviços do Firebase e os exporta para serem usados em outros lugares
const auth = getAuth(app);
const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  experimentalAutoDetectLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// App Check - Placeholder para configuração futura via Console
// import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
// if (typeof window !== 'undefined') {
//   initializeAppCheck(app, {
//     provider: new ReCaptchaEnterpriseProvider('SITE_KEY'),
//     isTokenAutoRefreshEnabled: true
//   });
// }

// Inicializa Firebase Functions com configuração específica para evitar problemas de CORS
const functions = getFunctions(app, 'us-central1'); 

import { getStorage } from "firebase/storage";
const storage = getStorage(app);

// Exporta as instâncias prontas
export { app, auth, db, functions, storage };