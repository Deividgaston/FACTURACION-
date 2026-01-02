import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// 1) Lee envs de Vite
const env = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

// 2) (Opcional) Fallback hardcoded: descomenta si quieres blindarlo al 100%
// IMPORTANTE: esto NO es secreto, pero yo lo dejaría comentado si vas a mantener vars en GitHub.
/*
const FALLBACK = {
  apiKey: "AIzaSyAxnOd-VYneSj7USsSEEuxFNhwg05beHZs",
  authDomain: "swiftinvoice-63a0b.firebaseapp.com",
  projectId: "swiftinvoice-63a0b",
  storageBucket: "swiftinvoice-63a0b.firebasestorage.app",
  messagingSenderId: "196185538050",
  appId: "1:196185538050:web:baaa3e5852ca70c62db11b",
};
*/

// 3) Valida config (para evitar “funciona a medias”)
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
    // Esto te deja rastro claro en consola
    console.error('❌ Firebase config incompleto. Faltan:', missing);
    console.error('ℹ️ Revisa GitHub Actions vars (VITE_*) o descomenta el FALLBACK.');
    throw new Error(`Firebase config incompleto: faltan ${missing.join(', ')}`);
  }
}

const firebaseConfig = {
  apiKey: env.apiKey,
  authDomain: env.authDomain,
  projectId: env.projectId,
  storageBucket: env.storageBucket,
  messagingSenderId: env.messagingSenderId,
  appId: env.appId,

  // Si activas fallback:
  // ...(Object.values(env).some(v => !String(v ?? '').trim()) ? FALLBACK : {}),
};

assertFirebaseConfig(firebaseConfig);

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
