import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

function assertFirebaseConfig(cfg: Record<string, any>) {
  const required = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  const missing = required.filter((k) => !String(cfg[k] ?? '').trim());
  if (missing.length) {
    console.error('❌ Firebase config incompleto. Faltan:', missing);
    console.error('➡️ En GitHub: Settings → Secrets and variables → Actions → Variables');
    console.error('➡️ Y en el workflow: que se estén pasando como env (ya lo tienes).');
    throw new Error(`Firebase config incompleto: faltan ${missing.join(', ')}`);
  }
}

assertFirebaseConfig(firebaseConfig);

// ✅ LOG de verificación (no expone secretos, solo el destino)
console.info('✅ Firebase target:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain
});

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
