import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * CONFIGURACIÓN DE FIREBASE (Web SDK)
 * Las claves se inyectan vía variables de entorno (Vite)
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Inicialización del servicio Firebase App
const app = initializeApp(firebaseConfig);

// Exportación de servicios para uso en toda la aplicación
export const auth = getAuth(app);
export const db = getFirestore(app);

// Aviso en desarrollo si faltan variables
if (!firebaseConfig.apiKey) {
  console.warn('⚠️ SwiftInvoice: Variables de entorno de Firebase no configuradas');
}
