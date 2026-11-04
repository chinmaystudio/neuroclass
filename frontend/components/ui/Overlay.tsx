import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { Button, IconButton, type ButtonVariant } from './Button';
import { IconAlert, IconCheckCircle, IconClose, IconInfo } from './icons';

/* -------------------------------------------------------------------------- */
/* Focus management helpers                                                   */
/* -------------------------------------------------------------------------- */

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useFocusTrap(ref: React.RefObject<HTMLElement | null>, active: boolean, initialFocus?: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = initialFocus?.current ?? node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE) ?? node;
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) { e.preventDefault(); return; }
      const [head, tail] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === head) { e.preventDefault(); tail.focus(); }
      else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [active, ref, initialFocus]);
}

let scrollLocks = 0;
function useScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    scrollLocks += 1;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { scrollLocks -= 1; if (scrollLocks === 0) document.body.style.overflow = prev; };
  }, [active]);
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Prevents closing via backdrop / Escape (e.g. while saving). */
  dismissible?: boolean;
  initialFocus?: React.RefObject<HTMLElement | null>;
  role?: 'dialog' | 'alertdialog';
};

const WIDTH = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-5xl' };

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, description, children, footer, size = 'md', dismissible = true, initialFocus, role = 'dialog' }) => {
  const panel = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();
  useFocusTrap(panel, open, initialFocus);
  useScrollLock(open);
  React.useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissible, onClose]);
  if (!open) return null;
  return createPortal(
    <div data-ui="modal" className="fixed inset-0 z-[200] flex items-end justify-center bg-overlay p-0 sm:items-center sm:p-6" onMouseDown={(e) => { if (dismissible && e.target === e.currentTarget) onClose(); }}>
      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn('flex max-h-[92vh] w-full flex-col rounded-t-dialog bg-surface text-ink shadow-dialog outline-none sm:rounded-dialog', WIDTH[size])}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-section text-ink">{title}</h2>
            {description && <p id={descId} className="mt-1 text-support text-ink-2">{description}</p>}
          </div>
          {dismissible && <IconButton label="Close dialog" icon={<IconClose size={20} />} onClick={onClose} className="-mr-2 -mt-1" />}
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3 text-body">{children}</div>}
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-2 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};

export type ConfirmOptions = {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  /** For irreversible actions: the user must type this text to enable confirm. */
  requireText?: string;
};

export const ConfirmDialog: React.FC<ConfirmOptions & { open: boolean; onResult: (ok: boolean) => void; busy?: boolean }> = ({ open, onResult, title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default', requireText, busy }) => {
  const [typed, setTyped] = React.useState('');
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => { if (open) setTyped(''); }, [open]);
  const variant: ButtonVariant = tone === 'danger' ? 'danger' : 'primary';
  return (
    <Modal
      open={open}
      onClose={() => onResult(false)}
      title={title}
      size="sm"
      role="alertdialog"
      dismissible={!busy}
      initialFocus={tone === 'danger' ? cancelRef : undefined}
      footer={
        <>
          <Button ref={cancelRef} variant="text" onClick={() => onResult(false)} disabled={busy}>{cancelLabel}</Button>
          <Button variant={variant} onClick={() => onResult(true)} loading={busy} disabled={Boolean(requireText) && typed.trim() !== requireText}>{confirmLabel}</Button>
        </>
      }
    >
      {body && <div className="text-ink-2">{body}</div>}
      {requireText && (
        <label className="mt-4 block text-support text-ink">
          Type <span className="font-mono font-semibold">{requireText}</span> to confirm
          <input value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-1.5 h-10 w-full rounded-control border border-line bg-surface px-3 text-body text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25" autoComplete="off" />
        </label>
      )}
    </Modal>
  );
};

/* -------------------------------------------------------------------------- */
/* Toasts                                                                     */
/* -------------------------------------------------------------------------- */

type ToastTone = 'info' | 'success' | 'error';
type ToastItem = { id: number; tone: ToastTone; message: React.ReactNode; action?: { label: string; onClick: () => void } };

type FeedbackApi = {
  toast: {
    (message: React.ReactNode, opts?: { tone?: ToastTone; action?: ToastItem['action']; duration?: number }): void;
    success: (message: React.ReactNode) => void;
    error: (message: React.ReactNode) => void;
    info: (message: React.ReactNode) => void;
  };
  /** Promise-based replacement for window.confirm(). */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackCtx = React.createContext<FeedbackApi | null>(null);

const TOAST_ICON: Record<ToastTone, React.ReactNode> = {
  info: <IconInfo size={18} className="text-primary" />,
  success: <IconCheckCircle size={18} className="text-success" />,
  error: <IconAlert size={18} className="text-danger" />,
};

/** Mount once near the app root. Provides useToast() and useConfirm(). */
export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const [pending, setPending] = React.useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const seq = React.useRef(0);

  const dismiss = React.useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const api = React.useMemo<FeedbackApi>(() => {
    const push = (message: React.ReactNode, opts: { tone?: ToastTone; action?: ToastItem['action']; duration?: number } = {}) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-3), { id, tone: opts.tone ?? 'info', message, action: opts.action }]);
      window.setTimeout(() => dismiss(id), opts.duration ?? (opts.tone === 'error' ? 8000 : 5000));
    };
    const toast = Object.assign(push, {
      success: (m: React.ReactNode) => push(m, { tone: 'success' }),
      error: (m: React.ReactNode) => push(m, { tone: 'error' }),
      info: (m: React.ReactNode) => push(m, { tone: 'info' }),
    });
    return { toast, confirm: (options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })) };
  }, [dismiss]);

  return (
    <FeedbackCtx.Provider value={api}>
      {children}
      {createPortal(
        <div data-ui="toasts" aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed inset-x-0 bottom-4 z-[300] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:left-6 sm:right-auto sm:items-start">
          {toasts.map((t) => (
            <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card bg-[#303134] px-4 py-3 text-support text-[#e8eaed] shadow-raised dark:bg-[#e8eaed] dark:text-[#202124]">
              <span className="mt-0.5 shrink-0 [&_svg]:!text-current">{TOAST_ICON[t.tone]}</span>
              <span className="min-w-0 flex-1">{t.message}</span>
              {t.action && <button type="button" data-ui="link" onClick={() => { t.action!.onClick(); dismiss(t.id); }} className="focus-ring shrink-0 rounded-control font-medium text-[#8ab4f8] dark:text-[#1a73e8]">{t.action.label}</button>}
              <button type="button" data-ui="icon-button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="focus-ring -mr-1 shrink-0 rounded-full p-0.5 opacity-80 hover:opacity-100"><IconClose size={16} /></button>
            </div>
          ))}
        </div>,
        document.body,
      )}
      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.title ?? ''}
        body={pending?.body}
        confirmLabel={pending?.confirmLabel}
        cancelLabel={pending?.cancelLabel}
        tone={pending?.tone}
        requireText={pending?.requireText}
        onResult={(ok) => { pending?.resolve(ok); setPending(null); }}
      />
    </FeedbackCtx.Provider>
  );
};

