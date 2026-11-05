import React from 'react';

/**
 * NeuroClass icon set: a deliberately small set of geometric line icons
 * (24px grid, 1.75 stroke, round caps). Use only where an icon carries meaning
 * a label cannot; decorative icons are not part of the design system.
 * Icons are aria-hidden: pair them with visible text or an aria-label.
 */
export type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

export function createIcon(name: string, paths: React.ReactNode) {
  const Icon = ({ size = 18, strokeWidth = 1.75, ...rest }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths}
    </svg>
  );
  Icon.displayName = `Icon${name}`;
  return Icon;
}

export const IconCheck = createIcon('Check', <path d="M5 12.5l4.5 4.5L19 7.5" />);
export const IconClose = createIcon('Close', <path d="M6 6l12 12M18 6L6 18" />);
export const IconChevronDown = createIcon('ChevronDown', <path d="M6 9l6 6 6-6" />);
export const IconChevronRight = createIcon('ChevronRight', <path d="M9 6l6 6-6 6" />);
export const IconChevronLeft = createIcon('ChevronLeft', <path d="M15 6l-6 6 6 6" />);
export const IconSearch = createIcon('Search', <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>);
export const IconBell = createIcon('Bell', <><path d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15z" /><path d="M10 20.5h4" /></>);
export const IconMenu = createIcon('Menu', <path d="M4 7h16M4 12h16M4 17h16" />);
export const IconPlus = createIcon('Plus', <path d="M12 5v14M5 12h14" />);
export const IconMinus = createIcon('Minus', <path d="M5 12h14" />);
export const IconAlert = createIcon('Alert', <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.2v.1" /></>);
export const IconInfo = createIcon('Info', <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.8v.1" /></>);
export const IconCheckCircle = createIcon('CheckCircle', <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.7 2.7L16 9.8" /></>);
export const IconEye = createIcon('Eye', <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>);
export const IconEyeOff = createIcon('EyeOff', <><path d="M4 4l16 16" /><path d="M9.9 6A9.4 9.4 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 01-2.7 3.4M6.3 7.6A15.6 15.6 0 002.5 12S6 18.5 12 18.5a9 9 0 004-.9" /></>);
export const IconUpload = createIcon('Upload', <><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M4 15v4h16v-4" /></>);
export const IconFile = createIcon('File', <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></>);
export const IconCalendar = createIcon('Calendar', <><rect x="4" y="5.5" width="16" height="14.5" rx="1.5" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>);
export const IconClock = createIcon('Clock', <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>);
export const IconMore = createIcon('More', <><circle cx="5.5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="18.5" cy="12" r="1" fill="currentColor" /></>);
export const IconUser = createIcon('User', <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0114 0" /></>);
export const IconUsers = createIcon('Users', <><circle cx="9" cy="8.5" r="3.2" /><path d="M3 19.5a6 6 0 0112 0" /><path d="M15.5 5.6a3.2 3.2 0 010 5.8M17.5 13.8a6 6 0 013.5 5.7" /></>);
export const IconSignOut = createIcon('SignOut', <><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></>);
export const IconHome = createIcon('Home', <><path d="M4 11l8-6.5 8 6.5" /><path d="M6 9.5V20h12V9.5" /></>);
export const IconExternal = createIcon('External', <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v6H4V6h6" /></>);
export const IconSun = createIcon('Sun', <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>);
export const IconMoon = createIcon('Moon', <path d="M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z" />);

/** Indeterminate loading indicator (an icon so it inherits colour and size). */
export const IconSpinner = ({ size = 18, ...rest }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="animate-spin" {...rest}>
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
    <path d="M21 12a9 9 0 00-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);
