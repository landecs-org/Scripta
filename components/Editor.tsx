import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Activity } from '../types';
// Fixed: Added Clock to the lucide-react imports
import { ArrowLeft, ChevronDown, ChevronUp, Link as LinkIcon, Palette, X, BarChart2, Check, ExternalLink, Share2, Copy, FileText, Download, Mic, MicOff, Maximize2, Minimize2, MoreHorizontal, Save, Clock } from 'lucide-react';
import { dbService } from '../services/db';
import { Button } from './Button';
import { ActivityPicker } from './ActivityPicker';
import { AnalyticsSheet } from './AnalyticsSheet';
import { ConfirmationModal } from './ConfirmationModal';
import { analyzeText } from '../utils/analytics';
import { getAdaptiveColor, isDarkMode } from '../utils/colors';
import { exportActivity } from '../utils/dataTransfer';
import { CARD_COLORS } from '../constants';

interface EditorProps {
  activity: Activity;
  onSave: (activity: Activity) => Promise<void>;
  onBack: () => void;
  showWordCount: boolean;
  allActivities?: Activity[];
  onSwitchActivity: (activity: Activity) => void;
}

export const Editor: React.FC<EditorProps> = ({ activity, onSave, onBack, showWordCount, allActivities = [], onSwitchActivity }) => {
  const [title, setTitle] = useState(activity.title);
  const [content, setContent] = useState(activity.content);
  const [flatColor, setFlatColor] = useState(activity.flatColor);
  const [adaptiveColor, setAdaptiveColor] = useState(activity.flatColor);
  const [linkedActivities, setLinkedActivities] = useState<Activity[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  const [isDictating, setIsDictating] = useState(false);
  const [showDictationModal, setShowDictationModal] = useState(false);
  const [dictatedText, setDictatedText] = useState('');
  const recognitionRef = useRef<any>(null);
  
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  const [contentVisible, setContentVisible] = useState(true);
  const [collapsedLinks, setCollapsedLinks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const updateColor = () => {
        setAdaptiveColor(getAdaptiveColor(flatColor, isDarkMode()));
    };
    updateColor();
    const observer = new MutationObserver(updateColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [flatColor]);

  const vibrate = (ms: number = 10) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        const settings = localStorage.getItem('scripta_settings');
        if (settings && JSON.parse(settings).enableHaptics) {
            navigator.vibrate(ms);
        }
    }
  };

  const toggleFocusMode = () => {
      setFocusMode(!focusMode);
      vibrate(20);
  };

  const [confirmState, setConfirmState] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      isDangerous: boolean;
      onConfirm: () => void;
  }>({
      isOpen: false,
      title: '',
      message: '',
      isDangerous: false,
      onConfirm: () => {},
  });

  const stats = useMemo(() => analyzeText(content), [content]);

  useEffect(() => {
    const loadLinked = async () => {
        if (activity.linkedActivityIds && activity.linkedActivityIds.length > 0) {
            const promises = activity.linkedActivityIds.map(id => dbService.getActivity(id));
            const results = await Promise.all(promises);
            setLinkedActivities(results.filter((a): a is Activity => !!a));
        } else {
            setLinkedActivities([]);
        }
    };
    loadLinked();
  }, [activity.linkedActivityIds]);

  // Auto-save logic
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (title !== activity.title || content !== activity.content || flatColor !== activity.flatColor) {
        await forceSave();
      }
    }, 1500); 
    return () => clearTimeout(timer);
  }, [title, content, flatColor]);

  const forceSave = async () => {
      setIsSaving(true);
      const updatedActivity: Activity = {
          ...activity,
          title,
          content,
          flatColor,
          wordCount: stats.words,
          updatedAt: new Date().toISOString(),
      };
      await onSave(updatedActivity);
      setIsSaving(false);
  }

  const handleBack = async () => {
      vibrate(10);
      await forceSave();
      onBack();
  };

  const triggerConfirm = (title: string, message: string, isDangerous: boolean, onConfirm: () => void) => {
    vibrate(20);
    setConfirmState({ isOpen: true, title, message, isDangerous, onConfirm });
  };

  /**
   * SMART SWAP LOGIC:
   * Prevents data loss by saving the current activity and ensuring the new activity 
   * has a link back to this one before switching.
   */
  const handleSwitchToLinked = async (targetActivity: Activity) => {
      vibrate(15);
      // 1. Save current context immediately
      await forceSave();

      // 2. Prepare the target activity to receive a link back to the current one
      const targetLinks = targetActivity.linkedActivityIds || [];
      
      // Add "this" activity to "target" activity's links if not already there
      if (!targetLinks.includes(activity.id)) {
          const newLinks = [activity.id, ...targetLinks.filter(id => id !== activity.id)].slice(0, 5);
          const updatedTarget = {
              ...targetActivity,
              linkedActivityIds: newLinks,
              updatedAt: new Date().toISOString()
          };
          // Persist the link in the target activity
          await dbService.saveActivity(updatedTarget);
          onSwitchActivity(updatedTarget);
      } else {
          // Already linked, just switch
          onSwitchActivity(targetActivity);
      }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText || pastedText.length < 50) return;

    const match = allActivities.find(a => 
       a.id !== activity.id && 
       (a.content === pastedText || (a.content.length > 50 && a.content.includes(pastedText)))
    );

    if (match) {
        e.preventDefault();
        triggerConfirm(
            "Link Activity?",
            `This text looks like it belongs to "${match.title}". Link that activity instead of duplicating?`,
            false,
            () => handleLinkActivity(match.id, true)
        );
        return;
    }
  };

  const startDictation = () => {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
          alert('Voice dictation is not supported in this browser.');
          return;
      }
      setShowMobileMenu(false);
      vibrate(10);
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onstart = () => {
          setIsDictating(true);
          setShowDictationModal(true);
          setDictatedText('');
      };
      recognition.onresult = (event: any) => {
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) final += event.results[i][0].transcript;
          }
          if (final) setDictatedText(prev => prev + ' ' + final);
      };
      recognition.onend = () => setIsDictating(false);
      recognition.start();
      recognitionRef.current = recognition;
  };

  const stopDictation = () => {
      vibrate(10);
      if (recognitionRef.current) {
          recognitionRef.current.stop();
          setIsDictating(false);
      }
  };

  const handleDictationAction = (action: 'insert' | 'discard') => {
      vibrate(10);
      if (action === 'discard') {
          setShowDictationModal(false);
          setDictatedText('');
          return;
      }
      if (action === 'insert') {
          setContent(prev => prev + (prev ? '\n' : '') + dictatedText.trim());
          setShowDictationModal(false);
          setDictatedText('');
          return;
      }
  };

  const handleLinkActivity = async (id: string, skipConfirm = false) => {
      setShowMobileMenu(false);
      const currentLinks = activity.linkedActivityIds || [];
      if (currentLinks.length >= 5) { alert("Maximum 5 linked activities allowed."); return; }
      if (currentLinks.includes(id) || id === activity.id) { setShowLinkPicker(false); return; }
      const linkedActivity = await dbService.getActivity(id);
      const doLink = async () => {
        const newLinks = [...currentLinks, id];
        const updated = { ...activity, linkedActivityIds: newLinks, updatedAt: new Date().toISOString() };
        if (linkedActivity) setLinkedActivities(prev => [...prev, linkedActivity]);
        await onSave(updated);
        setShowLinkPicker(false);
        vibrate(20);
      };
      if (!skipConfirm && linkedActivity) {
          triggerConfirm("Link Activity?", `Link "${linkedActivity.title}"?`, false, doLink);
      } else { doLink(); }
  };
  
  const handleUnlink = async (id: string) => {
      const act = linkedActivities.find(a => a.id === id);
      triggerConfirm(
          "Unlink Activity?", 
          `Remove link to "${act?.title || 'activity'}"?`, 
          true, 
          async () => {
              const newLinks = activity.linkedActivityIds.filter(lid => lid !== id);
              const updated = { ...activity, linkedActivityIds: newLinks, updatedAt: new Date().toISOString() };
              setLinkedActivities(prev => prev.filter(a => a.id !== id));
              await onSave(updated);
              vibrate(20);
          }
      );
  };

  const updateLinkedActivity = async (linkedId: string, newContent: string) => {
      setLinkedActivities(prev => prev.map(a => a.id === linkedId ? { ...a, content: newContent } : a));
      const act = linkedActivities.find(a => a.id === linkedId);
      if (act) {
          // Real-time background sync for linked activities
          await dbService.saveActivity({ ...act, content: newContent, updatedAt: new Date().toISOString() });
      }
  };

  const toggleLinkCollapse = (id: string) => { vibrate(5); setCollapsedLinks(prev => ({ ...prev, [id]: !prev[id] })); };

  return (
    <div 
        className={`flex flex-col h-full animate-slide-up bg-surface transition-colors duration-700 ease-fluid ${focusMode ? 'fixed inset-0 z-[100]' : ''}`} 
        style={adaptiveColor && adaptiveColor !== 'transparent' ? { backgroundColor: adaptiveColor } : {}}
        onClick={() => { 
            if(showExportMenu) setShowExportMenu(false); 
            if(showMobileMenu) setShowMobileMenu(false);
        }}
    >
      {!focusMode && (
          <div className="flex items-center justify-between p-4 glass sticky top-0 z-20 border-b border-black/5 dark:border-white/5 transition-all duration-300 print:hidden select-none">
            <button onClick={handleBack} className="p-2 hover:bg-black/5 rounded-full transition-colors text-surface-fg/70 hover:text-primary active:scale-95 duration-200">
              <ArrowLeft size={24} />
            </button>
            
            <div className="flex items-center gap-1 sm:gap-2 relative">
              {isSaving && (
                <div className="flex items-center gap-2 mr-2 px-3 py-1 bg-primary/10 rounded-full">
                    <Save size={14} className="text-primary animate-pulse"/>
                    <span className="text-[10px] uppercase font-bold tracking-tighter text-primary">Autosaving</span>
                </div>
              )}
              
              <div className="hidden md:flex items-center gap-1">
                  <button onClick={startDictation} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200" title="Dictate"><Mic size={20} /></button>
                  <button onClick={() => { vibrate(10); setShowColorPicker(!showColorPicker); }} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200" title="Change Color"><Palette size={20} /></button>
                  <button onClick={() => { vibrate(10); setShowLinkPicker(true); }} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200" title="Link Thought"><LinkIcon size={20} /></button>
                  <button onClick={(e) => { e.stopPropagation(); vibrate(10); setShowExportMenu(!showExportMenu); }} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200" title="Share"><Share2 size={20} /></button>
              </div>

              <button onClick={toggleFocusMode} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200" title="Focus Mode"><Maximize2 size={20} /></button>

              <div className="md:hidden relative">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowMobileMenu(!showMobileMenu); }} 
                    className={`p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200 ${showMobileMenu ? 'bg-black/5' : ''}`}
                  >
                      <MoreHorizontal size={20} />
                  </button>
                  
                  {showMobileMenu && (
                      <div className="absolute top-12 right-0 bg-surface rounded-xl shadow-xl border border-black/10 w-48 animate-scale-in origin-top-right overflow-hidden z-30 flex flex-col p-1">
                          <MobileMenuItem icon={<Mic size={18}/>} label="Dictate" onClick={startDictation} />
                          <MobileMenuItem icon={<Palette size={18}/>} label="Color" onClick={() => setShowColorPicker(true)} />
                          <MobileMenuItem icon={<LinkIcon size={18}/>} label="Link Activity" onClick={() => setShowLinkPicker(true)} />
                          <MobileMenuItem icon={<Share2 size={18}/>} label="Export" onClick={() => setShowExportMenu(true)} />
                      </div>
                  )}
              </div>

              {showExportMenu && (
                 <div className="absolute top-12 right-0 bg-surface rounded-xl shadow-xl border border-black/10 w-48 animate-scale-in origin-top-right overflow-hidden z-30" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { navigator.clipboard.writeText(`${title}\n\n${content}`); setShowExportMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-black/5 flex items-center gap-2"><Copy size={16}/> Copy Text</button>
                    <button onClick={() => { exportActivity(activity, 'txt'); setShowExportMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-black/5 flex items-center gap-2"><FileText size={16}/> Save as .txt</button>
                    <button onClick={() => { exportActivity(activity, 'md'); setShowExportMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-black/5 flex items-center gap-2"><Download size={16}/> Save as .md</button>
                 </div>
              )}
            </div>
          </div>
      )}

      {focusMode && (
          <button 
             onClick={toggleFocusMode}
             className="fixed top-6 right-6 z-[110] p-3 bg-surface/80 backdrop-blur-md rounded-full shadow-lg hover:bg-surface text-surface-fg opacity-40 hover:opacity-100 transition-all duration-300 transform hover:scale-110 border border-black/5"
             title="Exit Focus Mode"
          >
             <Minimize2 size={24} />
          </button>
      )}

      <div className={`flex-1 overflow-y-auto w-full px-6 py-8 no-scrollbar scroll-smooth print:overflow-visible transition-all duration-500 ${focusMode ? 'max-w-3xl mx-auto pt-24' : 'max-w-3xl mx-auto pb-32'}`}>
        <input 
          type="text" 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled Thought"
          className={`w-full bg-transparent font-display font-bold placeholder:text-surface-fg/20 outline-none mb-8 text-surface-fg transition-all duration-300 ease-spring ${focusMode ? 'text-4xl sm:text-5xl text-center leading-tight' : 'text-3xl sm:text-4xl'}`}
        />

        {!focusMode && (
            <div className="flex items-center gap-2 text-primary/50 mb-6 cursor-pointer select-none group w-fit print:hidden" onClick={() => { vibrate(5); setContentVisible(!contentVisible); }}>
              <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-primary transition-colors">Main Content</span>
              <div className="transform transition-transform duration-300 ease-spring group-hover:text-primary">
                {contentVisible ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </div>
        )}

        <div className={`transition-all duration-500 ease-fluid overflow-hidden ${contentVisible || focusMode ? 'opacity-100 max-h-[5000px]' : 'opacity-0 max-h-0'} print:opacity-100 print:max-h-none`}>
             <textarea 
               value={content}
               onChange={(e) => setContent(e.target.value)}
               onPaste={handlePaste}
               placeholder="Start writing..."
               className={`w-full min-h-[50vh] bg-transparent resize-none outline-none leading-loose font-light text-surface-fg placeholder:text-surface-fg/20 transition-all duration-300 ${focusMode ? 'text-xl text-justify hyphens-auto' : 'text-lg'}`}
               spellCheck="false"
             />
        </div>

        {/* Improved Linked Activities Visual Hierarchy */}
        {!focusMode && linkedActivities.length > 0 && (
            <div className="mt-20 pt-12 relative print:hidden">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent"></div>
                <div className="flex items-center justify-between mb-8 px-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest opacity-40 flex items-center gap-2">
                        <LinkIcon size={14} className="text-primary"/>
                        Linked Context ({linkedActivities.length}/5)
                    </h3>
                    <button 
                        onClick={() => setShowLinkPicker(true)}
                        className="text-[10px] uppercase font-bold text-primary px-3 py-1 bg-primary/5 rounded-full hover:bg-primary/10 transition-colors"
                    >
                        + Add Link
                    </button>
                </div>
                
                <div className="space-y-12">
                    {linkedActivities.map(link => (
                        <div key={link.id} className="relative group transition-all duration-500 ease-spring">
                            {/* Connection line */}
                            <div className="absolute -left-5 top-0 bottom-0 w-[2px] bg-gradient-to-b from-primary/30 via-primary/5 to-transparent border-l-2 border-dashed border-primary/20"></div>
                            
                            <div className="pl-6 transition-all duration-300">
                                <div className="flex items-center justify-between mb-4 bg-primary/5 rounded-xl p-3 pr-5 border border-primary/10">
                                    <div 
                                      className="flex items-center gap-3 cursor-pointer select-none text-primary font-bold font-display flex-1 group"
                                      onClick={() => toggleLinkCollapse(link.id)}
                                    >
                                        <div className="p-1.5 bg-background rounded-lg shadow-sm transform transition-all duration-300 group-hover:scale-110">
                                            <LinkIcon size={14} />
                                        </div>
                                        <span className="truncate max-w-[250px] group-hover:underline decoration-primary/30 underline-offset-4">{link.title || 'Untitled'}</span>
                                        <div className="transform transition-transform duration-300 opacity-40">
                                            {collapsedLinks[link.id] ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleSwitchToLinked(link)}
                                            className="flex items-center gap-2 bg-primary text-primary-fg text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
                                            title="Smart Swap: Move current text to links and open this one"
                                        >
                                            <Maximize2 size={12} />
                                            <span>Switch Focus</span>
                                        </button>
                                        <button 
                                          onClick={() => handleUnlink(link.id)} 
                                          className="text-primary opacity-30 hover:opacity-100 p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-all"
                                          title="Remove Link"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className={`overflow-hidden transition-all duration-700 ease-fluid ${collapsedLinks[link.id] ? 'max-h-0 opacity-0 scale-95' : 'max-h-[800px] opacity-100 scale-100'}`}>
                                    <div className="bg-surface/40 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-black/5 dark:border-white/5 hover:border-primary/20 transition-all group/card">
                                        <textarea 
                                            value={link.content}
                                            onChange={(e) => updateLinkedActivity(link.id, e.target.value)}
                                            className="w-full bg-transparent resize-none outline-none text-base opacity-90 font-light leading-relaxed min-h-[150px]"
                                            placeholder="Write something in this linked thought..."
                                        />
                                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-black/5 dark:border-white/5 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                            <div className="text-[10px] uppercase tracking-wider font-bold opacity-30 flex items-center gap-1">
                                                <ExternalLink size={10} /> Bidirectional Bridge
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-green-500">
                                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                                Live Synced
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
      
      {/* Footer / Stats bar */}
      {!focusMode && showWordCount && (
        <button 
          onClick={() => { vibrate(10); setShowAnalytics(true); }}
          className="fixed bottom-0 left-0 right-0 glass border-t border-black/5 dark:border-white/5 p-4 flex justify-between items-center text-[11px] font-bold uppercase tracking-widest text-surface-fg/50 hover:text-primary transition-colors z-20 print:hidden"
        >
           <div className="flex gap-6 mx-auto max-w-3xl w-full px-6">
             <span className="flex items-center gap-1.5"><FileText size={12}/> {stats.words} Words</span>
             <span className="flex items-center gap-1.5"><Clock size={12}/> {stats.readingTime} Read</span>
             <span className="ml-auto flex items-center gap-1.5 opacity-80 group hover:opacity-100"><BarChart2 size={14} className="group-hover:scale-110 transition-transform"/> Analytics</span>
           </div>
        </button>
      )}
      
      {/* Pickers & Modals */}
      {showColorPicker && (
          <div className="fixed inset-0 z-30" onClick={() => setShowColorPicker(false)}>
            <div className="absolute top-20 right-4 p-5 bg-surface/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-black/5 z-30 animate-scale-in grid grid-cols-3 gap-3 origin-top-right" onClick={e => e.stopPropagation()}>
                {CARD_COLORS.map(c => (
                    <button 
                        key={c} 
                        onClick={() => { setFlatColor(c); setShowColorPicker(false); vibrate(10); }} 
                        className="w-11 h-11 rounded-full border-2 border-black/10 shadow-inner transition-all hover:scale-110 active:scale-90 duration-300 ease-spring" 
                        style={{ backgroundColor: c }} 
                    />
                ))}
            </div>
          </div>
      )}

      {showLinkPicker && (
          <ActivityPicker 
             activities={allActivities.filter(a => a.id !== activity.id && !a.deleted)}
             onSelect={(id) => handleLinkActivity(id)}
             onClose={() => setShowLinkPicker(false)}
          />
      )}

      {showAnalytics && <AnalyticsSheet stats={stats} onClose={() => setShowAnalytics(false)} />}
      
      {showDictationModal && (
          <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-surface w-full max-w-md mx-auto sm:rounded-3xl rounded-t-3xl shadow-2xl p-8 animate-slide-up border border-white/5 flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xl flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${isDictating ? 'bg-red-500 animate-pulse ring-4 ring-red-500/20' : 'bg-gray-400'}`}></div>
                          {isDictating ? 'Transcribing...' : 'Dictation Ready'}
                      </h3>
                      <button onClick={stopDictation} className="p-2.5 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500/20 active:scale-90 transition-all"><MicOff size={22}/></button>
                  </div>
                  
                  <div className="bg-black/5 dark:bg-white/5 p-6 rounded-2xl min-h-[120px] max-h-[250px] overflow-y-auto text-xl font-light italic opacity-90 leading-relaxed border border-black/5">
                      {dictatedText || "The mic is active. Start speaking..."}
                  </div>

                  <div className="flex gap-3">
                      <Button variant="ghost" className="flex-1" onClick={() => handleDictationAction('discard')}>Discard</Button>
                      <Button onClick={() => handleDictationAction('insert')} className="flex-1 gap-2 h-14 text-lg"><Check size={20}/> Use Text</Button>
                  </div>
              </div>
          </div>
      )}

      <ConfirmationModal 
         isOpen={confirmState.isOpen}
         title={confirmState.title}
         message={confirmState.message}
         isDangerous={confirmState.isDangerous}
         onConfirm={confirmState.onConfirm}
         onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

const MobileMenuItem = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
    <button 
        onClick={onClick}
        className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:bg-black/5 dark:hover:bg-white/5 text-surface-fg/80 active:scale-[0.98]"
    >
        <span className="opacity-70">{icon}</span>
        <span className="font-semibold text-sm">{label}</span>
    </button>
);