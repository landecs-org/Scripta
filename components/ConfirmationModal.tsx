import React from 'react';
import { Button } from './Button';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDangerous = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onCancel}>
      <div 
        className="bg-surface w-full max-w-sm mx-auto sm:rounded-2xl rounded-t-3xl shadow-2xl p-6 animate-slide-up border border-black/5 dark:border-white/5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-3 rounded-full ${isDangerous ? 'bg-red-100 text-red-600 dark:bg-red-900/20' : 'bg-primary/10 text-primary'}`}>
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-lg font-display font-bold">{title}</h3>
        </div>
        
        <p className="text-surface-fg/70 mb-6 leading-relaxed">
          {message}
        </p>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            {cancelLabel}
          </Button>
          <Button 
            variant={isDangerous ? 'danger' : 'primary'} 
            onClick={() => { onConfirm(); onCancel(); }} 
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};