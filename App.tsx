import React, { useState, useEffect, useCallback } from 'react';
import { NAVIGATION } from './constants';
import Dashboard from './components/Dashboard';
import InvoiceList from './components/InvoiceList';
import InvoiceEditor from './components/InvoiceEditor';
import ClientList from './components/ClientList';
import TemplateList from './components/TemplateList';
import SettingsView from './components/SettingsView';
import Login from './components/Login';
import { Menu, X, PlusCircle, LogOut } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ✅ key para “crear factura desde plantilla” sin tocar props todavía
const LS_NEW_INVOICE_TEMPLATE_ID = 'si_new_invoice_template_id';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } finally {
      setIsAuthenticated(false);
    }
  };

  // ✅ Centraliza el “crear nueva factura”
  const startNewInvoice = useCallback((templateId?: string | null) => {
    if (templateId) {
      localStorage.setItem(LS_NEW_INVOICE_TEMPLATE_ID, templateId);
    } else {
      localStorage.removeItem(LS_NEW_INVOICE_TEMPLATE_ID);
    }
    setEditingInvoiceId('new');
  }, []);

  const exitEditor = useCallback(() => {
    setEditingInvoiceId(null);
    localStorage.removeItem(LS_NEW_INVOICE_TEMPLATE_ID);
  }, []);

  // Evita parpadeo: esperamos a que Firebase diga si hay sesión o no
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-200">
        Cargando...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  const renderContent = () => {
    if (editingInvoiceId !== null) {
      return (
        <InvoiceEditor
          onBack={exitEditor}
          invoiceId={editingInvoiceId === 'new' ? undefined : editingInvoiceId}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            onNewInvoice={() => startNewInvoice(null)}
            onEditInvoice={(id) => setEditingInvoiceId(id)}
          />
        );
      case 'invoices':
        return (
          <InvoiceList
            onEdit={(id) => setEditingInvoiceId(id)}
            onNew={() => startNewInvoice(null)}
          />
        );
      case 'clients':
        return <ClientList />;
      case 'templates':
        // ✅ de momento TemplateList no recibe props.
        // En el siguiente archivo, le añadiremos un callback para usar: startNewInvoice(templateId)
        return <TemplateList />;
      case 'settings':
        return <SettingsView onLogout={handleLogout} />;
      default:
        return (
          <Dashboard
            onNewInvoice={() => startNewInvoice(null)}
            onEditInvoice={(id) => setEditingInvoiceId(id)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 animate-in fade-in duration-700">
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200 p-6 fixed h-full">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
            S
          </div>
          <span className="text-xl font-bold text-slate-800">SwiftInvoice</span>
        </div>

        <nav className="flex-1 space-y-1">
          {NAVIGATION.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                setActiveTab(item.path);
                setEditingInvoiceId(null);
                localStorage.removeItem(LS_NEW_INVOICE_TEMPLATE_ID);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium',
                activeTab === item.path && editingInvoiceId === null
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              )}
            >
              {item.icon}
              {item.name}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 space-y-3">
          <button
            onClick={() => startNewInvoice(null)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
          >
            <PlusCircle size={20} />
            Nueva Factura
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-red-500 py-2 text-sm transition-colors"
          >
            <LogOut size={16} />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 lg:ml-64 pb-20 lg:pb-0">
        <header className="lg:hidden bg-white border-b border-slate-200 p-4 sticky top-0 z-30 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
              S
            </div>
            <span className="text-lg font-bold text-slate-800">SwiftInvoice</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-600">
            <Menu size={24} />
          </button>
        </header>

        <div className="max-w-7xl mx-auto p-4 md:p-8">{renderContent()}</div>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-30 no-print">
          {NAVIGATION.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                setActiveTab(item.path);
                setEditingInvoiceId(null);
                localStorage.removeItem(LS_NEW_INVOICE_TEMPLATE_ID);
              }}
              className={cn(
                'flex flex-col items-center p-2 rounded-lg transition-all',
                activeTab === item.path && editingInvoiceId === null
                  ? 'text-indigo-600'
                  : 'text-slate-400'
              )}
            >
              {item.icon}
              <span className="text-[10px] font-medium mt-1">{item.name}</span>
            </button>
          ))}
        </nav>
      </main>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          <div
            className="absolute right-0 top-0 bottom-0 w-64 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-8">
              <span className="font-bold text-slate-400 uppercase tracking-widest text-xs">
                Gestión
              </span>
              <button onClick={() => setIsSidebarOpen(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="space-y-2">
              {NAVIGATION.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    setActiveTab(item.path);
                    setEditingInvoiceId(null);
                    localStorage.removeItem(LS_NEW_INVOICE_TEMPLATE_ID);
                    setIsSidebarOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium',
                    activeTab === item.path && editingInvoiceId === null
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-500'
                  )}
                >
                  {item.icon}
                  {item.name}
                </button>
              ))}
              <hr className="my-4 border-slate-100" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-500 hover:bg-red-50"
              >
                <LogOut size={20} />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
