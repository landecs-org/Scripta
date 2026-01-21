import React from 'react';
import { TextStats } from '../utils/analytics';
import { X, Clock, Type, AlignLeft, Hash, BookOpen, Mic } from 'lucide-react';

interface AnalyticsSheetProps {
  stats: TextStats;
  onClose: () => void;
}

export const AnalyticsSheet: React.FC<AnalyticsSheetProps> = ({ stats, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/20 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="bg-surface w-full max-w-lg mx-auto sm:rounded-2xl rounded-t-3xl shadow-2xl border border-black/5 dark:border-white/5 animate-slide-up overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-black/5 dark:border-white/5 flex items-center justify-between bg-background/50 backdrop-blur-md">
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            <Hash size={20} className="text-primary"/> 
            Analytics
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full opacity-60">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-6">
          
          {/* Primary Stats */}
          <div className="grid grid-cols-2 gap-4">
             <div className="bg-background p-4 rounded-xl border border-black/5 dark:border-white/5">
                <div className="text-sm opacity-50 mb-1">Words</div>
                <div className="text-3xl font-display font-bold text-primary">{stats.words}</div>
             </div>
             <div className="bg-background p-4 rounded-xl border border-black/5 dark:border-white/5">
                <div className="text-sm opacity-50 mb-1">Characters</div>
                <div className="text-3xl font-display font-bold">{stats.chars}</div>
             </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-6">
             <StatItem label="Chars (no spaces)" value={stats.charsNoSpaces} icon={<Type size={16}/>} />
             <StatItem label="Paragraphs" value={stats.paragraphs} icon={<AlignLeft size={16}/>} />
             <StatItem label="Sentences" value={stats.sentences} icon={<AlignLeft size={16}/>} />
             <StatItem label="Unique Words" value={stats.uniqueWords} icon={<Hash size={16}/>} />
             <StatItem label="Avg. Word Length" value={stats.avgWordLength} icon={<Type size={16}/>} />
          </div>

          <hr className="border-black/5 dark:border-white/5 my-2"/>

          {/* Time & Readability */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-background rounded-xl">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Clock size={18}/></div>
                 <div>
                   <div className="text-sm font-semibold">Reading Time</div>
                   <div className="text-xs opacity-50">~200 wpm</div>
                 </div>
               </div>
               <div className="text-lg font-bold">{stats.readingTime}</div>
            </div>

            <div className="flex items-center justify-between p-3 bg-background rounded-xl">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-green-500/10 text-green-500 rounded-lg"><Mic size={18}/></div>
                 <div>
                   <div className="text-sm font-semibold">Speaking Time</div>
                   <div className="text-xs opacity-50">~130 wpm</div>
                 </div>
               </div>
               <div className="text-lg font-bold">{stats.speakingTime}</div>
            </div>

            <div className="flex flex-col gap-2 p-4 bg-background rounded-xl border border-black/5 dark:border-white/5">
                <div className="flex items-center gap-2 mb-2">
                   <BookOpen size={16} className="text-primary"/>
                   <span className="font-semibold text-sm">Readability Score</span>
                </div>
                <div className="flex items-end justify-between">
                    <span className="text-2xl font-bold">{stats.readabilityScore}</span>
                    <span className="text-xs opacity-50 mb-1">/ 100</span>
                </div>
                <div className="w-full bg-black/5 dark:bg-white/5 h-2 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-400" 
                      style={{ width: `${stats.readabilityScore}%` }}
                    />
                </div>
                <p className="text-xs opacity-70 mt-1 text-right">{stats.readabilityLabel}</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

const StatItem = ({ label, value, icon }: { label: string, value: number | string, icon: React.ReactNode }) => (
  <div className="flex items-center justify-between">
     <div className="flex items-center gap-2 opacity-70">
       {icon}
       <span className="text-sm">{label}</span>
     </div>
     <span className="font-semibold">{value}</span>
  </div>
);
