
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Activity } from '../types';
import { ArrowLeft, ChevronDown, ChevronUp, Link as LinkIcon, Palette, BarChart2, Share2, Copy, FileText, Download, Maximize2, Minimize2, MoreVertical, Clock, ArrowRight } from 'lucide-react';
import { dbService } from '../services/db';
import { ActivityPicker } from './ActivityPicker';
import { AnalyticsSheet } from './AnalyticsSheet';
import { ConfirmationModal } from './ConfirmationModal';
import { analyzeText } from '../utils/analytics';
import { getAdaptiveColor, isDarkMode } from '../utils/colors';
import { exportActivity } from '../utils/dataTransfer';
import { CARD_COLORS, DEFAULT_SETTINGS } from '../constants';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

interface EditorProps {
  activity: Activity;
  onSave: (activity: Activity) => Promise<void>;
  onBack: () => void;
  showWordCount: boolean;
  allActivities?: Activity[];
  onSwitchActivity: (activity: Activity) => void;
}

// Reusable Auto-Resizing Textarea for Blocks
const AutoTextarea = ({ value, onChange, onKeyDown, autoFocus, placeholder, className, onBlur, onFocus, selectionStart }: any) => {
    const ref = useRef<HTMLTextAreaElement>(null);

    // Auto-resize
    useEffect(() => {
        if(ref.current) {
            ref.current.style.height = 'auto';
            ref.current.style.height = ref.current.scrollHeight + 'px';
        }
    }, [value]);

    // Handle Focus and Selection
    useEffect(() => {
        if (autoFocus && ref.current) {
            ref.current.focus();
            if (typeof selectionStart === 'number') {
                ref.current.setSelectionRange(selectionStart, selectionStart);
            } else {
                // Default to end
                const len = ref.current.value.length;
                ref.current.setSelectionRange(len, len);
            }
        }
    }, [autoFocus, selectionStart]);

    return (
        <textarea
            ref={ref}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            onFocus={onFocus}
            placeholder={placeholder}
            rows={1}
            className={`resize-none overflow-hidden outline-none bg-transparent w-full ${className}`}
        />
    )
}

