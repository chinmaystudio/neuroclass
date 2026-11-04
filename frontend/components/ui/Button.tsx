import React from 'react';
import { cn } from '../../lib/utils';
import { IconSpinner } from './icons';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button and keeps its width stable. */
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-dark dark:active:bg-primary-hover',
  secondary: 'bg-primary-light text-primary-dark hover:bg-primary-soft',
  outline: 'border border-line bg-surface text-primary hover:bg-primary-light hover:border-primary-soft',
  text: 'text-primary hover:bg-primary-light',
  danger: 'bg-danger text-white hover:brightness-95 active:brightness-90 dark:text-[#601410]',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 gap-1.5 text-[0.8125rem]',
  md: 'h-9 px-4 gap-2 text-button',
  lg: 'h-11 px-5 gap-2 text-[0.9375rem]',
};

export const buttonClasses = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string) =>
  cn(
    'focus-ring inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-button font-medium',
    'transition-[background-color,border-color,color,filter] duration-[var(--duration-fast)] ease-[var(--ease-standard)]',
    'disabled:pointer-events-none disabled:cursor-not-allowed',
    VARIANTS[variant],
    variant === 'outline' || variant === 'text'
      ? 'disabled:text-ink-3 disabled:bg-transparent'
      : 'disabled:bg-surface-2 disabled:text-ink-3 disabled:border-transparent',
    SIZES[size],
    extra,
  );

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, iconLeft, iconRight, fullWidth, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-ui="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, cn(fullWidth && 'w-full', className))}
      {...rest}
    >
      {loading ? <IconSpinner size={16} /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
});

export type IconButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  /** Required: icon-only buttons must have an accessible name. */
  label: string;
  icon: React.ReactNode;
  variant?: 'ghost' | 'outline' | 'primary';
  size?: 'sm' | 'md';
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = 'ghost', size = 'md', className, type = 'button', title, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-ui="icon-button"
      aria-label={label}
      title={title ?? label}
      className={cn(
        'focus-ring inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--duration-fast)]',
        'disabled:pointer-events-none disabled:text-ink-3',
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        variant === 'outline' && 'border border-line text-ink-2 hover:bg-surface-2 hover:text-ink',
        variant === 'primary' && 'bg-primary text-on-primary hover:bg-primary-hover',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
});
