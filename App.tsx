
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  Activity, 
  ViewName, 
  AppSettings
} from './types';
import { dbService } from './services/db';
import { THEMES, DEFAULT_SETTINGS } from './constants';
import { Dashboard } from './components/Dashboard';
import { Editor } from './components/Editor';
import { Sidebar } from './components/Sidebar';
import { Settings } from './components/Settings';
import { ConfirmationModal } from './components/ConfirmationModal';
import { Onboarding } from './components/Onboarding';
import { DonationPrompt } from './components/DonationPrompt';
import { Menu, WifiOff } from 'lucide-react';
import { Analytics } from "@vercel/analytics/react";

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewName>(ViewName.Dashboard);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showDonationPrompt, setShowDonationPrompt] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDangerous: boolean;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    isDangerous: false,
    onConfirm: () => {},
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('scripta_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const lastClipboardRef = useRef<string>('');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    
    // Offline status handlers
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const visited = localStorage.getItem('scripta_visited');
    if (!visited) {
        setShowOnboarding(true);
    } else {
        const lastPrompt = localStorage.getItem('last_donation_prompt');
        const now = new Date().getTime();
        const fiveDays = 5 * 24 * 60 * 60 * 1000;
        
        if (!lastPrompt || now - parseInt(lastPrompt) > fiveDays) {
            setTimeout(() => setShowDonationPrompt(true), 2000);
        }
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const completeOnboarding = (analyticsEnabled: boolean) => {
      setSettings(prev => ({ ...prev, enableAnalytics: analyticsEnabled }));
      localStorage.setItem('scripta_visited', 'true');
      setShowOnboarding(false);
  };

  const closeDonationPrompt = () => {
      localStorage.setItem('last_donation_prompt', new Date().getTime().toString());
      setShowDonationPrompt(false);
  }

  useEffect(() => {
    const checkClipboard = async () => {
        if (currentView !== ViewName.Dashboard) return;
        if (!document.hasFocus()) return;
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.trim().length > 10 && text !== lastClipboardRef.current) {
                lastClipboardRef.current = text;
                setConfirmState({
                    isOpen: true,
                    title: 'Clipboard Detected',
                    message: 'Would you like to create a new activity from the text in your clipboard?',
                    confirmLabel: 'Create Activity',
                    isDangerous: false,
                    onConfirm: () => handleCreateActivity(text)
                });
            }
        } catch (e) {}
    };
    window.addEventListener('focus', checkClipboard);
    return () => window.removeEventListener('focus', checkClipboard);
  }, [currentView]);

  const loadActivities = useCallback(async () => {
    const data = await dbService.getAllActivities();
    setActivities(data);
  }, []);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  useEffect(() => {
    const themeColors = THEMES[settings.theme][settings.mode];
    const root = document.documentElement;
    Object.entries(themeColors).forEach(([key, value]) => {
      root.style.setProperty(key, value as string);
    });
    if (settings.mode === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    root.style.fontSize = `${settings.fontScale}px`;
    localStorage.setItem('scripta_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
      const handleDashboardAction = async (e: Event) => {
          const detail = (e as CustomEvent).detail;
          if (detail.action === 'duplicate') await dbService.duplicateActivity(detail.id);
          else if (detail.action === 'set-color') {
              const act = await dbService.getActivity(detail.id);
              if (act) await dbService.saveActivity({ ...act, flatColor: detail.color, updatedAt: new Date().toISOString() });
          } else if (detail.action === 'archive') await dbService.archiveActivity(detail.id);
          loadActivities();
      };
      window.addEventListener('dashboard-action', handleDashboardAction);
      return () => window.removeEventListener('dashboard-action', handleDashboardAction);
  }, [loadActivities]);

  const handleCreateActivity = async (initialContent = '') => {
    const newActivity: Activity = {
      id: crypto.randomUUID(),
      title: initialContent ? 'Clipboard Note' : '',
      content: initialContent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      wordCount: initialContent ? initialContent.trim().split(/\s+/).length : 0,
      linkedActivityIds: [],
      archived: false,
      deleted: false,
    };
    await dbService.saveActivity(newActivity);
    setActivities([newActivity, ...activities]);
    setCurrentActivity(newActivity);
    setCurrentView(ViewName.Editor);
    if(isMobile) setIsSidebarOpen(false);
  };

  const handleSelectActivity = (activity: Activity) => {
    setCurrentActivity(activity);
    setCurrentView(ViewName.Editor);
    if(isMobile) setIsSidebarOpen(false);
  };

  const handleSaveActivity = async (updatedActivity: Activity) => {
    await dbService.saveActivity(updatedActivity);
    setActivities(prev => prev.map(a => a.id === updatedActivity.id ? updatedActivity : a));
    setCurrentActivity(updatedActivity);
  };

  const handleSoftDelete = async (id: string) => {
    await dbService.softDeleteActivity(id);
    loadActivities();
  };

  const handleRestore = async (id: string) => {
    await dbService.restoreActivity(id);
    loadActivities();
  };

  const handleDeletePermanently = async (id: string) => {
      await dbService.deleteActivity(id);
      loadActivities();
  }

  const handleClearData = async () => {
      setConfirmState({
          isOpen: true,
          title: 'Delete All Data?',
          message: 'CRITICAL: This will permanently delete ALL your activities and settings. This action CANNOT be undone.',
          isDangerous: true,
          confirmLabel: 'Delete Everything',
          onConfirm: async () => {
              const all = await dbService.getAllActivities();
              for(const a of all) await dbService.deleteActivity(a.id);
              loadActivities();
              setCurrentView(ViewName.Dashboard);
          }
      });
  };

  const renderView = () => {
    switch (currentView) {
      case ViewName.Dashboard:
        return <Dashboard 
                  activities={activities} 
                  onSelect={handleSelectActivity} 
                  onCreate={() => handleCreateActivity()} 
                  onDelete={handleSoftDelete} 
                  onRestore={handleRestore} 
                  cardDensity={settings.cardDensity}
                  isDarkMode={settings.mode === 'dark'}
               />;
      case ViewName.Archive:
        return <Dashboard 
                  activities={activities} 
                  onSelect={handleSelectActivity} 
                  onCreate={() => handleCreateActivity()} 
                  onDelete={handleDeletePermanently} 
                  onRestore={handleRestore} 
                  isArchiveView={true} 
                  cardDensity={settings.cardDensity}
                  isDarkMode={settings.mode === 'dark'}
               />;
      case ViewName.Trash:
        return <Dashboard 
                  activities={activities} 
                  onSelect={() => {}} 
                  onCreate={() => handleCreateActivity()} 
                  onDelete={handleDeletePermanently} 
                  onRestore={handleRestore} 
                  isTrashView={true} 
                  cardDensity={settings.cardDensity}
                  isDarkMode={settings.mode === 'dark'}
               />;
      case ViewName.Editor:
        return currentActivity ? (
          <Editor 
            activity={currentActivity}
            onSave={handleSaveActivity}
            onBack={() => { setCurrentView(ViewName.Dashboard); loadActivities(); }}
            showWordCount={settings.showWordCount}
            allActivities={activities}
            onSwitchActivity={handleSelectActivity}
          />
        ) : <div className="p-10 text-center">Activity not found</div>;
      case ViewName.Settings:
        return <Settings settings={settings} onUpdateSettings={setSettings} onClearData={handleClearData} />;
      default:
        return <div>View not implemented</div>;
    }
  };

  return (
    <div className="h-full flex relative overflow-hidden bg-background text-surface-fg transition-colors duration-300">
        
        {settings.enableAnalytics && <Analytics />}
        
        {isOffline && (
            <div className="fixed top-0 left-0 w-full bg-red-500/10 backdrop-blur-md text-red-500 text-xs font-bold uppercase tracking-widest text-center py-1 z-[200] border-b border-red-500/20 flex items-center justify-center gap-2">
                <WifiOff size={12} /> Offline Mode
            </div>
        )}
        
        {showOnboarding && <Onboarding onComplete={completeOnboarding} />}
        {showDonationPrompt && !showOnboarding && <DonationPrompt onClose={closeDonationPrompt} />}

        <Sidebar 
           isOpen={isSidebarOpen} 
           onClose={() => setIsSidebarOpen(false)} 
           currentView={currentView} 
           onChangeView={(view) => { setCurrentView(view); }}
           isMobile={isMobile}
        />

        <div className={`flex-1 flex flex-col h-full relative z-0 transition-all duration-300 ease-in-out ${isSidebarOpen && !isMobile ? 'ml-72' : 'ml-0'}`}>
           {currentView !== ViewName.Editor && (!isSidebarOpen || isMobile) && (
             <div className="absolute top-4 left-4 z-20">
                <button onClick={() => setIsSidebarOpen(true)} className="p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors shadow-sm bg-surface/50 backdrop-blur-md">
                    <Menu size={24} className="text-primary"/>
                </button>
             </div>
           )}
           <div className={`h-full ${currentView !== ViewName.Editor ? 'pt-16 sm:pt-0' : ''}`}>
               {renderView()}
           </div>
        </div>

        <ConfirmationModal 
            isOpen={confirmState.isOpen}
            title={confirmState.title}
            message={confirmState.message}
            isDangerous={confirmState.isDangerous}
            confirmLabel={confirmState.confirmLabel}
            onConfirm={confirmState.onConfirm}
            onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        />
    </div>
  );
};

export default App;
