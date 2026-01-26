import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Activity } from '../types';
import { ArrowLeft, ChevronDown, ChevronUp, Link as LinkIcon, Palette, X, BarChart2, Check, ExternalLink, Share2, Copy, FileText, Download, Mic, MicOff, Maximize2, Minimize2, MoreVertical, Save, Clock, Slash, ArrowRight, Bold, Italic, Hash, List, CheckSquare, Type } from 'lucide-react';
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
  const [showFormatBar, setShowFormatBar] = useState(false);
  
  const [isDictating, setIsDictating] = useState(false);
  const [showDictationModal, setShowDictationModal] = useState(false);
  const [dictatedText, setDictatedText] = useState('');
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
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

  const updateLinkedActivity = async (linkedId: string, newContent: string) => {
      setLinkedActivities(prev => prev.map(a => a.id === linkedId ? { ...a, content: newContent } : a));
      const act = linkedActivities.find(a => a.id === linkedId);
      if (act) {
          await dbService.saveActivity({ ...act, content: newContent, updatedAt: new Date().toISOString() });
      }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText || pastedText.length < 20) return;

    const match = allActivities.find(a => 
       a.id !== activity.id && !a.deleted && (
          (a.title && pastedText.trim().toLowerCase() === a.title.toLowerCase()) ||
          (a.content.length > 50 && a.content.includes(pastedText))
       )
    );

    if (match) {
        e.preventDefault();
        triggerConfirm(
            "Link Activity?",
            `You pasted text that matches "${match.title}". Would you like to link to that activity instead of pasting the text?`,
            false,
            () => handleLinkActivity(match.id, true)
        );
        return;
    }
  };

  const insertFormat = (syntax: string, type: 'wrap' | 'block') => {
      vibrate(5);
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentText = textarea.value;
      const before = currentText.substring(0, start);
      const selection = currentText.substring(start, end);
      const after = currentText.substring(end);

      let newText = '';
      let newCursorPos = 0;

      if (type === 'wrap') {
          newText = `${before}${syntax}${selection}${syntax}${after}`;
          newCursorPos = start + syntax.length + selection.length + syntax.length; 
          if (selection.length === 0) newCursorPos = start + syntax.length;
      } else {
          // Check if we are at start of line
          const lastNewLine = before.lastIndexOf('\n');
          const isStartOfLine = lastNewLine === before.length - 1 || start === 0;
          const prefix = isStartOfLine ? '' : '\n';
          newText = `${before}${prefix}${syntax} ${selection}${after}`;
          newCursorPos = newText.length - after.length;
      }

      setContent(newText);
      setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
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
              
              {/* Desktop Toolbar */}
              <div className="hidden md:flex items-center gap-1">
                  <button onClick={() => setShowFormatBar(!showFormatBar)} className={`p-2 rounded-full text-surface-fg/70 active:scale-90 duration-200 ${showFormatBar ? 'bg-black/5 text-primary' : 'hover:bg-black/5'}`} title="Formatting"><Type size={20} /></button>
                  <button onClick={startDictation} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200" title="Dictate"><Mic size={20} /></button>
                  <button onClick={() => { vibrate(10); setShowColorPicker(!showColorPicker); }} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200" title="Change Color"><Palette size={20} /></button>
                  <button onClick={() => { vibrate(10); setShowLinkPicker(true); }} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200" title="Link Thought"><LinkIcon size={20} /></button>
                  <button onClick={(e) => { e.stopPropagation(); vibrate(10); setShowExportMenu(!showExportMenu); }} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200" title="Share"><Share2 size={20} /></button>
              </div>

              <button onClick={toggleFocusMode} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200" title="Focus Mode"><Maximize2 size={20} /></button>

              {/* Mobile Menu Button */}
              <div className="md:hidden relative">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowMobileMenu(!showMobileMenu); }} 
                    className={`p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200 ${showMobileMenu ? 'bg-black/5' : ''}`}
                  >
                      <MoreVertical size={20} />
                  </button>
                  
                  {showMobileMenu && (
                      <div className="absolute top-12 right-0 bg-surface rounded-xl shadow-xl border border-black/10 w-56 animate-scale-in origin-top-right overflow-hidden z-30 flex flex-col p-2">
                          <MobileMenuItem icon={<Type size={18}/>} label={showFormatBar ? "Hide Formatting" : "Show Formatting"} onClick={() => { setShowFormatBar(!showFormatBar); setShowMobileMenu(false); }} />
                          <div className="h-px bg-black/5 dark:bg-white/5 my-1 mx-2"></div>
                          <MobileMenuItem icon={<Mic size={18}/>} label="Dictate" onClick={startDictation} />
                          <MobileMenuItem icon={<Palette size={18}/>} label="Color Theme" onClick={() => setShowColorPicker(true)} />
                          <MobileMenuItem icon={<LinkIcon size={18}/>} label="Link Activity" onClick={() => setShowLinkPicker(true)} />
                          <div className="h-px bg-black/5 dark:bg-white/5 my-1 mx-2"></div>
                          <MobileMenuItem icon={<Share2 size={18}/>} label="Export & Share" onClick={() => setShowExportMenu(true)} />
                          <MobileMenuItem icon={<BarChart2 size={18}/>} label="View Stats" onClick={() => setShowAnalytics(true)} />
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
             className="fixed top-8 right-8 z-[110] p-4 bg-transparent text-surface-fg/30 hover:text-surface-fg hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-all duration-300 transform active:scale-90"
             title="Exit Focus Mode"
          >
             <Minimize2 size={28} />
          </button>
      )}

      <div className={`flex-1 overflow-y-auto w-full no-scrollbar scroll-smooth print:overflow-visible transition-all duration-700 ease-fluid ${focusMode ? 'px-[5vw] pt-24 pb-32 flex flex-col items-center' : 'px-6 py-8 max-w-3xl mx-auto pb-32'}`}>
        
        {/* Markdown Toolbar */}
        {showFormatBar && (
            <div className={`w-full max-w-2xl mx-auto mb-6 flex items-center justify-center gap-2 sm:gap-4 p-2 rounded-xl bg-black/5 dark:bg-white/5 animate-slide-up ${focusMode ? 'mb-12' : ''}`}>
                <button onClick={() => insertFormat('**', 'wrap')} className="p-2 hover:bg-background rounded-lg transition-colors text-surface-fg/70 hover:text-primary"><Bold size={18}/></button>
                <button onClick={() => insertFormat('_', 'wrap')} className="p-2 hover:bg-background rounded-lg transition-colors text-surface-fg/70 hover:text-primary"><Italic size={18}/></button>
                <div className="w-px h-6 bg-surface-fg/10"></div>
                <button onClick={() => insertFormat('#', 'block')} className="p-2 hover:bg-background rounded-lg transition-colors text-surface-fg/70 hover:text-primary"><Hash size={18}/></button>
                <button onClick={() => insertFormat('-', 'block')} className="p-2 hover:bg-background rounded-lg transition-colors text-surface-fg/70 hover:text-primary"><List size={18}/></button>
                <button onClick={() => insertFormat('[ ]', 'block')} className="p-2 hover:bg-background rounded-lg transition-colors text-surface-fg/70 hover:text-primary"><CheckSquare size={18}/></button>
            </div>
        )}

        <input 
          type="text" 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled Thought"
          className={`bg-transparent font-display font-bold placeholder:text-surface-fg/20 outline-none text-surface-fg transition-all duration-500 ease-fluid ${focusMode ? 'text-4xl sm:text-5xl text-center leading-tight mb-16 w-full max-w-3xl opacity-90' : 'text-3xl sm:text-4xl w-full mb-8'}`}
        />

        {!focusMode && (
            <div className="flex items-center gap-2 text-primary/50 mb-6 cursor-pointer select-none group w-fit print:hidden" onClick={() => { vibrate(5); setContentVisible(!contentVisible); }}>
              <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-primary transition-colors">Main Content</span>
              <div className="transform transition-transform duration-300 ease-spring group-hover:text-primary">
                {contentVisible ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </div>
        )}

        <div className={`transition-all duration-700 ease-fluid overflow-hidden w-full ${focusMode ? 'max-w-2xl' : ''} ${contentVisible || focusMode ? 'opacity-100 max-h-[5000px]' : 'opacity-0 max-h-0'} print:opacity-100 print:max-h-none`}>
             <textarea 
               ref={textareaRef}
               value={content}
               onChange={(e) => setContent(e.target.value)}
               onPaste={handlePaste}
               placeholder="Start writing..."
               className={`w-full bg-transparent resize-none outline-none font-light text-surface-fg placeholder:text-surface-fg/20 transition-all duration-500 ease-fluid pb-[50vh] ${focusMode ? 'text-xl sm:text-2xl leading-[2] tracking-wide min-h-[80vh]' : 'text-lg leading-loose min-h-[50vh]'}`}
               spellCheck="false"
             />
        </div>

        {/* Linked Activities Section */}
        {!focusMode && linkedActivities.length > 0 && (
            <div className="mt-12 pt-12 relative print:hidden w-full">
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
                
                <div className="space-y-6">
                    {linkedActivities.map(link => (
                        <div key={link.id} className="relative group transition-all duration-500 ease-spring">
                            {/* Connection line */}
                            <div className="absolute -left-5 top-0 bottom-0 w-[2px] bg-gradient-to-b from-primary/30 via-primary/5 to-transparent border-l-2 border-dashed border-primary/20"></div>
                            
                            <div className="pl-6 transition-all duration-300">
                                <div className="bg-surface/60 backdrop-blur-sm border border-black/5 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/20 transition-all">
                                    <div 
                                      className="flex items-center justify-between p-4 bg-primary/5 cursor-pointer select-none"
                                      onClick={() => toggleLinkCollapse(link.id)}
                                    >
                                        <div className="flex items-center gap-3 font-bold font-display text-primary flex-1">
                                            <LinkIcon size={14} />
                                            <span className="truncate max-w-[180px] sm:max-w-xs">{link.title || 'Untitled'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="transform transition-transform duration-300 opacity-40">
                                                {collapsedLinks[link.id] ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className={`transition-all duration-500 ease-fluid ${collapsedLinks[link.id] ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100'}`}>
                                        <textarea 
                                            value={link.content}
                                            onChange={(e) => updateLinkedActivity(link.id, e.target.value)}
                                            className="w-full bg-transparent resize-none outline-none text-sm font-light leading-relaxed min-h-[120px] p-4 placeholder:opacity-30 focus:bg-white/5 transition-colors"
                                            placeholder="Write in this linked thought..."
                                        />
                                        <div className="p-2 border-t border-black/5 dark:border-white/5 flex justify-between items-center bg-black/5 dark:bg-white/5">
                                            <span className="text-[10px] uppercase font-bold tracking-wider opacity-30 pl-2">Live Edit</span>
                                            <button 
                                                onClick={() => handleUnlink(link.id)} 
                                                className="text-[10px] uppercase font-bold text-red-500 opacity-60 hover:opacity-100 px-3 py-1 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-1"
                                            >
                                                <X size={10} /> Unlink
                                            </button>
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
                        className="w-11 h-11 rounded-full border-2 border-black/10 shadow-inner transition-all hover:scale-110 active:scale-90 duration-300 ease-spring relative overflow-hidden" 
                        style={{ backgroundColor: c }}
                        title={c === 'transparent' ? "Remove Color" : "Set Color"}
                    >
                         {c === 'transparent' && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Slash size={20} className="text-black/30 dark:text-white/30" />
                            </div>
                         )}
                    </button>
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
        className="w-full flex items-center gap-4 p-3 rounded-xl text-left transition-all hover:bg-black/5 dark:hover:bg-white/5 text-surface-fg/80 active:scale-[0.98]"
    >
        <span className="opacity-70">{icon}</span>
        <span className="font-semibold text-sm">{label}</span>
    </button>
);