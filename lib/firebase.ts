// Fix: Use named import for initializeApp from the modular Firebase SDK
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * CONFIGURACIÓN DE FIREBASE (Web SDK)
 */
const firebaseConfig = {
  apiKey: "AIzaSyAxnOd-VYneSj7USsSEEuxFNhwgO5beHZs",
  authDomain: "swiftinvoice-63a0b.firebaseapp.com",
  projectId: "swiftinvoice-63a0b",
  storageBucket: "swiftinvoice-63a0b.firebasestorage.app",
  messagingSenderId: "196185538050",
  appId: "1:196185538050:web:baaa3e5852ca70c62db11b"
};

// Inicialización del servicio Firebase App
const app = initializeApp(firebaseConfig);

// Exportación de servicios para uso en toda la aplicación
export const auth = getAuth(app);
export const db = getFirestore(app);

// Verificación de seguridad para asegurar que la API Key no sea el marcador de posición
if (firebaseConfig.apiKey.includes("TU_API_KEY")) {
  console.warn("⚠️ SwiftInvoice: Falta configurar las claves en lib/firebase.ts");
}
