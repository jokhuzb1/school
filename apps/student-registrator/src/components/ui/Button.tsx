import { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export function Button({ 
  variant = 'primary', 
  size = 'md', 
  loading = false,
  icon,
  children, 
  className = '',
  disabled,
  ...props 
}: ButtonProps) {
  const baseClass = 'button';
  const variantClass = `button-${variant}`;
  const sizeClass = `button-${size}`;
  const classes = [baseClass, variantClass, sizeClass, className].filter(Boolean).join(' ');

  return (
    <button 
      className={classes} 
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="spinner" />}
      {icon && <span className="button-icon">{icon}</span>}
      {children}
    </button>
  );
}
