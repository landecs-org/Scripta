import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Activity } from '../types';
import { Calendar, TrendingUp, Clock, FileText, Flame, Award } from 'lucide-react';

interface HistoryProps {
  activities: Activity[];
}

export const History: React.FC<HistoryProps> = ({ activities }) => {
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    const updateWidth = () => {
        if (containerRef.current) {
            setContainerWidth(containerRef.current.clientWidth);
        }
    };

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    updateWidth(); // Initial call
    
    return () => resizeObserver.disconnect();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    
    // 1. Basic Stats
    const totalWords = activities.reduce((acc, curr) => acc + curr.wordCount, 0);
    const totalActivities = activities.filter(a => !a.deleted).length;
    
    const longestActivity = activities.reduce((prev, current) => 
        (prev.wordCount > current.wordCount) ? prev : current
    , activities[0] || { title: 'None', wordCount: 0 });

    // 2. Chart Data (Last 7 Days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getTime() - (6 - i) * oneDay);
      const count = activities.filter(a => {
        const ad = new Date(a.updatedAt);
        return ad.getDate() === d.getDate() && 
               ad.getMonth() === d.getMonth() && 
               ad.getFullYear() === d.getFullYear();
      }).reduce((acc, curr) => acc + curr.wordCount, 0);
      return { 
          day: d.toLocaleDateString('en-US', { weekday: 'short' }), 
          count, 
          fullDate: d 
      };
    });

    const maxCount = Math.max(...last7Days.map(d => d.count), 50); // Min max is 50 for scale

    // 3. Streak
    const activeDates = Array.from(new Set(activities.map(a => new Date(a.updatedAt).toDateString())))
        .map((d: string) => new Date(d).getTime())
        .sort((a, b) => b - a);

    let currentStreak = 0;
    if (activeDates.length > 0) {
        const todayStr = new Date().toDateString();
        const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
        const lastActive = new Date(activeDates[0]).toDateString();
        
        if (lastActive === todayStr || lastActive === yesterdayStr) {
            currentStreak = 1;
            for (let i = 0; i < activeDates.length - 1; i++) {
                const diff = (activeDates[i] - activeDates[i+1]) / (1000 * 60 * 60 * 24);
                if (Math.round(diff) === 1) currentStreak++;
                else break;
            }
        }
    }

    // 4. Best Day
    const dayCounts: Record<string, number> = {};
    activities.forEach(a => {
        const dayName = new Date(a.updatedAt).toLocaleDateString('en-US', { weekday: 'long' });
        dayCounts[dayName] = (dayCounts[dayName] || 0) + a.wordCount;
    });
    let bestDay = 'None';
    let maxDayCount = 0;
    Object.entries(dayCounts).forEach(([day, count]) => {
        if (count > maxDayCount) {
            maxDayCount = count;
            bestDay = day;
        }
    });

    return { totalWords, totalActivities, longestActivity, last7Days, maxCount, currentStreak, bestDay };
  }, [activities]);

  // Generate SVG Path
  const getPath = (data: {count: number}[], width: number, height: number) => {
      if (data.length === 0) return "";
      if (width === 0) return "";
      const stepX = width / (data.length - 1 || 1);
      const points = data.map((d, i) => {
          const x = i * stepX;
          const y = height - (d.count / stats.maxCount) * height; // Invert Y
          return `${x},${y}`;
      });
      return `M ${points.join(" L ")}`;
  };
  
  const getAreaPath = (data: {count: number}[], width: number, height: number) => {
     const linePath = getPath(data, width, height);
     return `${linePath} L ${width},${height} L 0,${height} Z`;
  };

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto px-4 md:px-6 w-full animate-fade-in pt-6 pb-20 overflow-y-auto no-scrollbar">
      <h1 className="text-3xl font-display font-bold mb-8">Writing History</h1>

      {/* Hero Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        <div className="bg-surface p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
           <div className="opacity-50 text-sm mb-1 flex items-center gap-2"><FileText size={14}/> Total Words</div>
           <div className="text-2xl font-bold font-display truncate">{stats.totalWords.toLocaleString()}</div>
        </div>
        <div className="bg-surface p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
           <div className="opacity-50 text-sm mb-1 flex items-center gap-2"><Flame size={14} className="text-orange-500"/> Current Streak</div>
           <div className="text-2xl font-bold font-display truncate">{stats.currentStreak} <span className="text-sm font-normal opacity-50">days</span></div>
        </div>
        <div className="bg-surface p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
           <div className="opacity-50 text-sm mb-1 flex items-center gap-2"><Award size={14} className="text-yellow-500"/> Best Day</div>
           <div className="text-xl font-bold font-display truncate">{stats.bestDay}</div>
        </div>
         <div className="bg-surface p-5 rounded-2xl border border-black/5 dark:border-white/5 shadow-sm">
           <div className="opacity-50 text-sm mb-1 flex items-center gap-2"><Clock size={14}/> Longest Activity</div>
           <div className="text-lg font-bold font-display truncate" title={stats.longestActivity.title}>{stats.longestActivity.title || 'Untitled'}</div>
           <div className="text-xs opacity-60 truncate">{stats.longestActivity.wordCount} words</div>
        </div>
      </div>

      {/* Improved Chart */}
      <section className="bg-surface p-4 md:p-6 rounded-3xl border border-black/5 dark:border-white/5 shadow-sm mb-8 relative overflow-hidden flex flex-col">
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2 relative z-10">
            <Calendar size={18} className="text-primary"/>
            Activity (Last 7 Days)
        </h2>
        
        <div ref={containerRef} className="h-48 sm:h-64 md:h-72 w-full relative group touch-pan-x flex-1 min-h-[200px]">
           <svg 
             viewBox={`0 0 ${containerWidth} 300`} 
             preserveAspectRatio="none" 
             className="w-full h-full overflow-visible"
           >
               <defs>
                   <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
                       <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.2"/>
                       <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0"/>
                   </linearGradient>
               </defs>
               
               {/* Grid Lines */}
               <line x1="0" y1="75" x2={containerWidth} y2="75" stroke="currentColor" strokeOpacity="0.05" strokeDasharray="4"/>
               <line x1="0" y1="150" x2={containerWidth} y2="150" stroke="currentColor" strokeOpacity="0.05" strokeDasharray="4"/>
               <line x1="0" y1="225" x2={containerWidth} y2="225" stroke="currentColor" strokeOpacity="0.05" strokeDasharray="4"/>
               
               {/* Area */}
               <path 
                  d={getAreaPath(stats.last7Days, containerWidth, 300)} 
                  fill="url(#gradient)" 
                  className="transition-all duration-1000 ease-out"
               />
               
               {/* Line */}
               <path 
                  d={getPath(stats.last7Days, containerWidth, 300)} 
                  fill="none" 
                  stroke="var(--color-primary)" 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="transition-all duration-1000 ease-out"
               />

               {/* Points & Touch Targets */}
               {stats.last7Days.map((d, i) => {
                   const x = i * (containerWidth / 6);
                   const y = 300 - (d.count / stats.maxCount) * 300;
                   return (
                       <g key={i} className="group/point">
                           <line x1={x} y1={y} x2={x} y2={300} stroke="var(--color-primary)" strokeWidth="1" strokeDasharray="2" className="opacity-0 group-hover/point:opacity-30 transition-opacity"/>
                           <circle cx={x} cy={y} r="6" fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth="3" className="transition-all hover:r-8 z-10"/>
                           
                           {/* Tooltip */}
                           <foreignObject x={Math.max(0, Math.min(x - 50, containerWidth - 100))} y={Math.max(0, y - 60)} width="100" height="50" className="overflow-visible pointer-events-none">
                              <div className="flex flex-col items-center justify-center opacity-0 group-hover/point:opacity-100 transition-opacity duration-200">
                                <div className="bg-surface text-surface-fg text-xs py-1 px-2 rounded-lg shadow-xl border border-black/10 font-bold whitespace-nowrap">
                                  {d.count} words
                                </div>
                                <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-surface mt-[-1px]"></div>
                              </div>
                           </foreignObject>
                       </g>
                   );
               })}
           </svg>
           
           {/* X Axis Labels */}
           <div className="flex justify-between mt-4 px-1 absolute bottom-0 left-0 right-0 transform translate-y-6">
               {stats.last7Days.map((d, i) => (
                   <span key={i} className="text-xs opacity-50 font-medium text-center w-8">{d.day[0]}</span>
               ))}
           </div>
        </div>
      </section>
      
      <div className="text-center opacity-40 text-sm mt-8">
        <p>Keep writing. Your history is stored locally.</p>
      </div>
    </div>
  );
};