import React, { useState } from 'react';
import { Button } from './Button';
import { CloudOff, PenTool, ArrowRight, Check, BarChart3 } from 'lucide-react';

interface OnboardingProps {
  onComplete: (analyticsEnabled: boolean) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);

  const steps = [
    {
      icon: <PenTool size={48} className="text-primary" />,
      title: "Welcome to Scripta",
      description: "A focused, distraction-free workspace designed for thinking and deep writing.",
    },
    {
      icon: <CloudOff size={48} className="text-primary" />,
      title: "Offline First",
      description: "Your data stays on your device. No accounts, no tracking, no cloud sync required.",
    },
    {
      icon: <BarChart3 size={48} className="text-primary" />,
      title: "Anonymous Analytics",
      description: "Help us improve Scripta by sharing completely anonymous usage data. You can change this later in Settings.",
      isChoice: true
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(analyticsConsent);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-8 animate-fade-in">
        <div className="flex justify-center mb-8">
            <div className="w-24 h-24 bg-surface rounded-3xl shadow-xl flex items-center justify-center border border-black/5 dark:border-white/5 animate-scale-in">
                {steps[step].icon}
            </div>
        </div>
        
        <div className="space-y-4">
            <h1 className="text-3xl font-display font-bold text-surface-fg animate-slide-up">
                {steps[step].title}
            </h1>
            <p className="text-lg text-surface-fg/70 leading-relaxed">
                {steps[step].description}
            </p>
        </div>

        <div className="pt-8">
            {steps[step].isChoice ? (
                <div className="flex gap-4">
                    <Button 
                        variant="secondary" 
                        onClick={() => { setAnalyticsConsent(false); setTimeout(() => onComplete(false), 200); }} 
                        className="flex-1 py-4"
                    >
                        Opt Out
                    </Button>
                    <Button 
                        onClick={() => { setAnalyticsConsent(true); setTimeout(() => onComplete(true), 200); }} 
                        className="flex-1 py-4 shadow-xl shadow-primary/20"
                    >
                        Enable
                    </Button>
                </div>
            ) : (
                <Button onClick={handleNext} className="w-full text-lg py-4 shadow-xl shadow-primary/20">
                    <span className="flex items-center gap-2">Next <ArrowRight size={20}/></span>
                </Button>
            )}
            
            <div className="flex justify-center gap-2 mt-6">
                {steps.map((_, i) => (
                    <div 
                        key={i} 
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${i === step ? 'bg-primary w-6' : 'bg-surface-fg/20'}`}
                    />
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};