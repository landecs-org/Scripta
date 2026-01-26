import React, { useState, useMemo, useRef } from 'react';
import { Activity } from '../types';
import { Search, Plus, Calendar, FileText, Trash2, Archive, RefreshCw, Copy, Palette, Filter, Check } from 'lucide-react';
import { Button } from './Button';
import { ConfirmationModal } from './ConfirmationModal';
import { CARD_COLORS } from '../constants';
import { getAdaptiveColor } from '../utils/colors';

interface DashboardProps {
  activities: Activity[];
  onSelect: (activity: Activity) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  isTrashView?: boolean;
  isArchiveView?: boolean;
  cardDensity: 'comfortable' | 'compact';
  isDarkMode: boolean;
}

type DateFilter = 'all' | '7days' | '30days';

export const Dashboard: React.FC<DashboardProps> = ({ 
  activities, 
  onSelect, 
  onCreate, 
  onDelete,
  onRestore,
  isTrashView = false, 
  isArchiveView = false,
  cardDensity,
  isDarkMode
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ id: string, x: number, y: number } | null>(null);
  const [selectedForColor, setSelectedForColor] = useState<string | null>(null);
  
  // Confirmation State
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

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      // 1. Search Filter
      const matchSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          a.content.toLowerCase().includes(searchQuery.toLowerCase());
      
      // 2. Date Filter
      let matchDate = true;
      if (dateFilter !== 'all') {
          const date = new Date(a.updatedAt);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - date.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (dateFilter === '7days') matchDate = diffDays <= 7;
          if (dateFilter === '30days') matchDate = diffDays <= 30;
      }

      // 3. View Filter (Trash/Archive/Main)
      if (isTrashView) return matchSearch && matchDate && a.deleted;
      if (isArchiveView) return matchSearch && matchDate && a.archived && !a.deleted;
      
      return matchSearch && matchDate && !a.archived && !a.deleted;
    });
  }, [activities, searchQuery, dateFilter, isTrashView, isArchiveView]);

  const handleTouchStart = (id: string, e: React.TouchEvent) => {
      const touch = e.touches[0];
      timerRef.current = setTimeout(() => {
          setContextMenu({ id, x: touch.clientX, y: touch.clientY });
      }, 500);
  };

  const handleTouchEnd = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleContextMenu = (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({ id, x: e.clientX, y: e.clientY });
  };

  const triggerConfirm = (title: string, message: string, isDangerous: boolean, onConfirm: () => void) => {
    setConfirmState({ isOpen: true, title, message, isDangerous, onConfirm });
  };

  const handleAction = async (action: 'delete' | 'restore' | 'duplicate' | 'archive' | 'color', id: string) => {
      setContextMenu(null);
      
      if (action === 'delete') {
         const msg = isTrashView || isArchiveView 
            ? "This will permanently delete the activity. This action cannot be undone." 
            : "Move this activity to the trash?";
         
         triggerConfirm(
            isTrashView || isArchiveView ? "Delete Forever?" : "Move to Trash?",
            msg,
            true,
            () => onDelete(id)
         );
         return;
      }

      if (action === 'restore') {
          triggerConfirm("Restore Activity?", "This will move the activity back to your dashboard.", false, () => onRestore(id));
          return;
      }

      if (action === 'duplicate') {
          triggerConfirm("Duplicate Activity?", "Create a copy of this activity?", false, () => {
              const event = new CustomEvent('dashboard-action', { detail: { action: 'duplicate', id } });
              window.dispatchEvent(event);
          });
          return;
      }
      
      if (action === 'archive') {
          triggerConfirm("Archive Activity?", "Move this to the archive? It will be hidden from the dashboard.", false, () => {
              const event = new CustomEvent('dashboard-action', { detail: { action: 'archive', id } });
              window.dispatchEvent(event);
          });
          return;
      }

      if (action === 'color') setSelectedForColor(id);
  };

  const title = isTrashView ? 'Trash' : isArchiveView ? 'Archive' : 'Dashboard';
  const densityClass = cardDensity === 'compact' ? 'h-32' : 'h-48';

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto px-4 md:px-8 w-full animate-fade-in" onClick={() => { setContextMenu(null); setShowFilterMenu(false); }}>
      {/* Header */}
      <header className="py-6 flex flex-col gap-4 sticky top-0 bg-background/95 backdrop-blur-md z-10 transition-colors duration-500">
        <div className="flex items-center justify-between pl-12 sm:pl-0">
          <h1 className="text-3xl font-display font-bold">{title}</h1>
          {!isTrashView && !isArchiveView && (
            <Button onClick={onCreate} icon={<Plus size={20} />}>New</Button>
          )}
        </div>
        
        {/* Search & Filter */}
        <div className="flex gap-2">
            <div className="relative group flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Search your thoughts..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface pl-12 pr-4 py-4 rounded-2xl shadow-sm border border-transparent focus:border-primary/50 focus:ring-4 focus:ring-primary/10 outline-none transition-all text-lg placeholder:text-gray-400"
              />
            </div>
            
            <div className="relative">
                <button 
                    onClick={(e) => { e.stopPropagation(); setShowFilterMenu(!showFilterMenu); }}
                    className={`h-full aspect-square flex items-center justify-center rounded-2xl border border-transparent transition-all ${dateFilter !== 'all' ? 'bg-primary text-primary-fg shadow-lg shadow-primary/20' : 'bg-surface text-surface-fg hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                    <Filter size={20} />
                </button>
                
                {showFilterMenu && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-surface rounded-xl shadow-xl border border-black/5 dark:border-white/5 p-1 animate-scale-in z-20 origin-top-right">
                        <button onClick={() => setDateFilter('all')} className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-sm font-medium">
                            All Time {dateFilter === 'all' && <Check size={14} className="text-primary"/>}
                        </button>
                        <button onClick={() => setDateFilter('7days')} className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-sm font-medium">
                            Last 7 Days {dateFilter === '7days' && <Check size={14} className="text-primary"/>}
                        </button>
                        <button onClick={() => setDateFilter('30days')} className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-sm font-medium">
                            Last 30 Days {dateFilter === '30days' && <Check size={14} className="text-primary"/>}
                        </button>
                    </div>
                )}
            </div>
        </div>
      </header>

      {/* Grid */}
      <main className="flex-1 overflow-y-auto pb-24 no-scrollbar">
        {filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center opacity-50">
            <FileText size={48} className="mb-4 text-gray-300 dark:text-gray-700" />
            <p className="text-lg">No activities found.</p>
            {dateFilter !== 'all' && <button onClick={() => setDateFilter('all')} className="mt-2 text-primary text-sm hover:underline">Clear filters</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
            {filteredActivities.map((activity) => {
              const adaptiveColor = getAdaptiveColor(activity.flatColor, isDarkMode);
              
              return (
              <div 
                key={activity.id}
                onClick={() => onSelect(activity)}
                onContextMenu={(e) => handleContextMenu(activity.id, e)}
                onTouchStart={(e) => handleTouchStart(activity.id, e)}
                onTouchEnd={handleTouchEnd}
                className={`group relative bg-surface p-6 rounded-2xl shadow-sm border border-black/5 dark:border-white/5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-fluid cursor-pointer flex flex-col overflow-hidden ${densityClass}`}
                style={adaptiveColor && adaptiveColor !== 'transparent' ? { backgroundColor: adaptiveColor, borderColor: 'transparent' } : {}}
              >
                <h3 className="font-display font-bold text-xl mb-2 line-clamp-1 leading-tight mix-blend-hard-light text-surface-fg">
                  {activity.title || 'Untitled Activity'}
                </h3>
                <p className="text-sm opacity-60 mb-4 line-clamp-2 flex-1 font-light leading-relaxed text-surface-fg">
                  {activity.content || 'No content...'}
                </p>
                <div className="flex items-center justify-between text-xs opacity-40 mt-auto pt-4 border-t border-black/5 dark:border-white/10 text-surface-fg">
                  <div className="flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(activity.updatedAt).toLocaleDateString()}
                  </div>
                  <div>{activity.wordCount} words</div>
                </div>
              </div>
            )})}
          </div>
        )}
      </main>

      {/* Context Menu & Modals */}
      {contextMenu && (
          <div 
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/10 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none"
            onClick={(e) => { e.stopPropagation(); setContextMenu(null); }}
          >
             <div 
                className="bg-surface w-full max-w-md mx-auto sm:w-64 rounded-t-2xl sm:rounded-xl shadow-2xl p-2 border border-black/5 dark:border-white/5 animate-slide-up sm:absolute sm:animate-fade-in overflow-hidden" 
                style={window.innerWidth > 640 ? { top: contextMenu.y, left: contextMenu.x, margin: 0 } : {}}
                onClick={e => e.stopPropagation()}
             >
                <div className="flex flex-col gap-1">
                    {!isTrashView && !isArchiveView && (
                        <>
                           <button onClick={() => handleAction('duplicate', contextMenu.id)} className="flex items-center gap-3 p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-left transition-colors">
                               <Copy size={18} /> Duplicate
                           </button>
                           <button onClick={() => handleAction('color', contextMenu.id)} className="flex items-center gap-3 p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-left transition-colors">
                               <Palette size={18} /> Set Color
                           </button>
                           <hr className="opacity-10 my-1"/>
                           <button onClick={() => handleAction('archive', contextMenu.id)} className="flex items-center gap-3 p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-left transition-colors">
                               <Archive size={18} /> Archive
                           </button>
                           <button onClick={() => handleAction('delete', contextMenu.id)} className="flex items-center gap-3 p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-left text-red-500 transition-colors">
                               <Trash2 size={18} /> Trash
                           </button>
                        </>
                    )}
                    {isTrashView ? (
                        <button onClick={() => handleAction('restore', contextMenu.id)} className="flex items-center gap-3 p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-left text-green-500 transition-colors">
                           <RefreshCw size={18} /> Restore
                        </button>
                    ) : null}
                    {(isTrashView || isArchiveView) && (
                        <button onClick={() => handleAction('delete', contextMenu.id)} className="flex items-center gap-3 p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-left text-red-500 transition-colors">
                           <Trash2 size={18} /> Delete Forever
                        </button>
                    )}
                </div>
             </div>
          </div>
      )}

      {selectedForColor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedForColor(null)}>
              <div className="bg-surface p-6 rounded-2xl shadow-xl max-w-sm w-full animate-slide-up" onClick={e => e.stopPropagation()}>
                  <h3 className="font-bold mb-4">Select Color</h3>
                  <div className="grid grid-cols-4 gap-4">
                      {CARD_COLORS.map(color => (
                          <button 
                            key={color} 
                            onClick={() => {
                                const event = new CustomEvent('dashboard-action', { detail: { action: 'set-color', id: selectedForColor, color } });
                                window.dispatchEvent(event);
                                setSelectedForColor(null);
                            }}
                            className="w-12 h-12 rounded-full border-2 border-black/10 dark:border-white/10 shadow-sm transition-transform active:scale-95 relative overflow-hidden"
                            style={{ backgroundColor: color }}
                          >
                             {color === 'transparent' && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-full h-0.5 bg-red-500/50 rotate-45 transform scale-125"></div>
                                </div>
                             )}
                          </button>
                      ))}
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