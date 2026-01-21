import React, { useEffect, useState, useRef } from 'react';
import { AppSettings, ThemeName } from '../types';
import { Button } from './Button';
import { Toggle } from './Toggle';
import { Moon, Sun, Trash, Type, Smartphone, Database, Download, Upload, Shield, Heart, HelpCircle, ExternalLink, FileText } from 'lucide-react';
import { exportData, parseImportFile } from '../utils/dataTransfer.ts';
import { dbService } from '../services/db';

interface SettingsProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onClearData: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onUpdateSettings, onClearData }) => {
  const [dbSize, setDbSize] = useState<string>('Calculated...');
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
      const activities = await dbService.getAllActivities();
      exportData(activities);
  };

  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!window.confirm("Importing data will merge with your existing activities. Continue?")) {
          e.target.value = '';
          return;
      }

      try {
          const activities = await parseImportFile(file);
          // Insert all
          for (const activity of activities) {
              await dbService.saveActivity(activity);
          }
          alert(`Successfully imported ${activities.length} activities.`);
          window.location.reload(); 
      } catch (err) {
          alert('Failed to import: ' + err);
      }
      e.target.value = '';
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

      {/* Typography & Layout */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 opacity-70"><Type size={18}/> Customization</h2>
        <div className="bg-surface rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-sm space-y-6">
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

      {/* About Scripta */}
      <section className="mb-8">
         <h2 className="text-lg font-bold mb-4 flex items-center gap-2 opacity-70"><Shield size={18}/> About Scripta</h2>
         <div className="bg-surface rounded-2xl p-6 border border-black/5 dark:border-white/5 shadow-sm space-y-4">
            <a href="https://scripta.landecs.org/about" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between group p-2 hover:bg-background rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                    <HelpCircle size={20} className="text-primary opacity-70"/>
                    <span>About Scripta</span>
                </div>
                <ExternalLink size={16} className="opacity-30 group-hover:opacity-100 transition-opacity"/>
            </a>
            <a href="https://scripta.landecs.org/privacy" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between group p-2 hover:bg-background rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                    <Shield size={20} className="text-primary opacity-70"/>
                    <span>Privacy Policy</span>
                </div>
                <ExternalLink size={16} className="opacity-30 group-hover:opacity-100 transition-opacity"/>
            </a>
            <a href="https://scripta.landecs.org/terms" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between group p-2 hover:bg-background rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                    <FileText size={20} className="text-primary opacity-70"/>
                    <span>Terms of Use</span>
                </div>
                <ExternalLink size={16} className="opacity-30 group-hover:opacity-100 transition-opacity"/>
            </a>
            <a href="https://www.landecs.org/docs/donation" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between group p-2 hover:bg-background rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                    <Heart size={20} className="text-red-500 opacity-70"/>
                    <span>Support & Donate</span>
                </div>
                <ExternalLink size={16} className="opacity-30 group-hover:opacity-100 transition-opacity"/>
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

            <div className="grid grid-cols-2 gap-4">
                <Button variant="secondary" onClick={handleExport} icon={<Download size={18}/>}>
                    Export Backup
                </Button>
                <Button variant="secondary" onClick={handleImportClick} icon={<Upload size={18}/>}>
                    Import Backup
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
    </div>
  );
};