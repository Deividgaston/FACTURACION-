
import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, ArrowRight, KeyRound } from 'lucide-react';
import { store } from '../lib/store';

interface LoginProps {
  onAuthenticated: () => void;
}

const Login: React.FC<LoginProps> = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const savedPass = localStorage.getItem('si_master_password');
    if (!savedPass) {
      setIsSetup(true);
    }
  }, []);

  const handleAction = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isSetup) {
      if (password.length < 4) {
        setError('La contraseña debe tener al menos 4 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
      localStorage.setItem('si_master_password', btoa(password)); // Simple encoding for demo/static
      sessionStorage.setItem('si_session', 'active');
      onAuthenticated();
    } else {
      const savedPass = localStorage.getItem('si_master_password');
      if (btoa(password) === savedPass) {
        sessionStorage.setItem('si_session', 'active');
        onAuthenticated();
      } else {
        setError('Contraseña incorrecta. Inténtalo de nuevo.');
        setPassword('');
      }
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
            {isSetup ? <ShieldCheck size={32} /> : <Lock size={32} />}
          </div>
          <h1 className="text-2xl font-black text-white text-center">
            {isSetup ? 'Configurar Acceso' : 'SwiftInvoice Pro'}
          </h1>
          <p className="text-slate-400 text-sm text-center mt-2">
            {isSetup 
              ? 'Establece una contraseña maestra para proteger tus facturas y datos de clientes.' 
              : 'Introduce tu clave de acceso para continuar.'}
          </p>
        </div>

        <form onSubmit={handleAction} className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="password" 
                placeholder={isSetup ? "Nueva contraseña" : "Contraseña maestra"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                autoFocus
              />
            </div>
          </div>

          {isSetup && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" 
                  placeholder="Confirmar contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-red-400 text-xs font-bold bg-red-400/10 p-3 rounded-xl border border-red-400/20 text-center animate-shake">
              {error}
            </p>
          )}

          <button 
            type="submit" 
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-lg shadow-indigo-500/20"
          >
            {isSetup ? 'Guardar y Entrar' : 'Desbloquear Acceso'}
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10 text-center">
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">
            Protección de Datos Local Storage
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