const noProvider = (): FeedbackApi => {
  // Safe fallback so components still work in isolation (tests, storybook-like pages).
  const log = (m: React.ReactNode) => console.info('[toast]', m);
  return { toast: Object.assign(log, { success: log, error: log, info: log }), confirm: async () => false };
};

export const useToast = () => (React.useContext(FeedbackCtx) ?? noProvider()).toast;
export const useConfirm = () => (React.useContext(FeedbackCtx) ?? noProvider()).confirm;

/* -------------------------------------------------------------------------- */
/* Tooltip                                                                    */
/* -------------------------------------------------------------------------- */

/** Short supplementary label on hover and keyboard focus. Never the only place for essential info. */
export const Tooltip: React.FC<{ content: React.ReactNode; children: React.ReactElement<any>; side?: 'top' | 'bottom' | 'right'; className?: string }> = ({ content, children, side = 'top', className }) => {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const child = React.cloneElement(children, {
    'aria-describedby': cn(children.props['aria-describedby'], open ? id : undefined) || undefined,
  });
  return (
    <span
      data-ui="tooltip"
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
    >
      {child}
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'pointer-events-none absolute z-[250] w-max max-w-[220px] rounded-control bg-[#3c4043] px-2 py-1 text-meta text-white shadow-raised dark:bg-[#e8eaed] dark:text-[#202124]',
            side === 'top' && 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
            side === 'bottom' && 'left-1/2 top-full mt-1.5 -translate-x-1/2',
            side === 'right' && 'left-full top-1/2 ml-2 -translate-y-1/2',
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
};

/* -------------------------------------------------------------------------- */
/* Dropdown menu                                                              */
/* -------------------------------------------------------------------------- */

export type MenuItem = { id: string; label: React.ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean; separatorBefore?: boolean };

/** Accessible menu button: Enter/Space/ArrowDown opens, arrows move, Esc closes and restores focus. */
export const Dropdown: React.FC<{ trigger: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { ref: React.Ref<HTMLButtonElement> }) => React.ReactNode; items: MenuItem[]; align?: 'start' | 'end'; label: string; header?: React.ReactNode }> = ({ trigger, items, align = 'end', label, header }) => {
  const [open, setOpen] = React.useState(false);
  const btn = React.useRef<HTMLButtonElement>(null);
  const menu = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();

  const focusItem = (dir: 1 | -1 | 'first' | 'last') => {
    const els = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    if (!els.length) return;
    const idx = els.indexOf(document.activeElement as HTMLElement);
    const next = dir === 'first' ? 0 : dir === 'last' ? els.length - 1 : (idx + dir + els.length) % els.length;
    els[next].focus();
  };

  React.useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => focusItem('first'));
    const onDoc = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const close = (restore = true) => { setOpen(false); if (restore) btn.current?.focus(); };

  return (
    <div data-ui="dropdown" className="relative inline-flex">
      {trigger({
        ref: btn,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
        onClick: () => setOpen((o) => !o),
        onKeyDown: (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } },
      })}
      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); focusItem(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); focusItem(-1); }
            else if (e.key === 'Home') { e.preventDefault(); focusItem('first'); }
            else if (e.key === 'End') { e.preventDefault(); focusItem('last'); }
            else if (e.key === 'Escape') { e.preventDefault(); close(); }
            else if (e.key === 'Tab') close(false);
          }}
          className={cn('absolute top-full z-[220] mt-1 min-w-[200px] overflow-hidden rounded-card border border-line bg-surface py-1 shadow-raised', align === 'end' ? 'right-0' : 'left-0')}
        >
          {header && <div className="border-b border-line-2 px-4 py-3">{header}</div>}
          {items.map((item) => (
            <React.Fragment key={item.id}>
              {item.separatorBefore && <div role="separator" className="my-1 h-px bg-line-2" />}
              <button
                type="button"
                role="menuitem"
                data-ui="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                onClick={() => { close(); item.onSelect(); }}
                className={cn('flex h-10 w-full items-center px-4 text-left text-body outline-none transition-colors focus:bg-surface-2 hover:bg-surface-2 disabled:text-ink-3', item.danger ? 'text-danger-ink' : 'text-ink')}
              >
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
