import React from 'react';
import { cn } from '../../lib/utils';

/** Calm, accessible avatar colours (white text ≥ 4.5:1 on each). */
const PALETTE = ['#1a73e8', '#188038', '#c5221f', '#174ea6', '#b05a00', '#0e7480', '#5f6368', '#0b5e55'];

export const initialsOf = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';

const colourOf = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

export type AvatarProps = { name: string; src?: string | null; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string };

const SIZE = { sm: 'h-7 w-7 text-[0.6875rem]', md: 'h-9 w-9 text-meta', lg: 'h-12 w-12 text-body', xl: 'h-16 w-16 text-section' };

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md', className }) => {
  const [failed, setFailed] = React.useState(false);
  const base = cn('inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold', SIZE[size], className);
  if (src && !failed) return <img data-ui="avatar" src={src} alt={name} className={cn(base, 'object-cover')} onError={() => setFailed(true)} />;
  return (
    <span data-ui="avatar" role="img" aria-label={name} className={cn(base, 'text-white')} style={{ backgroundColor: colourOf(name) }}>
      {initialsOf(name)}
    </span>
  );
};
