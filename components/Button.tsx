import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  icon, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:active:scale-100";
  
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-3",
    lg: "px-6 py-4 text-lg",
  };

  const variants = {
    primary: "bg-primary text-primary-fg shadow-lg shadow-primary/30 hover:shadow-primary/40",
    secondary: "bg-surface text-surface-fg border border-black/5 dark:border-white/10 shadow-sm hover:bg-black/5 dark:hover:bg-white/5",
    ghost: "text-surface-fg hover:bg-black/5 dark:hover:bg-white/5",
    danger: "bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600",
  };

  return (
    <button 
      className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${className}`} 
      {...props}
    >
      {icon && <span className="mr-2 -ml-1">{icon}</span>}
      {children}
    </button>
  );
};