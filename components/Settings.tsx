
import React, { useEffect, useState, useRef } from 'react';
import { AppSettings, ThemeName } from '../types';
import { Button } from './Button';
import { Toggle } from './Toggle';
import { Moon, Sun, Trash, Type, Database, Download, Upload, Shield, Heart, HelpCircle, AlertTriangle, Check, Loader2, Info, Eye } from 'lucide-react';
import { exportData, parseImportFile } from '../utils/dataTransfer';
import { dbService } from '../services/db';

interface SettingsProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onClearData: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onUpdateSettings, onClearData }) => {
  const [dbSize, setDbSize] = useState<string>('Calculated...');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Estimate usage
    if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(estimate => {
            const usage = estimate.usage || 0;
            if (usage < 1024 * 1024) setDbSize(`${(usage / 1024).toFixed(1)} KB`);
            else setDbSize(`${(usage / (1024 * 1024)).toFixed(1)} MB`);
        });
    }
  }, []);

  const handleThemeChange = (name: ThemeName) => {
    onUpdateSettings({ ...settings, theme: name });
  };

  const toggleMode = () => {
    onUpdateSettings({ ...settings, mode: settings.mode === 'light' ? 'dark' : 'light' });
  };

  const handleExport = async () => {
      setIsProcessing(true);
      setStatusMsg(null);
      try {
          const activities = await dbService.getAllActivities();
          exportData(activities);
          setStatusMsg({ type: 'success', text: 'Backup downloaded successfully.' });
      } catch (err) {
          setStatusMsg({ type: 'error', text: 'Failed to export data.' });
      } finally {
          setIsProcessing(false);
      }
  };

  const handleImportClick = () => {
      setStatusMsg(null);
      fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsProcessing(true);
      try {
          const activities = await parseImportFile(file);
          
          if (window.confirm(`Found ${activities.length} activities in backup. Merge them with your current data?`)) {
              let importedCount = 0;
              for (const activity of activities) {
                  await dbService.saveActivity(activity);
                  importedCount++;
              }
              setStatusMsg({ type: 'success', text: `Successfully imported ${importedCount} activities.` });
              setTimeout(() => window.location.reload(), 1500); 
          } else {
              setStatusMsg({ type: 'info', text: 'Import cancelled.' });
          }
      } catch (err) {
          setStatusMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to parse backup file.' });
      } finally {
          setIsProcessing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto px-6 w-full animate-fade-in pt-6 pb-20 overflow-y-auto no-scrollbar">
      <h1 className="text-3xl font-display font-bold mb-8">Settings</h1>

      {/* Appearance */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 opacity-70"><Sun size={18}/> Appearance</h2>
        <div className="bg-surface rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark Mode</p>
              <p className="text-sm opacity-50">Switch between light and dark themes</p>
            </div>
            <button 
              onClick={toggleMode}
              className="p-3 bg-background rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              {settings.mode === 'light' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>

          <div className="space-y-3">
             <p className="font-medium">Theme Color</p>
             <div className="flex flex-wrap gap-3">
               {Object.values(ThemeName).map((name) => (
                 <button
                   key={name}
                   onClick={() => handleThemeChange(name)}
                   className={`px-4 py-2 rounded-lg text-sm transition-all border ${
                     settings.theme === name 
                      ? 'bg-primary text-primary-fg border-primary font-medium shadow-md' 
                      : 'bg-background hover:bg-black/5 border-transparent'
                   }`}
                 >
                   {name}
                 </button>
               ))}
             </div>
          </div>
        </div>
      </section>

      {/* Typography & Editor */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 opacity-70"><Type size={18}/> Editor & Customization</h2>
        <div className="bg-surface rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
                 <div>
                    <p className="font-medium flex items-center gap-2"><Eye size={16} className="opacity-70"/> Live Markdown</p>
                    <p className="text-sm opacity-50">Hide markdown tags until you edit the line.</p>
                 </div>
                 <Toggle 
                    checked={settings.livePreview} 
                    onChange={(checked) => onUpdateSettings({...settings, livePreview: checked})}
                 />
            </div>

            <hr className="border-black/5 dark:border-white/5"/>

            <div>
                <div className="flex justify-between mb-2">
                    <span className="font-medium">Text Size</span>
                    <span className="text-sm opacity-50">{settings.fontScale}px</span>
                </div>
                <input 
                    type="range" 
                    min="14" 
                    max="22" 
                    step="1"
                    value={settings.fontScale}
                    onChange={(e) => onUpdateSettings({ ...settings, fontScale: parseInt(e.target.value) })}
                    className="w-full accent-primary h-2 bg-background rounded-lg appearance-none cursor-pointer"
                />
            </div>
            <div className="flex items-center justify-between">
                 <div>
                    <p className="font-medium">Card Density</p>
                    <p className="text-sm opacity-50">Adjust spacing of lists and cards</p>
                 </div>
                 <div className="flex bg-background rounded-lg p-1">
                     <button 
                        onClick={() => onUpdateSettings({...settings, cardDensity: 'comfortable'})}
                        className={`px-3 py-1.5 rounded-md text-sm transition-all ${settings.cardDensity === 'comfortable' ? 'bg-surface shadow-sm font-medium' : 'opacity-50'}`}
                     >
                        Comfortable
                     </button>
                     <button 
                        onClick={() => onUpdateSettings({...settings, cardDensity: 'compact'})}
                        className={`px-3 py-1.5 rounded-md text-sm transition-all ${settings.cardDensity === 'compact' ? 'bg-surface shadow-sm font-medium' : 'opacity-50'}`}
                     >
                        Compact
                     </button>
                 </div>
            </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 opacity-70"><Shield size={18}/> Privacy</h2>
        <div className="bg-surface rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
                 <div>
                    <p className="font-medium flex items-center gap-2">Anonymous Analytics</p>
                    <p className="text-sm opacity-50">Allow Scripta to collect anonymous usage statistics.</p>
                 </div>
                 <Toggle 
                    checked={settings.enableAnalytics} 
                    onChange={(checked) => onUpdateSettings({...settings, enableAnalytics: checked})}
                 />
            </div>
        </div>
      </section>

      {/* About Scripta */}
      <section className="mb-8">
         <h2 className="text-lg font-bold mb-4 flex items-center gap-2 opacity-70"><HelpCircle size={18}/> About Scripta</h2>
         <div className="bg-surface rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-sm space-y-4">
            <button onClick={() => setShowAboutModal(true)} className="w-full flex items-center justify-between group p-2 hover:bg-background rounded-lg transition-colors text-left">
                <div className="flex items-center gap-3">
                    <Info size={20} className="text-primary opacity-70"/>
                    <span>About, Privacy & Terms</span>
                </div>
                <div className="px-3 py-1 bg-black/5 dark:bg-white/5 rounded-full text-xs font-bold opacity-50 group-hover:opacity-100">View</div>
            </button>
            <a href="mailto:support@scripta.app" className="flex items-center justify-between group p-2 hover:bg-background rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                    <Heart size={20} className="text-red-500 opacity-70"/>
                    <span>Support & Feedback</span>
                </div>
                <div className="px-3 py-1 bg-black/5 dark:bg-white/5 rounded-full text-xs font-bold opacity-50 group-hover:opacity-100">Email</div>
            </a>
         </div>
      </section>

      {/* Storage & Danger */}
      <section className="mb-10">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 opacity-70"><Database size={18}/> Data Management</h2>
        <div className="bg-surface rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
                <span className="font-medium">Storage Usage</span>
                <span className="text-sm opacity-50 font-mono">{dbSize}</span>
            </div>

            {statusMsg && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${
                    statusMsg.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' :
                    statusMsg.type === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300' :
                    'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                }`}>
                    {statusMsg.type === 'success' && <Check size={20} />}
                    {statusMsg.type === 'error' && <AlertTriangle size={20} />}
                    {statusMsg.type === 'info' && <Info size={20} />}
                    <span className="text-sm font-medium">{statusMsg.text}</span>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <Button variant="secondary" onClick={handleExport} disabled={isProcessing} icon={isProcessing ? <Loader2 size={18} className="animate-spin"/> : <Download size={18}/>}>
                    {isProcessing ? 'Processing...' : 'Export Backup'}
                </Button>
                <Button variant="secondary" onClick={handleImportClick} disabled={isProcessing} icon={isProcessing ? <Loader2 size={18} className="animate-spin"/> : <Upload size={18}/>}>
                    {isProcessing ? 'Processing...' : 'Import Backup'}
                </Button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".json" 
                    onChange={handleFileChange}
                />
            </div>

            <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20 mt-4">
                <div className="flex items-start gap-3">
                    <Trash className="text-red-500 shrink-0 mt-1" size={20}/>
                    <div>
                        <h3 className="font-bold text-red-600 dark:text-red-400">Delete All Data</h3>
                        <p className="text-sm opacity-70 mb-4 mt-1 leading-relaxed">
                            This action is irreversible. It will permanently delete all activities, history, and reset your settings.
                        </p>
                        <Button variant="danger" onClick={onClearData} className="w-full sm:w-auto">
                            Delete Everything
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* About Modal */}
      {showAboutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowAboutModal(false)}>
              <div className="bg-surface max-w-lg w-full max-h-[80vh] overflow-y-auto rounded-3xl p-8 shadow-2xl animate-slide-up border border-white/10" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-display font-bold text-primary">Scripta</h2>
                      <button onClick={() => setShowAboutModal(false)} className="p-2 hover:bg-black/5 rounded-full"><AlertTriangle size={20} className="opacity-0"/><span className="sr-only">Close</span><div className="i-lucide-x"></div></button>
                  </div>
                  
                  <div className="space-y-6 text-sm leading-relaxed opacity-80">
                      <div>
                          <h3 className="font-bold text-lg mb-2 text-surface-fg">About</h3>
                          <p>Scripta is an offline-first, distraction-free writing and thinking workspace. It is designed to help you capture thoughts quickly and link them together to form a personal knowledge base.</p>
                      </div>
                      
                      <div>
                          <h3 className="font-bold text-lg mb-2 text-surface-fg">Privacy Policy</h3>
                          <p>Scripta operates entirely on your device. Your data is stored in your browser's IndexedDB and is never sent to any server unless you explicitly enable anonymous analytics. We do not track your personal information or content.</p>
                      </div>

                      <div className="pt-4 border-t border-black/10 dark:border-white/10">
                          <p className="text-xs opacity-50">Version 1.1.0 &bull; Local Storage Only &bull; Offline Ready</p>
                      </div>
                  </div>
                  
                  <div className="mt-8">
                      <Button onClick={() => setShowAboutModal(false)} className="w-full">Close</Button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
