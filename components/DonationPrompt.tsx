import React from 'react';
import { Button } from './Button';
import { Heart, X } from 'lucide-react';

interface DonationPromptProps {
  onClose: () => void;
}

export const DonationPrompt: React.FC<DonationPromptProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className="bg-surface w-full max-w-sm mx-auto sm:rounded-2xl rounded-t-3xl shadow-2xl p-6 animate-slide-up border border-black/5 dark:border-white/5 relative"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 opacity-50 hover:opacity-100 transition-opacity">
            <X size={20}/>
        </button>

        <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4 animate-bounce-subtle">
                <Heart size={32} fill="currentColor" />
            </div>
            <h3 className="text-xl font-display font-bold mb-2">Enjoying Scripta?</h3>
            <p className="text-surface-fg/70 mb-6 leading-relaxed">
                Scripta is free, offline, and privacy-focused. If you find it useful, please consider supporting its development to keep it alive.
            </p>
            <div className="flex flex-col gap-3 w-full">
                <a 
                    href="https://www.landecs.org/docs/donation" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full"
                >
                    <Button className="w-full gap-2" onClick={onClose}>
                        <Heart size={18} /> Support Development
                    </Button>
                </a>
                <Button variant="ghost" onClick={onClose}>
                    Maybe Later
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
};