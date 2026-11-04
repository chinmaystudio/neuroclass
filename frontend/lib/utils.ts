import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge must know the design-system tokens (frontend/index.css),
 * otherwise it mistakes custom sizes like `text-meta` for colours and drops
 * them when a colour class such as `text-ink-2` follows.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['page', 'section', 'card', 'body', 'support', 'meta', 'button'],
      radius: ['control', 'button', 'card', 'dialog'],
      shadow: ['card', 'raised', 'dialog'],
      color: [
        'primary', 'primary-hover', 'primary-light', 'primary-soft', 'primary-dark', 'on-primary',
        'canvas', 'surface', 'surface-2', 'ink', 'ink-2', 'ink-3', 'line', 'line-2', 'overlay',
        'success', 'success-ink', 'success-bg', 'warning', 'warning-ink', 'warning-bg',
        'danger', 'danger-ink', 'danger-bg', 'info', 'info-ink', 'info-bg',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
