import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Activity } from '../types';
import { ArrowLeft, Sparkles, ChevronDown, ChevronUp, Link as LinkIcon, Palette, X, BarChart2, Check, ExternalLink, Wand2, Share2, Copy, FileText, Download, Mic, MicOff, Maximize2, Minimize2, SpellCheck, MoreHorizontal, LayoutTemplate } from 'lucide-react';
import { generateAIContent, getAIPoints, calculateCustomCost, generateTitleFromContent, checkPointsAvailable, checkSpelling, COSTS } from '../services/geminiService';
import { dbService } from '../services/db';
import { Button } from './Button';
import { ActivityPicker } from './ActivityPicker';
import { AnalyticsSheet } from './AnalyticsSheet';
import { ConfirmationModal } from './ConfirmationModal';
import { analyzeText } from '../utils/analytics';
import { stripMarkdown } from '../utils/markdown';
import { getAdaptiveColor, isDarkMode } from '../utils/colors.ts';
import { exportActivity } from '../utils/dataTransfer.ts';
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
  const [aiPoints, setAiPoints] = useState(getAIPoints());
  const [focusMode, setFocusMode] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // AI States
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiMode, setAiMode] = useState<'presets' | 'custom'>('presets');
  const [customPrompt, setCustomPrompt] = useState('');
  const [aiState, setAiState] = useState<'idle' | 'thinking' | 'streaming' | 'done' | 'error'>('idle');
  const [aiErrorMsg, setAiErrorMsg] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [fullGeneratedText, setFullGeneratedText] = useState('');
  const [originalSelection, setOriginalSelection] = useState('');

  // Spellcheck State
  const [isProofing, setIsProofing] = useState(false);
  const [corrections, setCorrections] = useState<Array<{original: string, suggestion: string}>>([]);
  const [isCheckingSpelling, setIsCheckingSpelling] = useState(false);
  const [activeCorrection, setActiveCorrection] = useState<{original: string, suggestion: string, x: number, y: number} | null>(null);

  // Voice Dictation State
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

  // Handle Typewriter Effect for Streaming
  useEffect(() => {
    if (aiState === 'streaming' && fullGeneratedText) {
        let i = 0;
        setStreamingText('');
        const interval = setInterval(() => {
            setStreamingText(fullGeneratedText.substring(0, i + 3)); // Chunk of 3 chars for speed
            i += 3;
            if (i >= fullGeneratedText.length) {
                clearInterval(interval);
                setAiState('done');
            }
        }, 10);
        return () => clearInterval(interval);
    }
  }, [aiState, fullGeneratedText]);

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
      if (isProofing) setIsProofing(false);
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
      let currentTitle = title;
      if (!currentTitle.trim() && content.length > 20 && content.length < 1000 && !isSaving) {
          const generated = await generateTitleFromContent(content);
          if (generated) {
              currentTitle = generated;
              setTitle(generated);
              setAiPoints(getAIPoints());
          }
      }

      if (currentTitle !== activity.title || content !== activity.content || flatColor !== activity.flatColor) {
        setIsSaving(true);
        const updatedActivity: Activity = {
          ...activity,
          title: currentTitle,
          content,
          flatColor,
          wordCount: stats.words,
          updatedAt: new Date().toISOString(),
        };
        await onSave(updatedActivity);
        setIsSaving(false);
      }
    }, 1500); 
    return () => clearTimeout(timer);
  }, [title, content, flatColor]);

  const forceSave = async () => {
      if (title !== activity.title || content !== activity.content || flatColor !== activity.flatColor) {
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

  // --- Contextual Swapping Logic ---
  const handleSwitchToLinked = async (targetActivity: Activity) => {
      vibrate(10);
      // 1. Force save current (A)
      await forceSave();

      // 2. We are switching to Target (B). 
      // We want A to appear in B's linked list.
      const targetLinks = targetActivity.linkedActivityIds || [];
      
      // Check if A is already linked to B
      if (!targetLinks.includes(activity.id)) {
          // Add A to B's links, keep max 5, avoid duplicates
          const newLinks = [activity.id, ...targetLinks.filter(id => id !== activity.id)].slice(0, 5);
          
          const updatedTarget = {
              ...targetActivity,
              linkedActivityIds: newLinks,
              updatedAt: new Date().toISOString()
          };
          
          // Save B with new link
          await dbService.saveActivity(updatedTarget);
          
          // Switch view to B
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

    if (pastedText.length > 300) {
       e.preventDefault();
       const formatted = `\n\n---\n${pastedText}\n---\n\n`;
       document.execCommand('insertText', false, formatted);
    }
  };

  // --- Voice Dictation ---
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

  const handleDictationAction = (action: 'insert' | 'refine' | 'discard') => {
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
      if (action === 'refine') {
          setShowDictationModal(false);
          setShowAIModal(true);
          setAiMode('custom');
          setCustomPrompt(`Fix grammar and clarity: "${dictatedText}"`);
          setTimeout(() => executeAI(`Fix grammar and clarity: "${dictatedText}"`, 3), 500);
      }
  };

  // --- Spellcheck Logic ---
  const handleSpellCheck = async () => {
      setShowMobileMenu(false);
      if (isProofing) {
          setIsProofing(false);
          return;
      }
      setIsCheckingSpelling(true);
      try {
          const errors = await checkSpelling(content);
          setAiPoints(getAIPoints());
          if (errors.length === 0) {
              alert("No errors found!");
          } else {
              setCorrections(errors);
              setIsProofing(true);
              vibrate(20);
          }
      } catch (e: any) {
          alert(e.message);
      } finally {
          setIsCheckingSpelling(false);
      }
  };

  const applyCorrection = (original: string, suggestion: string) => {
      vibrate(10);
      const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      setContent(prev => prev.replace(regex, suggestion));
      setCorrections(prev => prev.filter(c => c.original !== original));
      setActiveCorrection(null);
  };

  const ignoreCorrection = (original: string) => {
      vibrate(10);
      setCorrections(prev => prev.filter(c => c.original !== original));
      setActiveCorrection(null);
  }

  const renderProofingContent = () => {
      if (corrections.length === 0) return <div className="whitespace-pre-wrap">{content}</div>;
      const pattern = corrections.map(c => c.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      const regex = new RegExp(`(${pattern})`, 'g');
      const parts = content.split(regex);
      return (
          <div className="whitespace-pre-wrap leading-relaxed">
              {parts.map((part, i) => {
                  const correction = corrections.find(c => c.original === part);
                  if (correction) {
                      return (
                          <span 
                            key={i} 
                            onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActiveCorrection({ ...correction, x: rect.left, y: rect.bottom + 10 });
                            }}
                            className="bg-red-500/20 underline decoration-red-500 decoration-wavy cursor-pointer hover:bg-red-500/30 rounded px-0.5 transition-colors text-red-700 dark:text-red-300 relative"
                          >
                              {part}
                          </span>
                      );
                  }
                  return <span key={i}>{part}</span>;
              })}
          </div>
      );
  };

  // --- AI Logic ---
  const executeAI = async (prompt: string, cost: number) => {
      if (!checkPointsAvailable(cost)) {
        setAiErrorMsg(`Requires ${cost} points. You have ${aiPoints}.`);
        setAiState('error');
        vibrate(50);
        return;
      }
      setAiState('thinking');
      setAiErrorMsg('');
      setOriginalSelection(window.getSelection()?.toString() || '');
      try {
        const rawResult = await generateAIContent(prompt, cost);
        const cleanResult = stripMarkdown(rawResult);
        setAiPoints(getAIPoints());
        setFullGeneratedText(cleanResult);
        setAiState('streaming');
        vibrate(20);
      } catch (e: any) {
        setAiErrorMsg(e.message || 'AI Error.');
        setAiState('error');
        vibrate(50);
      }
  };

  const handlePresetAssist = (task: string, cost: number) => {
    const selection = window.getSelection()?.toString() || content;
    if (!selection) { alert('Select text first.'); return; }
    let prompt = '';
    if (task === 'rewrite') prompt = `Rewrite clearly: "${selection}"`;
    else if (task === 'summarize') prompt = `Summarize: "${selection}"`;
    else if (task === 'expand') prompt = `Expand ideas: "${selection}"`;
    else if (task === 'proofread') prompt = `Proofread: "${selection}"`;
    executeAI(prompt, cost);
  };

  const handleCustomAssist = () => {
    if (!customPrompt.trim()) return;
    const selection = window.getSelection()?.toString() || content;
    const fullPrompt = selection ? `Context: "${selection}". Task: ${customPrompt}` : customPrompt;
    const cost = calculateCustomCost(fullPrompt.length);
    executeAI(fullPrompt, cost);
  };

  const confirmAIInsertion = () => {
      if (fullGeneratedText) {
          if (originalSelection && content.includes(originalSelection)) {
              setContent(prev => prev.replace(originalSelection, fullGeneratedText));
          } else {
              setContent(prev => prev + (prev ? '\n\n' : '') + fullGeneratedText);
          }
          resetAI();
          setShowAIModal(false);
          vibrate(20);
      }
  };

  const resetAI = () => {
      setAiState('idle');
      setFullGeneratedText('');
      setStreamingText('');
      setAiErrorMsg('');
      setCustomPrompt('');
  };

  // --- Linking Logic ---
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
            if(activeCorrection) setActiveCorrection(null);
        }}
    >
      {/* Toolbar */}
      {!focusMode && (
          <div className="flex items-center justify-between p-4 glass sticky top-0 z-20 border-b border-black/5 dark:border-white/5 transition-all duration-300 print:hidden select-none">
            <button onClick={handleBack} className="p-2 hover:bg-black/5 rounded-full transition-colors text-surface-fg/70 hover:text-primary active:scale-95 duration-200">
              <ArrowLeft size={24} />
            </button>
            
            <div className="flex items-center gap-1 sm:gap-2 relative">
              {isSaving && <span className="text-xs text-primary animate-pulse mr-2 font-medium tracking-wide">Saving...</span>}
              
              {/* Desktop Items (Visible on md+) */}
              <div className="hidden md:flex items-center gap-1">
                  <button onClick={startDictation} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200" title="Dictate"><Mic size={20} /></button>
                  <button onClick={handleSpellCheck} className={`p-2 hover:bg-black/5 rounded-full active:scale-90 duration-200 ${isProofing ? 'text-primary bg-primary/10' : 'text-surface-fg/70'}`} title="Spellcheck">
                      {isCheckingSpelling ? <span className="animate-spin block w-5 h-5 border-2 border-current border-t-transparent rounded-full"/> : <SpellCheck size={20} />}
                  </button>
                  <button onClick={() => { vibrate(10); setShowColorPicker(!showColorPicker); }} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200"><Palette size={20} /></button>
                  <button onClick={() => { vibrate(10); setShowLinkPicker(true); }} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200"><LinkIcon size={20} /></button>
                  {aiPoints > 0 && (
                      <button onClick={() => { vibrate(10); setShowAIModal(!showAIModal); }} className="p-2 hover:bg-black/5 rounded-full text-primary active:scale-90 duration-200"><Sparkles size={20} /></button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); vibrate(10); setShowExportMenu(!showExportMenu); }} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200"><Share2 size={20} /></button>
              </div>

              {/* Always Visible */}
              <button onClick={toggleFocusMode} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200" title="Focus Mode"><Maximize2 size={20} /></button>

              {/* Mobile Menu Toggle (Visible on < md) */}
              <div className="md:hidden relative">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowMobileMenu(!showMobileMenu); }} 
                    className={`p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 duration-200 ${showMobileMenu ? 'bg-black/5' : ''}`}
                  >
                      <MoreHorizontal size={20} />
                  </button>
                  
                  {/* Mobile Dropdown */}
                  {showMobileMenu && (
                      <div className="absolute top-12 right-0 bg-surface rounded-xl shadow-xl border border-black/10 w-48 animate-scale-in origin-top-right overflow-hidden z-30 flex flex-col p-1">
                          <MobileMenuItem icon={<Mic size={18}/>} label="Dictate" onClick={startDictation} />
                          <MobileMenuItem 
                             icon={<SpellCheck size={18}/>} 
                             label={isProofing ? "Exit Proofing" : "Spellcheck"} 
                             onClick={handleSpellCheck} 
                             active={isProofing}
                             loading={isCheckingSpelling}
                          />
                          <MobileMenuItem icon={<Sparkles size={18}/>} label="AI Assist" onClick={() => setShowAIModal(true)} />
                          <MobileMenuItem icon={<Palette size={18}/>} label="Color" onClick={() => setShowColorPicker(true)} />
                          <MobileMenuItem icon={<LinkIcon size={18}/>} label="Link Activity" onClick={() => setShowLinkPicker(true)} />
                          <MobileMenuItem icon={<Share2 size={18}/>} label="Export" onClick={() => setShowExportMenu(true)} />
                      </div>
                  )}
              </div>

              {/* Export Menu (Shared) */}
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

      {/* Focus Mode Exit */}
      {focusMode && (
          <button 
             onClick={toggleFocusMode}
             className="fixed top-6 right-6 z-[110] p-3 bg-surface/80 backdrop-blur-md rounded-full shadow-lg hover:bg-surface text-surface-fg opacity-40 hover:opacity-100 transition-all duration-300 transform hover:scale-110 border border-black/5"
             title="Exit Focus Mode"
          >
             <Minimize2 size={24} />
          </button>
      )}

      {/* Editor Surface */}
      <div className={`flex-1 overflow-y-auto w-full px-6 py-8 no-scrollbar scroll-smooth print:overflow-visible transition-all duration-500 ${focusMode ? 'max-w-3xl mx-auto pt-24' : 'max-w-3xl mx-auto pb-32'}`}>
        <input 
          type="text" 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          readOnly={isProofing}
          className={`w-full bg-transparent font-display font-bold placeholder:text-surface-fg/20 outline-none mb-8 text-surface-fg transition-all duration-300 ease-spring ${focusMode ? 'text-4xl sm:text-5xl text-center leading-tight' : 'text-3xl sm:text-4xl'}`}
        />

        {!focusMode && !isProofing && (
            <div className="flex items-center gap-2 text-primary/50 mb-6 cursor-pointer select-none group w-fit print:hidden" onClick={() => { vibrate(5); setContentVisible(!contentVisible); }}>
              <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-primary transition-colors">Content</span>
              <div className="transform transition-transform duration-300 ease-spring group-hover:text-primary">
                {contentVisible ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </div>
        )}
        
        {isProofing && (
            <div className="mb-6 p-4 bg-primary/10 rounded-2xl border border-primary/20 flex items-center justify-between animate-fade-in shadow-inner">
                <div className="flex items-center gap-3 text-primary">
                    <SpellCheck size={24} />
                    <span className="font-medium">Proofing Mode</span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setIsProofing(false)}>Done</Button>
            </div>
        )}

        <div className={`transition-all duration-500 ease-fluid overflow-hidden ${contentVisible || focusMode ? 'opacity-100 max-h-[5000px]' : 'opacity-0 max-h-0'} print:opacity-100 print:max-h-none`}>
          {isProofing ? (
             <div className={`w-full min-h-[60vh] text-lg leading-loose font-light text-surface-fg animate-fade-in ${focusMode ? 'text-xl' : ''}`}>
                {renderProofingContent()}
             </div>
          ) : (
             <textarea 
               value={content}
               onChange={(e) => setContent(e.target.value)}
               onPaste={handlePaste}
               placeholder="Start writing..."
               className={`w-full min-h-[60vh] bg-transparent resize-none outline-none leading-loose font-light text-surface-fg placeholder:text-surface-fg/20 transition-all duration-300 ${focusMode ? 'text-xl text-justify hyphens-auto' : 'text-lg'}`}
               spellCheck="false"
             />
          )}
        </div>

        {/* Linked Activities (Hidden in Focus Mode) */}
        {!focusMode && !isProofing && linkedActivities.length > 0 && (
            <div className="mt-16 pt-8 relative print:hidden">
                <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-black/10 dark:via-white/10 to-transparent"></div>
                <h3 className="text-sm font-bold uppercase tracking-wider opacity-50 mb-6 flex justify-between items-center pl-2">
                    Linked Activities ({linkedActivities.length}/5)
                </h3>
                <div className="space-y-8">
                    {linkedActivities.map(link => (
                        <div key={link.id} className="relative group transition-all duration-500 ease-spring hover:-translate-y-1">
                            <div className="absolute -left-3 top-4 bottom-4 w-px bg-primary/20 border-l border-dashed border-primary/30"></div>
                            <div className="border-l-2 border-primary/60 pl-4 transition-all duration-300">
                                <div className="flex items-center justify-between mb-3 bg-primary/5 rounded-r-lg p-2 pr-4">
                                    <div 
                                      className="flex items-center gap-2 cursor-pointer select-none text-primary font-bold font-display"
                                      onClick={() => toggleLinkCollapse(link.id)}
                                    >
                                        <div className="p-1 bg-background rounded-md shadow-sm transform transition-transform duration-300 group-hover:rotate-45">
                                            <LinkIcon size={12} />
                                        </div>
                                        <span className="truncate max-w-[200px]">{link.title || 'Untitled'}</span>
                                        <div className="transform transition-transform duration-300">
                                            {collapsedLinks[link.id] ? <ChevronDown size={14} className="opacity-50"/> : <ChevronUp size={14} className="opacity-50"/>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => handleSwitchToLinked(link)}
                                            className="text-primary opacity-40 hover:opacity-100 p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-all"
                                            title="Maximize & Swap (Edit in Main)"
                                        >
                                            <Maximize2 size={14} />
                                        </button>
                                        <button 
                                          onClick={() => handleUnlink(link.id)} 
                                          className="text-primary opacity-40 hover:opacity-100 p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-full transition-all"
                                          title="Unlink"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className={`overflow-hidden transition-all duration-500 ease-fluid ${collapsedLinks[link.id] ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'}`}>
                                    <div className="bg-surface/50 rounded-xl p-4 shadow-sm border border-black/5 dark:border-white/5 hover:border-primary/20 transition-colors">
                                        <textarea 
                                            value={link.content}
                                            onChange={(e) => updateLinkedActivity(link.id, e.target.value)}
                                            className="w-full bg-transparent resize-none outline-none text-base opacity-90 font-light"
                                            rows={6}
                                            placeholder="Empty linked activity..."
                                        />
                                        <div className="text-right mt-2 text-[10px] uppercase tracking-wider opacity-40 flex items-center justify-end gap-1 font-bold text-primary">
                                            <ExternalLink size={10} /> Live Sync
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
      
      {/* Correction Popover */}
      {activeCorrection && (
          <div 
             className="fixed z-[120] bg-surface shadow-2xl rounded-xl p-4 border border-black/10 dark:border-white/10 flex flex-col gap-3 min-w-[240px] animate-scale-in"
             style={{ top: activeCorrection.y, left: Math.min(activeCorrection.x, window.innerWidth - 260) }}
             onClick={e => e.stopPropagation()}
          >
              <div className="flex justify-between items-center">
                  <div className="text-xs opacity-50 uppercase tracking-wider font-bold">Suggestion</div>
                  <button onClick={() => setActiveCorrection(null)}><X size={14} className="opacity-50"/></button>
              </div>
              <div className="font-bold text-xl text-primary">{activeCorrection.suggestion}</div>
              <div className="flex gap-2 mt-1">
                  <button 
                     onClick={() => applyCorrection(activeCorrection.original, activeCorrection.suggestion)}
                     className="flex-1 bg-primary text-primary-fg py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                      Apply
                  </button>
                  <button 
                     onClick={() => ignoreCorrection(activeCorrection.original)}
                     className="flex-1 bg-black/5 dark:bg-white/5 py-2 rounded-lg text-sm font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                      Ignore
                  </button>
              </div>
          </div>
      )}

      {/* Bottom Bar Stats (Hidden in Focus Mode) */}
      {!focusMode && showWordCount && (
        <button 
          onClick={() => { vibrate(10); setShowAnalytics(true); }}
          className="fixed bottom-0 left-0 right-0 glass border-t border-black/5 dark:border-white/5 p-3 flex justify-between items-center text-xs text-surface-fg/60 hover:text-primary transition-colors z-20 print:hidden"
        >
           <div className="flex gap-4 mx-auto max-w-3xl w-full px-6">
             <span>{stats.words} words</span>
             <span>{stats.readingTime} read</span>
             <span className="ml-auto flex items-center gap-1 opacity-70"><BarChart2 size={12}/> Analytics</span>
           </div>
        </button>
      )}
      
      {/* Pickers & Modals */}
      {showColorPicker && (
          <div className="fixed inset-0 z-30" onClick={() => setShowColorPicker(false)}>
            <div className="absolute top-20 right-4 p-4 bg-surface/90 backdrop-blur-md rounded-2xl shadow-xl border border-black/10 z-30 animate-scale-in grid grid-cols-3 gap-3 origin-top-right" onClick={e => e.stopPropagation()}>
                {CARD_COLORS.map(c => (
                    <button 
                        key={c} 
                        onClick={() => { setFlatColor(c); setShowColorPicker(false); vibrate(10); }} 
                        className="w-10 h-10 rounded-full border border-black/10 shadow-sm transition-transform active:scale-75 duration-300 ease-spring" 
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
      
      {/* Dictation Modal */}
      {showDictationModal && (
          <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-surface w-full max-w-md mx-auto sm:rounded-3xl rounded-t-3xl shadow-2xl p-6 animate-slide-up border border-white/10 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isDictating ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></div>
                          {isDictating ? 'Listening...' : 'Dictation Stopped'}
                      </h3>
                      <button onClick={stopDictation} className="p-2 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500/20"><MicOff size={20}/></button>
                  </div>
                  
                  <div className="bg-black/5 dark:bg-white/5 p-4 rounded-xl min-h-[100px] max-h-[200px] overflow-y-auto text-lg italic opacity-80">
                      {dictatedText || "Speak now..."}
                  </div>

                  <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => handleDictationAction('discard')}>Discard</Button>
                      <Button onClick={() => handleDictationAction('refine')} className="flex-1 gap-2" variant="secondary"><Sparkles size={16}/> Refine</Button>
                      <Button onClick={() => handleDictationAction('insert')} className="flex-1 gap-2"><Check size={16}/> Insert</Button>
                  </div>
              </div>
          </div>
      )}

      {/* Scripta AI Modal */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm transition-opacity duration-300" onClick={() => setShowAIModal(false)}>
          <div 
             className={`bg-surface w-full max-w-lg mx-auto sm:rounded-3xl rounded-t-3xl shadow-2xl p-6 animate-slide-up border border-white/10 transition-transform duration-300 ease-spring ${aiState === 'error' ? 'animate-shake border-red-500/50' : ''}`} 
             onClick={e => e.stopPropagation()}
          >
            {aiState === 'idle' || aiState === 'error' ? (
                <>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                         <h3 className="font-display font-bold text-xl flex items-center gap-2 mb-1"><Sparkles size={20} className="text-primary"/> Scripta AI</h3>
                         <div className="flex items-center gap-2 text-sm">
                            <span className="opacity-60">Remaining Points:</span>
                            <span className={`font-bold ${aiPoints < 5 ? 'text-red-500' : 'text-primary'}`}>{aiPoints}/30</span>
                         </div>
                      </div>
                      <button onClick={() => setShowAIModal(false)} className="p-2 hover:bg-black/5 rounded-full transition-colors"><X size={20}/></button>
                    </div>

                    {aiState === 'error' && (
                        <div className="mb-4 p-3 bg-red-500/10 text-red-500 rounded-xl text-sm border border-red-500/20 animate-fade-in flex items-center gap-2">
                             <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"/>
                             {aiErrorMsg}
                        </div>
                    )}

                    <div className="flex p-1 bg-black/5 dark:bg-white/5 rounded-xl mb-6">
                        <button 
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${aiMode === 'presets' ? 'bg-surface shadow-sm text-primary scale-[1.02]' : 'opacity-50 hover:opacity-80'}`}
                            onClick={() => { setAiMode('presets'); vibrate(10); }}
                        >
                            Presets
                        </button>
                        <button 
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${aiMode === 'custom' ? 'bg-surface shadow-sm text-primary scale-[1.02]' : 'opacity-50 hover:opacity-80'}`}
                            onClick={() => { setAiMode('custom'); vibrate(10); }}
                        >
                            Custom
                        </button>
                    </div>
                    {aiMode === 'presets' && (
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                          <PresetButton label="Rewrite Clarity" cost={COSTS.REWRITE} onClick={() => handlePresetAssist('rewrite', COSTS.REWRITE)} disabled={!checkPointsAvailable(COSTS.REWRITE)} />
                          <PresetButton label="Summarize" cost={COSTS.SUMMARIZE} onClick={() => handlePresetAssist('summarize', COSTS.SUMMARIZE)} disabled={!checkPointsAvailable(COSTS.SUMMARIZE)} />
                          <PresetButton label="Expand Ideas" cost={COSTS.EXPAND} onClick={() => handlePresetAssist('expand', COSTS.EXPAND)} disabled={!checkPointsAvailable(COSTS.EXPAND)} />
                          <PresetButton label="Proofread" cost={COSTS.REWRITE} onClick={() => handlePresetAssist('proofread', COSTS.REWRITE)} disabled={!checkPointsAvailable(COSTS.REWRITE)} />
                        </div>
                    )}
                    {aiMode === 'custom' && (
                        <div className="space-y-4 animate-fade-in">
                            <textarea 
                                className="w-full h-32 bg-black/5 dark:bg-white/5 rounded-xl p-4 resize-none outline-none focus:ring-2 ring-primary/20 transition-all text-sm"
                                placeholder="E.g. Turn this into a poem, or Check for grammar errors..."
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                            />
                            <div className="flex items-center justify-between text-xs opacity-60 px-1">
                                <span>Cost based on length</span>
                                <span>~{calculateCustomCost(customPrompt.length)} pts</span>
                            </div>
                            <Button 
                                className="w-full gap-2 transition-transform active:scale-95 duration-200" 
                                onClick={handleCustomAssist} 
                                disabled={!customPrompt.trim() || !checkPointsAvailable(calculateCustomCost(customPrompt.length))}
                            >
                                <Wand2 size={18}/> Generate
                            </Button>
                        </div>
                    )}
                </>
            ) : (
                <div className="flex flex-col h-full min-h-[300px] animate-fade-in">
                    <div className="flex items-center justify-between mb-4 border-b border-black/5 pb-4">
                        <div className="flex items-center gap-2 text-primary font-bold">
                             {aiState === 'thinking' ? (
                                 <>
                                     <Sparkles size={18} className="animate-pulse-glow"/>
                                     <span className="animate-pulse">Thinking...</span>
                                 </>
                             ) : (
                                 <>
                                     <Check size={18} className="animate-scale-in"/>
                                     <span>Suggestion Ready</span>
                                 </>
                             )}
                        </div>
                        {aiState !== 'streaming' && (
                            <button onClick={resetAI} className="p-2 hover:bg-black/5 rounded-full"><X size={18}/></button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto bg-black/5 dark:bg-white/5 rounded-xl p-4 mb-4 font-light text-base leading-relaxed relative min-h-[150px]">
                        {aiState === 'thinking' ? (
                             <div className="space-y-3 opacity-50">
                                 <div className="h-4 bg-current rounded w-3/4 animate-shimmer opacity-30"></div>
                                 <div className="h-4 bg-current rounded w-full animate-shimmer opacity-20"></div>
                                 <div className="h-4 bg-current rounded w-5/6 animate-shimmer opacity-25"></div>
                             </div>
                        ) : (
                             <div className="whitespace-pre-wrap">
                                {streamingText}
                                {aiState === 'streaming' && <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse"/>}
                             </div>
                        )}
                    </div>

                    <div className="flex gap-3 justify-end mt-auto">
                        <Button variant="ghost" onClick={resetAI} disabled={aiState === 'streaming'}>Discard</Button>
                        <Button 
                            onClick={confirmAIInsertion} 
                            icon={<Check size={18}/>} 
                            className="shadow-xl shadow-primary/20 transition-all duration-500 ease-spring active:scale-90"
                            disabled={aiState !== 'done'}
                        >
                            Use Text
                        </Button>
                    </div>
                </div>
            )}
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

const PresetButton = ({ label, cost, onClick, disabled }: { label: string, cost: number, onClick: () => void, disabled: boolean }) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className="w-full flex items-center justify-between p-4 rounded-xl bg-surface border border-black/5 dark:border-white/5 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 disabled:opacity-50 disabled:hover:border-transparent disabled:hover:bg-surface group active:scale-[0.98] hover:shadow-md ease-spring"
    >
        <span className="font-medium group-hover:text-primary transition-colors">{label}</span>
        <span className="text-xs font-mono opacity-50 bg-black/5 dark:bg-white/10 px-2 py-1 rounded-md">{cost} pts</span>
    </button>
);

const MobileMenuItem = ({ icon, label, onClick, active, loading }: { icon: React.ReactNode, label: string, onClick: () => void, active?: boolean, loading?: boolean }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${active ? 'bg-primary/10 text-primary' : 'hover:bg-black/5 dark:hover:bg-white/5 text-surface-fg/80'}`}
    >
        <span className={`${active ? 'text-primary' : ''}`}>
           {loading ? <span className="animate-spin block w-4 h-4 border-2 border-current border-t-transparent rounded-full"/> : icon}
        </span>
        <span className="font-medium">{label}</span>
    </button>
);