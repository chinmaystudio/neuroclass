import React from 'react';
import {
  createIcon as c,
  IconAlert, IconBell, IconCalendar, IconCheck, IconCheckCircle, IconChevronDown, IconChevronLeft, IconChevronRight,
  IconClock, IconClose, IconExternal, IconEye, IconEyeOff, IconFile, IconHome, IconInfo, IconMenu, IconMinus, IconMore,
  IconMoon, IconPlus, IconSearch, IconSignOut, IconSun, IconUpload, IconUser, IconUsers, IconSpinner,
} from './icons';

/**
 * Drop-in replacements for the Lucide icons the legacy screens used, drawn in
 * the NeuroClass line style (24px grid, 1.75 stroke). Same export names and
 * `size` / `className` props, so screens migrate by changing one import.
 * Decorative "AI" glyphs (sparkles, brain, wand, bot) map to neutral icons.
 */

const circle = <circle cx="12" cy="12" r="9" />;

export const Check = IconCheck;
export const X = IconClose;
export const ChevronDown = IconChevronDown;
export const ChevronLeft = IconChevronLeft;
export const ChevronRight = IconChevronRight;
export const Search = IconSearch;
export const Bell = IconBell;
export const Menu = IconMenu;
export const Plus = IconPlus;
export const Minus = IconMinus;
export const MoreHorizontal = IconMore;
export const Eye = IconEye;
export const EyeOff = IconEyeOff;
export const ExternalLink = IconExternal;
export const Home = IconHome;
export const User = IconUser;
export const UserRound = IconUser;
export const Users = IconUsers;
export const LogOut = IconSignOut;
export const Sun = IconSun;
export const Moon = IconMoon;
export const UploadCloud = IconUpload;
export const Upload = IconUpload;
export const FileUp = IconUpload;
export const FileText = c('FileText', <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></>);
export const File = IconFile;
export const Clock = IconClock;
export const Clock3 = IconClock;
export const Hourglass = c('Hourglass', <><path d="M7 3h10M7 21h10" /><path d="M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9" /></>);
export const CalendarClock = IconCalendar;
export const Calendar = IconCalendar;
export const AlertTriangle = IconAlert;
export const AlertCircle = c('AlertCircle', <>{circle}<path d="M12 7.5V13M12 16.2v.1" /></>);
export const HelpCircle = c('HelpCircle', <>{circle}<path d="M9.6 9.3a2.5 2.5 0 014.8.9c0 1.7-2.4 2.1-2.4 3.6M12 16.8v.1" /></>);
export const Info = IconInfo;
export const CheckCircle = IconCheckCircle;
export const CheckCircle2 = IconCheckCircle;
export const XCircle = c('XCircle', <>{circle}<path d="M9 9l6 6M15 9l-6 6" /></>);
export const Loader2 = IconSpinner;
export const LoaderCircle = IconSpinner;

