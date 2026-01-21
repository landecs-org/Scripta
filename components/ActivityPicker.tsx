import React, { useState } from 'react';
import { Activity } from '../types';
import { Search, Link, X } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
       <div className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-slide-up">
          <div className="p-4 border-b border-black/5 dark:border-white/5 flex items-center gap-3">
             <Search size={20} className="opacity-50"/>
             <input 
                autoFocus
                placeholder="Search to link..." 
                className="flex-1 bg-transparent outline-none text-lg"
                value={query}
                onChange={e => setQuery(e.target.value)}
             />
             <button onClick={onClose}><X size={20} className="opacity-50 hover:opacity-100"/></button>
          </div>
          <div className="overflow-y-auto p-2">
             {filtered.length === 0 ? (
                 <div className="p-8 text-center opacity-50">No activities found</div>
             ) : (
                 filtered.map(a => (
                     <button 
                        key={a.id}
                        onClick={() => onSelect(a.id)}
                        className="w-full text-left p-4 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors group"
                     >
                        <div className="font-bold font-display truncate flex items-center gap-2">
                            <Link size={14} className="opacity-0 group-hover:opacity-100 text-primary transition-opacity"/>
                            {a.title || 'Untitled'}
                        </div>
                        <div className="text-sm opacity-50 truncate mt-1">{a.content || 'No content'}</div>
                     </button>
                 ))
             )}
          </div>
       </div>
    </div>
  );
};
