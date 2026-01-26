import React, { useState } from 'react';
import { Activity } from '../types';
import { Search, Link as LinkIcon, X, Calendar, Clock } from 'lucide-react';

interface ActivityPickerProps {
  activities: Activity[];
  onSelect: (activityId: string) => void;
  onClose: () => void;
}

export const ActivityPicker: React.FC<ActivityPickerProps> = ({ activities, onSelect, onClose }) => {
  const [query, setQuery] = useState('');

  const filtered = activities.filter(a => 
    a.title.toLowerCase().includes(query.toLowerCase()) || 
    a.content.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-md animate-fade-in" onClick={onClose}>
       <div 
          className="bg-surface w-full max-w-xl rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[85vh] animate-slide-up border border-white/10"
          onClick={e => e.stopPropagation()}
       >
          <div className="p-6 border-b border-black/5 dark:border-white/5 flex items-center gap-4 bg-background/50">
             <div className="p-2 bg-primary/10 text-primary rounded-xl">
                <Search size={22}/>
             </div>
             <input 
                autoFocus
                placeholder="Search thoughts to link..." 
                className="flex-1 bg-transparent outline-none text-xl font-display font-medium placeholder:text-surface-fg/30"
                value={query}
                onChange={e => setQuery(e.target.value)}
             />
             <button 
                onClick={onClose}
                className="p-2 hover:bg-black/5 rounded-full transition-colors opacity-50 hover:opacity-100"
             >
                <X size={24} />
             </button>
          </div>
          
          <div className="overflow-y-auto p-4 space-y-2 no-scrollbar">
             {query === '' && activities.length > 0 && (
                 <div className="px-4 py-2 mb-2 text-[10px] uppercase font-black tracking-widest text-primary opacity-50">
                    Recent Thoughts
                 </div>
             )}
             
             {filtered.length === 0 ? (
                 <div className="p-12 text-center opacity-40 flex flex-col items-center gap-4">
                     <div className="p-4 bg-black/5 dark:bg-white/5 rounded-full">
                        <Search size={32} />
                     </div>
                     <p className="text-lg">No matching thoughts found</p>
                 </div>
             ) : (
                 filtered.map(a => (
                     <button 
                        key={a.id}
                        onClick={() => onSelect(a.id)}
                        className="w-full text-left p-5 hover:bg-primary/5 dark:hover:bg-primary/10 rounded-2xl transition-all group flex flex-col gap-1 border border-transparent hover:border-primary/20 active:scale-[0.98]"
                     >
                        <div className="font-bold font-display text-lg truncate flex items-center justify-between">
                            <span className="group-hover:text-primary transition-colors">{a.title || 'Untitled Thought'}</span>
                            <div className="p-1.5 bg-primary/5 text-primary rounded-lg opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                                <LinkIcon size={16} />
                            </div>
                        </div>
                        <div className="text-sm opacity-40 line-clamp-1 italic font-light">
                            {a.content || 'Blank activity...'}
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-[10px] font-bold uppercase tracking-wider opacity-30">
                            <span className="flex items-center gap-1"><Calendar size={10}/> {new Date(a.updatedAt).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1"><Clock size={10}/> {a.wordCount} Words</span>
                        </div>
                     </button>
                 ))
             )}
          </div>
          
          <div className="p-4 bg-background/50 border-t border-black/5 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-30">
                  Select a thought to create a bidirectional bridge
              </p>
          </div>
       </div>
    </div>
  );
};