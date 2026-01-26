import React, { useEffect, useState } from 'react';
import { ViewName } from '../types';
import { LayoutDashboard, Archive, Trash2, Settings, Download, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: ViewName;
  onChangeView: (view: ViewName) => void;
  isMobile: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentView, onChangeView, isMobile }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult: any) => {
            if (choiceResult.outcome === 'accepted') {
                setDeferredPrompt(null);
            }
        });
    }
  };

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', view: ViewName.Dashboard },
    { icon: <Archive size={20} />, label: 'Archive', view: ViewName.Archive },
    { icon: <Trash2 size={20} />, label: 'Trash', view: ViewName.Trash },
    { icon: <Settings size={20} />, label: 'Settings', view: ViewName.Settings },
  ];

  const drawerClasses = `fixed inset-y-0 left-0 z-50 w-72 bg-surface text-surface-fg shadow-2xl transform transition-transform duration-500 ease-fluid flex flex-col border-r border-black/5 dark:border-white/5
    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
  `;

  return (
    <>
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-500"
          onClick={onClose}
        />
      )}
      
      <div className={drawerClasses}>
        <div className="p-6 flex items-center justify-between bg-primary/5">
          <h2 className="font-display text-2xl font-bold text-primary tracking-tight">Scripta</h2>
          {isMobile && (
            <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
              <X size={20} />
            </button>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto bg-surface">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                onChangeView(item.view);
                if (isMobile) onClose();
              }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 ease-spring active:scale-95 ${
                currentView === item.view 
                  ? 'bg-primary text-primary-fg font-semibold shadow-md shadow-primary/20' 
                  : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70 hover:opacity-100'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-black/5 dark:border-white/5 bg-surface">
           {deferredPrompt ? (
               <button 
                  onClick={handleInstall}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-surface border border-primary/20 rounded-xl text-primary font-medium hover:bg-primary/5 transition-all active:scale-95 shadow-sm"
               >
                   <Download size={18}/>
                   Install App
               </button>
           ) : (
               <div className="text-center opacity-40 text-xs font-mono">
                   Scripta Web App
               </div>
           )}
        </div>
      </div>
    </>
  );
};