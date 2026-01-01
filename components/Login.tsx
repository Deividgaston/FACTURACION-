import React, { useState } from 'react';
import { Lock, ShieldCheck, ArrowRight, KeyRound, Mail } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface LoginProps {
  onAuthenticated: () => void;
}

const Login: React.FC<LoginProps> = ({ onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // En Firebase no existe “setup” local; lo modelamos como modo registro
  const [isRegister, setIsRegister] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Introduce tu email.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }

      // Compatibilidad temporal con tu App actual (luego lo quitamos)
      sessionStorage.setItem('si_session', 'active');

      onAuthenticated();
    } catch (err: any) {
      const code = err?.code as string | undefined;

      if (code === 'auth/user-not-found') {
        setError('No existe ese usuario. Cambia a "Crear cuenta" o revisa el email.');
      } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Credenciales incorrectas. Revisa email y contraseña.');
      } else if (code === 'auth/email-already-in-use') {
        setError('Ese email ya está registrado. Cambia a "Entrar".');
      } else if (code === 'auth/invalid-email') {
        setError('Email no válido.');
      } else if (code === 'auth/too-many-requests') {
        setError('Demasiados intentos. Espera un momento y vuelve a intentarlo.');
      } else {
        setError('Error de autenticación. Revisa la configuración de Firebase.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-[2.5rem] shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/30 mb-4">
            {isRegister ? <ShieldCheck size={32} /> : <Lock size={32} />}
          </div>

          <h1 className="text-2xl font-black text-white text-center">
            {isRegister ? 'Crear cuenta' : 'SwiftInvoice Pro'}
          </h1>

          <p className="text-slate-400 text-sm text-center mt-2">
            {isRegister
              ? 'Crea tu usuario para empezar a guardar datos en la nube.'
              : 'Accede con tu email y contraseña.'}
          </p>
        </div>

        <form onSubmit={handleAction} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                autoFocus
                autoComplete="email"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
              />
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs font-bold bg-red-400/10 p-3 rounded-xl border border-red-400/20 text-center animate-shake">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-60"
          >
            {loading ? 'Procesando...' : (isRegister ? 'Crear cuenta' : 'Entrar')}
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => { setError(''); setIsRegister(!isRegister); }}
            className="text-slate-300 text-sm hover:text-white transition-colors"
          >
            {isRegister ? '¿Ya tienes cuenta? Entrar' : '¿No tienes cuenta? Crear cuenta'}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">
            Acceso con Firebase Auth
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