// Markdown Renderer for a single block
const MarkdownBlock: React.FC<{ content: string }> = ({ content }) => {
    if (!content) return <div className="h-[1.5em] w-full opacity-0 pointer-events-none">.</div>; // Spacer

    const renderContent = (text: string) => {
        let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        // Images
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="rounded-xl my-3 max-w-full shadow-lg hover:scale-[1.01] transition-transform duration-500 ease-spring" />');

        // Headers
        if (html.startsWith('# ')) return `<h1 class="text-3xl sm:text-4xl font-bold mt-6 mb-3 tracking-tight text-primary">${html.substring(2)}</h1>`;
        if (html.startsWith('## ')) return `<h2 class="text-2xl sm:text-3xl font-bold mt-4 mb-2 tracking-tight opacity-90">${html.substring(3)}</h2>`;
        if (html.startsWith('### ')) return `<h3 class="text-xl sm:text-2xl font-bold mt-3 mb-1 tracking-tight opacity-80">${html.substring(4)}</h3>`;

        // Blockquotes
        if (html.startsWith('> ')) return `<blockquote class="border-l-4 border-primary/50 pl-4 italic opacity-70 my-3 py-1 bg-black/5 dark:bg-white/5 rounded-r-lg">${html.substring(2)}</blockquote>`;

        // Lists
        if (html.match(/^\s*-\s+/)) return `<div class="flex gap-3 my-1 ml-1"><span class="text-primary font-bold">&bull;</span><span>${html.replace(/^\s*-\s+/, '')}</span></div>`;
        if (html.match(/^\s*\d+\.\s+/)) return `<div class="flex gap-3 my-1 ml-1"><span class="text-primary font-mono font-bold opacity-60">${html.match(/^\s*(\d+\.)\s+/)?.[1]}</span><span>${html.replace(/^\s*\d+\.\s+/, '')}</span></div>`;

        // Checkboxes
        if (html.match(/^\s*\[ \]\s+/)) return `<div class="flex items-center gap-3 my-1 group cursor-pointer opacity-80 hover:opacity-100 transition-opacity"><div class="w-5 h-5 border-2 border-surface-fg/30 rounded-md group-hover:border-primary transition-colors"></div><span class="decoration-surface-fg/30">${html.replace(/^\s*\[ \]\s+/, '')}</span></div>`;
        if (html.match(/^\s*\[x\]\s+/)) return `<div class="flex items-center gap-3 my-1 group cursor-pointer"><div class="w-5 h-5 bg-primary text-white flex items-center justify-center rounded-md shadow-sm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div><span class="opacity-40 line-through decoration-2">${html.replace(/^\s*\[x\]\s+/, '')}</span></div>`;
        
        // Horizontal Rule
        if (html.match(/^---$/)) return `<hr class="border-t-2 border-black/5 dark:border-white/5 my-6"/>`;

        // Inline styles
        html = html.replace(/`([^`]+)`/g, '<code class="bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-mono text-[0.9em] mx-0.5">$1</code>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-primary/90">$1</strong>');
        html = html.replace(/__(.*?)__/g, '<strong class="font-bold text-primary/90">$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em class="italic opacity-80">$1</em>');
        html = html.replace(/_(.*?)_/g, '<em class="italic opacity-80">$1</em>');
        html = html.replace(/~~(.*?)~~/g, '<del class="opacity-50">$1</del>');
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline decoration-primary/30 hover:decoration-primary transition-all">$1</a>');

        return `<p class="leading-loose min-h-[1.5em]">${html}</p>`;
    };

    return <div dangerouslySetInnerHTML={{ __html: renderContent(content) }} className="markdown-block break-words" />;
};

const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

export const Editor: React.FC<EditorProps> = ({ activity, onSave, onBack, showWordCount, allActivities = [], onSwitchActivity }) => {
  const settings = JSON.parse(localStorage.getItem('scripta_settings') || JSON.stringify(DEFAULT_SETTINGS));
  const isLivePreview = settings.livePreview;

  const [title, setTitle] = useState(activity.title);
  
  // Initialize blocks
  const [blocks, setBlocks] = useState<{id: string, content: string}[]>(() => 
      activity.content ? activity.content.split('\n').map(c => ({ id: generateId(), content: c })) : [{ id: generateId(), content: '' }]
  );
  
  const [content, setContent] = useState(activity.content);
  
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [cursorOffset, setCursorOffset] = useState<number | null>(null);

  const [flatColor, setFlatColor] = useState(activity.flatColor);
  const [adaptiveColor, setAdaptiveColor] = useState(activity.flatColor);
  const [linkedActivities, setLinkedActivities] = useState<Activity[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [collapsedLinks, setCollapsedLinks] = useState<Record<string, boolean>>({});

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Confirms
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', isDangerous: false, onConfirm: () => {} });

  const stats = useMemo(() => analyzeText(content), [content]);

  useEffect(() => {
      setAdaptiveColor(getAdaptiveColor(flatColor, isDarkMode()));
  }, [flatColor]);

  const vibrate = (ms = 10) => {
     if (navigator.vibrate && settings.enableHaptics) navigator.vibrate(ms);
  };

  // Sync Blocks to Content string for saving/export
  useEffect(() => {
      if (isLivePreview) {
          const joined = blocks.map(b => b.content).join('\n');
          if (joined !== content) setContent(joined);
      }
  }, [blocks, isLivePreview]);

  // Sync Content string to Blocks (if external change)
  useEffect(() => {
      const currentBlockContent = blocks.map(b => b.content).join('\n');
      if (content !== currentBlockContent && activity.content !== currentBlockContent) {
          // External update
          setBlocks(activity.content.split('\n').map(c => ({ id: generateId(), content: c })));
      }
  }, [activity.id]); 

  // Auto-save
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (title !== activity.title || content !== activity.content || flatColor !== activity.flatColor) {
        setIsSaving(true);
        await onSave({ ...activity, title, content, flatColor, wordCount: stats.words, updatedAt: new Date().toISOString() });
        setIsSaving(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [title, content, flatColor]);

  // Link loading
  useEffect(() => {
    const loadLinked = async () => {
        if (activity.linkedActivityIds?.length) {
            const results = await Promise.all(activity.linkedActivityIds.map(id => dbService.getActivity(id)));
            setLinkedActivities(results.filter((a): a is Activity => !!a));
        }
    };
    loadLinked();
  }, [activity.linkedActivityIds]);

  const handleBlockChange = (index: number, val: string) => {
      setBlocks(prev => {
          const newBlocks = [...prev];
          newBlocks[index] = { ...newBlocks[index], content: val };
          return newBlocks;
      });
  };

  const handleBlockKeyDown = (index: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const target = e.currentTarget;
          const selectionStart = target.selectionStart;
          const content = blocks[index].content;
          
          const firstHalf = content.slice(0, selectionStart);
          const secondHalf = content.slice(selectionStart);

          const newId = generateId();
          
          setBlocks(prev => {
              const newBlocks = [...prev];
              newBlocks[index] = { ...newBlocks[index], content: firstHalf };
              newBlocks.splice(index + 1, 0, { id: newId, content: secondHalf });
              return newBlocks;
          });
          
          setFocusIndex(index + 1);
          setCursorOffset(0); // Focus start of new block
          
      } else if (e.key === 'Backspace') {
          if (blocks[index].content === '' && blocks.length > 1) {
              e.preventDefault();
              setBlocks(prev => {
                  const newBlocks = [...prev];
                  newBlocks.splice(index, 1);
                  return newBlocks;
              });
              setFocusIndex(Math.max(0, index - 1));
              setCursorOffset(null); // Focus end by default
          } else if (e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0 && index > 0) {
              e.preventDefault();
              const prevContent = blocks[index - 1].content;
              const currentContent = blocks[index].content;
              
              setBlocks(prev => {
                  const newBlocks = [...prev];
                  newBlocks[index - 1] = { ...newBlocks[index - 1], content: prevContent + currentContent };
                  newBlocks.splice(index, 1);
                  return newBlocks;
              });
              setFocusIndex(index - 1);
              setCursorOffset(prevContent.length); // Restore cursor position
          }
      } else if (e.key === 'ArrowUp') {
          if (index > 0 && e.currentTarget.selectionStart === 0) {
              e.preventDefault();
              setFocusIndex(index - 1);
              setCursorOffset(null); 
          }
      } else if (e.key === 'ArrowDown') {
          if (index < blocks.length - 1 && e.currentTarget.selectionStart === e.currentTarget.value.length) {
              e.preventDefault();
              setFocusIndex(index + 1);
              setCursorOffset(0);
          }
      }
  };

  const handleLinkActivity = async (id: string) => {
      setShowMobileMenu(false); setShowLinkPicker(false);
      if (activity.linkedActivityIds?.includes(id) || id === activity.id) return;
      
      const linked = await dbService.getActivity(id);
      if (linked) {
          setLinkedActivities(p => [...p, linked]);
          await onSave({ ...activity, linkedActivityIds: [...(activity.linkedActivityIds||[]), id], updatedAt: new Date().toISOString() });
          vibrate();
      }
  };

  return (
    <div 
        className={`flex flex-col h-full animate-slide-up bg-surface transition-colors duration-700 ease-fluid ${focusMode ? 'fixed inset-0 z-[100]' : ''}`} 
        style={adaptiveColor && adaptiveColor !== 'transparent' ? { backgroundColor: adaptiveColor } : {}}
        onClick={() => { if(showExportMenu) setShowExportMenu(false); if(showMobileMenu) setShowMobileMenu(false); }}
    >
      {!focusMode && (
          <div className="flex items-center justify-between p-4 glass sticky top-0 z-20 border-b border-black/5 dark:border-white/5 transition-all duration-300 print:hidden select-none min-h-[64px] backdrop-blur-xl bg-surface/50">
            <button onClick={() => { onBack(); vibrate(); }} className="p-2 hover:bg-black/5 rounded-full transition-colors text-surface-fg/70 hover:text-primary active:scale-95 duration-200">
              <ArrowLeft size={24} />
            </button>
            
            <div className="flex items-center gap-1 sm:gap-2 relative">
              {isSaving && <div className="mr-2 px-3 py-1 bg-primary/10 rounded-full text-[10px] uppercase font-bold text-primary animate-pulse">Autosaving</div>}
              
              <div className="hidden md:flex items-center gap-1">
                  <button onClick={() => { setShowColorPicker(!showColorPicker); vibrate(); }} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 transition-transform" title="Color"><Palette size={20} /></button>
                  <button onClick={() => { setShowLinkPicker(true); vibrate(); }} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 transition-transform" title="Link"><LinkIcon size={20} /></button>
                  <button onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); vibrate(); }} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 transition-transform" title="Share"><Share2 size={20} /></button>
              </div>

              <button onClick={() => { setFocusMode(true); vibrate(); }} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90 transition-transform" title="Focus"><Maximize2 size={20} /></button>

              <div className="md:hidden relative">
                  <button onClick={(e) => { e.stopPropagation(); setShowMobileMenu(!showMobileMenu); vibrate(); }} className="p-2 hover:bg-black/5 rounded-full text-surface-fg/70 active:scale-90">
                      <MoreVertical size={20} />
                  </button>
                  {showMobileMenu && (
                      <div className="absolute top-12 right-0 bg-surface rounded-xl shadow-xl border border-black/10 w-56 animate-scale-in z-30 p-2 flex flex-col">
                          <button onClick={() => setShowColorPicker(true)} className="flex items-center gap-3 p-3 hover:bg-black/5 rounded-lg"><Palette size={18}/> Color Theme</button>
                          <button onClick={() => setShowLinkPicker(true)} className="flex items-center gap-3 p-3 hover:bg-black/5 rounded-lg"><LinkIcon size={18}/> Link Activity</button>
                          <button onClick={() => setShowExportMenu(true)} className="flex items-center gap-3 p-3 hover:bg-black/5 rounded-lg"><Share2 size={18}/> Share</button>
                          <button onClick={() => setShowAnalytics(true)} className="flex items-center gap-3 p-3 hover:bg-black/5 rounded-lg"><BarChart2 size={18}/> Stats</button>
                      </div>
                  )}
              </div>

              {showExportMenu && (
                 <div className="absolute top-12 right-0 bg-surface rounded-xl shadow-xl border border-black/10 w-48 animate-scale-in z-30 overflow-hidden">
                    <button onClick={() => { navigator.clipboard.writeText(`${title}\n\n${content}`); setShowExportMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-black/5 flex items-center gap-2"><Copy size={16}/> Copy Text</button>
                    <button onClick={() => { exportActivity(activity, 'txt'); setShowExportMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-black/5 flex items-center gap-2"><FileText size={16}/> Save as .txt</button>
                    <button onClick={() => { exportActivity(activity, 'md'); setShowExportMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-black/5 flex items-center gap-2"><Download size={16}/> Save as .md</button>
                 </div>
              )}
            </div>
          </div>
      )}

      {focusMode && (
          <button onClick={() => setFocusMode(false)} className="fixed top-6 right-6 z-[110] p-4 text-surface-fg/30 hover:text-surface-fg hover:bg-black/5 rounded-full transition-all active:scale-90">
             <Minimize2 size={28} />
          </button>
      )}

      <div className={`flex-1 overflow-y-auto w-full no-scrollbar scroll-smooth transition-all duration-700 ease-fluid ${focusMode ? 'px-4 sm:px-[5vw] pt-24 pb-32 flex flex-col items-center' : 'px-4 py-8 max-w-3xl mx-auto pb-32'}`}>
        <input 
          type="text" 
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled Thought"
          className={`bg-transparent font-display font-bold placeholder:text-surface-fg/20 outline-none text-surface-fg transition-all duration-500 ease-fluid ${focusMode ? 'text-4xl sm:text-5xl text-left leading-tight mb-16 w-full max-w-4xl opacity-90' : 'text-3xl sm:text-4xl w-full mb-8'}`}
        />

        <div className={`w-full transition-all duration-500 ease-fluid ${focusMode ? 'max-w-4xl' : ''}`}>
            {isLivePreview ? (
                <div className="flex flex-col min-h-[60vh] pb-[30vh]">
                    <AnimatePresence initial={false}>
                    {blocks.map((block, idx) => (
                        <motion.div 
                           key={block.id} 
                           layout
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
                           transition={{ type: "spring", stiffness: 500, damping: 30 }}
                           className={`relative group pl-4 -ml-4 border-l-2 ${focusIndex === idx ? 'border-primary/50 bg-primary/5 sm:bg-transparent sm:border-primary/30' : 'border-transparent'}`}
                           onClick={() => { if(focusIndex !== idx) setFocusIndex(idx); }}
                        >
                            {/* Focus Indicator (Desktop) */}
                            {focusIndex === idx && (
                                <motion.div layoutId="activeBlockIndicator" className="hidden sm:block absolute -left-[13px] top-2.5 w-1.5 h-1.5 rounded-full bg-primary" />
                            )}
                            
                            {focusIndex === idx ? (
                                <AutoTextarea 
                                    autoFocus 
                                    selectionStart={cursorOffset}
                                    value={block.content} 
                                    onChange={(val: string) => handleBlockChange(idx, val)} 
                                    onKeyDown={(e: any) => handleBlockKeyDown(idx, e)}
                                    onBlur={() => { setFocusIndex(null); setCursorOffset(null); }}
                                    className={`text-lg leading-loose font-light ${focusMode ? 'text-xl sm:text-2xl' : ''}`}
                                    placeholder={blocks.length === 1 ? "Start writing..." : ""}
                                />
                            ) : (
                                <div className={`text-lg leading-loose font-light cursor-text ${focusMode ? 'text-xl sm:text-2xl' : ''} ${!block.content ? 'h-6' : ''}`}>
                                    <MarkdownBlock content={block.content} />
                                </div>
                            )}
                        </motion.div>
                    ))}
                    </AnimatePresence>
                    
                    {/* Click area to append */}
                    <div 
                       className="flex-1 cursor-text min-h-[150px] opacity-0 hover:opacity-100 transition-opacity flex items-start pt-4 text-sm text-surface-fg/20" 
                       onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            const newId = generateId();
                            const newBlocks = [...blocks, { id: newId, content: '' }];
                            setBlocks(newBlocks);
                            setFocusIndex(newBlocks.length - 1);
                            setCursorOffset(0);
                        }
                       }}
                    >
                       Click to append...
                    </div>
                </div>
            ) : (
                <textarea 
                   ref={textareaRef}
                   value={content}
                   onChange={(e) => setContent(e.target.value)}
                   placeholder="Start writing..."
                   className={`w-full bg-transparent resize-none outline-none font-light text-surface-fg placeholder:text-surface-fg/20 transition-all duration-500 ease-fluid pb-[40vh] text-left selectable-text ${focusMode ? 'text-xl sm:text-2xl leading-[2] tracking-wide min-h-[80vh]' : 'text-lg leading-loose min-h-[60vh] mobile-safe-height'}`}
                />
            )}
        </div>

        {/* Links */}
        {!focusMode && linkedActivities.length > 0 && (
            <div className="mt-12 pt-12 relative print:hidden w-full border-t border-black/5 dark:border-white/5 animate-fade-in">
                <div className="flex items-center justify-between mb-8 px-2">
                    <h3 className="text-xs font-bold uppercase tracking-widest opacity-40 flex items-center gap-2">
                        <LinkIcon size={14} className="text-primary"/> Linked ({linkedActivities.length})
                    </h3>
                </div>
                <div className="space-y-6">
                    {linkedActivities.map(link => (
                        <div key={link.id} className="bg-surface/60 backdrop-blur-sm border border-black/5 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group">
                            <div className="p-4 bg-primary/5 cursor-pointer flex justify-between items-center group-hover:bg-primary/10 transition-colors" onClick={() => setCollapsedLinks(p => ({ ...p, [link.id]: !p[link.id] }))}>
                                <div className="font-bold text-primary flex gap-2 items-center"><LinkIcon size={14}/> {link.title || 'Untitled'}</div>
                                {collapsedLinks[link.id] ? <ChevronDown size={14} className="opacity-50"/> : <ChevronUp size={14} className="opacity-50"/>}
                            </div>
                            <div className={`transition-all duration-500 ease-spring overflow-hidden ${collapsedLinks[link.id] ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100 p-4'}`}>
                                <div className="text-sm opacity-80 leading-relaxed font-light">
                                    {link.content.substring(0, 200)}...
                                </div>
                                <button onClick={() => onSwitchActivity(link)} className="mt-4 text-xs font-bold uppercase tracking-wider text-primary opacity-60 hover:opacity-100 flex items-center gap-1">
                                    Open Note <ArrowRight size={12}/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* Footer */}
      {!focusMode && showWordCount && (
        <button onClick={() => setShowAnalytics(true)} className="fixed bottom-0 left-0 right-0 glass border-t border-black/5 p-4 flex justify-between items-center text-[11px] font-bold uppercase tracking-widest text-surface-fg/50 hover:text-primary transition-colors z-20 backdrop-blur-xl">
           <div className="flex gap-6 mx-auto max-w-3xl w-full px-6">
             <span className="flex items-center gap-1.5"><FileText size={12}/> {stats.words} Words</span>
             <span className="flex items-center gap-1.5"><Clock size={12}/> {stats.readingTime} Read</span>
           </div>
        </button>
      )}

      {/* Modals */}
      {showColorPicker && (
          <div className="fixed inset-0 z-30" onClick={() => setShowColorPicker(false)}>
            <div className="absolute top-20 right-4 p-5 bg-surface/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-black/5 z-30 grid grid-cols-3 gap-3 animate-scale-in" onClick={e => e.stopPropagation()}>
                {CARD_COLORS.map(c => (
                    <button key={c} onClick={() => { setFlatColor(c); setShowColorPicker(false); vibrate(); }} className="w-11 h-11 rounded-full border border-black/10 shadow-sm hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
                ))}
            </div>
          </div>
      )}

      {showLinkPicker && (
          <ActivityPicker activities={allActivities.filter(a => a.id !== activity.id && !a.deleted)} onSelect={handleLinkActivity} onClose={() => setShowLinkPicker(false)} />
      )}

      {showAnalytics && <AnalyticsSheet stats={stats} onClose={() => setShowAnalytics(false)} />}
      
      <ConfirmationModal isOpen={confirmState.isOpen} title={confirmState.title} message={confirmState.message} isDangerous={confirmState.isDangerous} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState({ ...confirmState, isOpen: false })} />
    </div>
  );
};