export const ArrowLeft = c('ArrowLeft', <path d="M19 12H5M11 6l-6 6 6 6" />);
export const ArrowRight = c('ArrowRight', <path d="M5 12h14M13 6l6 6-6 6" />);
export const ArrowUp = c('ArrowUp', <path d="M12 19V5M6 11l6-6 6 6" />);
export const ArrowDown = c('ArrowDown', <path d="M12 5v14M6 13l6 6 6-6" />);
export const CornerDownRight = c('CornerDownRight', <path d="M5 5v7a3 3 0 003 3h11M15 11l4 4-4 4" />);
export const RefreshCw = c('RefreshCw', <><path d="M20 11a8 8 0 00-14.3-4.3L4 9" /><path d="M4 4v5h5" /><path d="M4 13a8 8 0 0014.3 4.3L20 15" /><path d="M20 20v-5h-5" /></>);
export const RotateCcw = c('RotateCcw', <><path d="M4 12a8 8 0 108-8 8 8 0 00-5.7 2.3L4 8.5" /><path d="M4 4v4.5h4.5" /></>);
export const Undo2 = c('Undo2', <><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" /></>);
export const Download = c('Download', <><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" /><path d="M4 15v4h16v-4" /></>);
export const Import = Download;
export const Copy = c('Copy', <><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="1.5" /><path d="M15.5 8.5V5.5A1.5 1.5 0 0014 4H5.5A1.5 1.5 0 004 5.5V14a1.5 1.5 0 001.5 1.5h3" /></>);
export const Trash2 = c('Trash2', <><path d="M4 7h16M10 3.5h4M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5" /></>);
export const Archive = c('Archive', <><rect x="3.5" y="4" width="17" height="4.5" rx="1" /><path d="M5 8.5V20h14V8.5M10 12.5h4" /></>);
export const Pencil = c('Pencil', <><path d="M4 20l1-4.5L15.5 5a2 2 0 012.9 0l.6.6a2 2 0 010 2.9L8.5 19z" /><path d="M13.5 7l3.5 3.5" /></>);
export const Wand2 = Pencil;
export const Save = c('Save', <><path d="M5 4h11.5L20 7.5V20H4V5a1 1 0 011-1z" /><path d="M8 4v5h7V4M8 20v-6h8v6" /></>);
export const Send = c('Send', <><path d="M21 3L10 14" /><path d="M21 3l-7 18-4-7-7-4z" /></>);
export const Paperclip = c('Paperclip', <path d="M20 11.5l-8 8a5 5 0 01-7-7l8.5-8.5a3.3 3.3 0 014.7 4.7L9.7 17a1.6 1.6 0 01-2.3-2.3l7.6-7.6" />);
export const Filter = c('Filter', <path d="M4 5h16l-6 7.5V19l-4 1.5v-8z" />);
export const ListFilter = c('ListFilter', <path d="M4 6h16M7 12h10M10 18h4" />);
export const Sliders = c('Sliders', <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>);
export const Settings = c('Settings', <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5" /><circle cx="12" cy="12" r="6.5" /></>);
export const Maximize2 = c('Maximize2', <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />);
export const Expand = Maximize2;

export const Play = c('Play', <path d="M7 4.5v15l12-7.5z" />);
export const PlayCircle = c('PlayCircle', <>{circle}<path d="M10 8.5v7l5.5-3.5z" /></>);
export const PlaySquare = c('PlaySquare', <><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M10 8.5v7l5.5-3.5z" /></>);
export const Square = c('Square', <rect x="4.5" y="4.5" width="15" height="15" rx="1.5" />);
export const CheckSquare = c('CheckSquare', <><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M8 12.5l2.8 2.8L16 10" /></>);
export const Radio = c('Radio', <><circle cx="12" cy="12" r="2" /><path d="M7.8 7.8a6 6 0 000 8.4M16.2 7.8a6 6 0 010 8.4M5 5a10 10 0 000 14M19 5a10 10 0 010 14" /></>);
export const Video = c('Video', <><rect x="3" y="6" width="12.5" height="12" rx="1.5" /><path d="M15.5 10.5L21 7v10l-5.5-3.5" /></>);
export const Camera = c('Camera', <><path d="M4 8h3.5l1.5-2.5h6L16.5 8H20v11H4z" /><circle cx="12" cy="13" r="3.5" /></>);
export const Scan = c('Scan', <path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M7 12h10" />);
export const Monitor = c('Monitor', <><rect x="3" y="4" width="18" height="12.5" rx="1.5" /><path d="M8.5 20h7M12 16.5V20" /></>);
export const Wifi = c('Wifi', <><path d="M2.5 9a14 14 0 0119 0M5.5 12.5a9.5 9.5 0 0113 0M8.7 16a5 5 0 016.6 0" /><path d="M12 19.5v.1" /></>);
export const WifiOff = c('WifiOff', <><path d="M3 3l18 18" /><path d="M8.7 16a5 5 0 016.6 0M5.5 12.5a9.5 9.5 0 014.2-2.3M2.5 9a14 14 0 014.3-2.8M14.5 10.3a9.5 9.5 0 014 2.2M17.4 6.4A14 14 0 0121.5 9" /><path d="M12 19.5v.1" /></>);
export const MapPin = c('MapPin', <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>);
export const LocateFixed = c('LocateFixed', <><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></>);
export const Flag = c('Flag', <><path d="M5 21V4" /><path d="M5 4.5h12l-2.5 4 2.5 4H5" /></>);

export const Shield = c('Shield', <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" />);
export const ShieldCheck = c('ShieldCheck', <><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" /><path d="M8.8 12.2l2.3 2.3 4.3-4.4" /></>);
export const ShieldAlert = c('ShieldAlert', <><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" /><path d="M12 8.5v4.5M12 16v.1" /></>);
export const Lock = c('Lock', <><rect x="5" y="10.5" width="14" height="10" rx="1.5" /><path d="M8 10.5V7.5a4 4 0 018 0v3" /></>);
export const LockKeyhole = c('LockKeyhole', <><rect x="5" y="10.5" width="14" height="10" rx="1.5" /><path d="M8 10.5V7.5a4 4 0 018 0v3M12 14.5v2" /></>);
export const Key = c('Key', <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16.5 6.5l2.5 2.5M14 9l2 2" /></>);
export const Mail = c('Mail', <><rect x="3" y="5.5" width="18" height="13" rx="1.5" /><path d="M3.5 6.5L12 13l8.5-6.5" /></>);
export const Phone = c('Phone', <path d="M6.5 3.5h3l1.5 4.5-2 1.5a11 11 0 005.5 5.5l1.5-2 4.5 1.5v3a2 2 0 01-2 2A16 16 0 014.5 5.5a2 2 0 012-2z" />);
export const MessageCircle = c('MessageCircle', <path d="M20 11.5a8 8 0 01-11.6 7.1L4 20l1.4-4.2A8 8 0 1120 11.5z" />);
export const Bot = MessageCircle;
export const ThumbsUp = c('ThumbsUp', <><path d="M7.5 10.5V20H4v-9.5z" /><path d="M7.5 10.5L11 3.5a2.3 2.3 0 012.5 2.6L13 9.5h5.5a2 2 0 012 2.3l-1.2 6.6a2 2 0 01-2 1.6H7.5" /></>);
export const ThumbsDown = c('ThumbsDown', <><path d="M7.5 13.5V4H4v9.5z" /><path d="M7.5 13.5L11 20.5a2.3 2.3 0 002.5-2.6L13 14.5h5.5a2 2 0 002-2.3l-1.2-6.6a2 2 0 00-2-1.6H7.5" /></>);
export const Hash = c('Hash', <path d="M5 9h15M4 15h15M10 3.5L8 20.5M16 3.5l-2 17" />);

export const BookOpen = c('BookOpen', <><path d="M12 6.5C10 5 7 4.5 3.5 5v13.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z" /><path d="M12 6.5V20" /></>);
export const GraduationCap = c('GraduationCap', <><path d="M2.5 9.5L12 5l9.5 4.5L12 14z" /><path d="M6.5 11.5v4.5c3 2.5 8 2.5 11 0v-4.5M21.5 9.5v5" /></>);
export const ClipboardList = c('ClipboardList', <><rect x="5" y="4.5" width="14" height="16.5" rx="1.5" /><path d="M9 3h6v3H9zM9 11h6M9 15h6" /></>);
export const BrainCircuit = ClipboardList;
export const Layers = c('Layers', <><path d="M12 3.5l9 4.5-9 4.5L3 8z" /><path d="M3 12.5l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5" /></>);
export const LayoutDashboard = c('LayoutDashboard', <><rect x="3.5" y="3.5" width="7" height="8" rx="1" /><rect x="13.5" y="3.5" width="7" height="5" rx="1" /><rect x="13.5" y="11.5" width="7" height="9" rx="1" /><rect x="3.5" y="14.5" width="7" height="6" rx="1" /></>);
export const LayoutTemplate = LayoutDashboard;
export const Layout = LayoutDashboard;
export const BarChart3 = c('BarChart3', <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" />);
export const TrendingUp = c('TrendingUp', <><path d="M3.5 17l6-6 4 4 7-7.5" /><path d="M15 7.5h5.5V13" /></>);
export const Activity = c('Activity', <path d="M3 12h4l2.5-7 5 14 2.5-7h4" />);
export const Award = c('Award', <><circle cx="12" cy="9" r="5.5" /><path d="M8.7 13.5L7.5 21l4.5-2.5 4.5 2.5-1.2-7.5" /></>);
export const Medal = Award;
export const Star = c('Star', <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />);
export const Lightbulb = c('Lightbulb', <><path d="M9 17.5h6M10 21h4" /><path d="M8.5 14.5a6 6 0 117 0c-.8.6-1 1.5-1 2.5h-5c0-1-.2-1.9-1-2.5z" /></>);
export const Sparkles = Lightbulb;
export const Rocket = c('Rocket', <><path d="M14 4c3.5-1 6 0 6 0s1 2.5 0 6l-6.5 6.5-6-6z" /><path d="M7.5 10.5L4 11l3-4h4M13.5 16.5L13 20l4-3v-4" /><circle cx="15" cy="9" r="1.5" /></>);
export const Zap = c('Zap', <path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" />);
export const FlaskConical = c('FlaskConical', <><path d="M9.5 3.5h5M10 3.5v6L4.5 19a1 1 0 00.9 1.5h13.2a1 1 0 00.9-1.5L14 9.5v-6" /><path d="M7 15h10" /></>);
export const Microscope = FlaskConical;
export const Code2 = c('Code2', <path d="M8.5 7l-5 5 5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15" />);
export const Database = c('Database', <><ellipse cx="12" cy="6" rx="7.5" ry="2.8" /><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" /></>);
export const HardDrive = c('HardDrive', <><path d="M4 13l2.5-8h11L20 13v6H4z" /><path d="M4 13h16M16.5 16.3v.1" /></>);
export const FileSpreadsheet = c('FileSpreadsheet', <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 12h6v6h-6zM13 12v6M10 15h6" /></>);
export const Building = c('Building', <><rect x="5" y="3.5" width="14" height="17" rx="1" /><path d="M9 7.5h2M13 7.5h2M9 11.5h2M13 11.5h2M10.5 20.5v-4h3v4" /></>);
export const UserCheck = c('UserCheck', <><circle cx="10" cy="8.5" r="3.5" /><path d="M3.5 20a6.5 6.5 0 0111.5-4.2M15.5 18l2 2 4-4.5" /></>);
export const UserPlus = c('UserPlus', <><circle cx="10" cy="8.5" r="3.5" /><path d="M3.5 20a6.5 6.5 0 0113 0M19 8v6M16 11h6" /></>);
export const LogIn = c('LogIn', <><path d="M14 4h5v16h-5" /><path d="M9 8l4 4-4 4M3 12h10" /></>);
export const CreditCard = c('CreditCard', <><rect x="3" y="5.5" width="18" height="13" rx="1.5" /><path d="M3 10h18M7 15h3" /></>);
export const WalletCards = CreditCard;
export const CircleDollarSign = c('CircleDollarSign', <>{circle}<path d="M14.5 9.2c-.4-.9-1.4-1.4-2.5-1.4-1.5 0-2.6.8-2.6 2s1.2 1.6 2.6 2 2.6.9 2.6 2.1-1.1 2-2.6 2c-1.1 0-2.1-.5-2.5-1.4M12 6.3v1.5M12 16.2v1.5" /></>);

/* Brand marks (footer social links): simple geometric stand-ins. */
export const Github = c('Github', <path d="M9 19c-4 1.3-4-2-5.5-2.5M14.5 21v-3.5a3 3 0 00-.9-2.3c3-.3 6-1.4 6-6.5a5 5 0 00-1.4-3.5 4.6 4.6 0 00-.1-3.4s-1.1-.3-3.6 1.4a12.4 12.4 0 00-6.5 0C5.5 1.5 4.4 1.8 4.4 1.8a4.6 4.6 0 00-.1 3.4A5 5 0 003 8.7c0 5 3 6.2 6 6.5a3 3 0 00-.9 2.3V21" />);
export const Twitter = c('Twitter', <path d="M4 4l16 16M20 4L4 20" />);
export const Linkedin = c('Linkedin', <><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M8 10.5V16M8 7.8v.1M12 16v-5.5M12 13c0-1.5 1-2.5 2.3-2.5S16 11.3 16 13v3" /></>);

export type LucideIcon = React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
