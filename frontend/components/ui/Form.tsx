import React from 'react';
import { cn } from '../../lib/utils';
import { IconAlert, IconCheck, IconChevronDown, IconClose, IconEye, IconEyeOff, IconFile, IconSearch, IconUpload } from './icons';

/* -------------------------------------------------------------------------- */
/* Field: label, hint, error and ids wired for every control                  */
/* -------------------------------------------------------------------------- */

type FieldContext = { id: string; describedBy?: string; invalid: boolean; required?: boolean };
const FieldCtx = React.createContext<FieldContext | null>(null);

/** Gives a child control its id / aria-describedby / aria-invalid from the nearest Field. */
export function useFieldProps<T extends { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: React.AriaAttributes['aria-invalid']; required?: boolean }>(props: T): T {
  const ctx = React.useContext(FieldCtx);
  if (!ctx) return props;
  return {
    ...props,
    id: props.id ?? ctx.id,
    'aria-describedby': cn(ctx.describedBy, props['aria-describedby']) || undefined,
    'aria-invalid': props['aria-invalid'] ?? (ctx.invalid || undefined),
    required: props.required ?? ctx.required,
  };
}

export type FieldProps = {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
  /** Visually hide the label (still announced). Use only when context makes it obvious. */
  hideLabel?: boolean;
  id?: string;
};

export const Field: React.FC<FieldProps> = ({ label, hint, error, required, optional, children, className, hideLabel, id }) => {
  const auto = React.useId();
  const controlId = id ?? `f${auto}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  return (
    <div data-ui="field" className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={controlId} className={cn('text-support font-medium text-ink', hideLabel && 'sr-only')}>
        {label}
        {required && <span className="ml-0.5 text-danger-ink" aria-hidden> *</span>}
        {optional && <span className="ml-1 font-normal text-ink-2">(optional)</span>}
      </label>
      <FieldCtx.Provider value={{ id: controlId, describedBy: cn(errorId, hintId) || undefined, invalid: Boolean(error), required }}>
        {children}
      </FieldCtx.Provider>
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-support text-danger-ink"><IconAlert size={16} className="mt-0.5 shrink-0" />{error}</p>
      ) : hint ? (
        <p id={hintId} className="text-meta text-ink-2">{hint}</p>
      ) : null}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Text inputs                                                                */
/* -------------------------------------------------------------------------- */

export const controlClasses = (extra?: string) =>
  cn(
    'w-full rounded-control border border-line bg-surface px-3 text-body text-ink placeholder:text-ink-3',
    'transition-[border-color,box-shadow] duration-[var(--duration-fast)]',
    'hover:border-ink-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25',
    'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/25',
    'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3 disabled:hover:border-line',
    '[&[readonly]]:bg-surface-2',
    extra,
  );

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { leading?: React.ReactNode; trailing?: React.ReactNode };

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, leading, trailing, ...props }, ref) {
  const p = useFieldProps(props);
  if (!leading && !trailing) return <input ref={ref} data-ui="input" {...p} className={controlClasses(cn('h-10', className))} />;
  return (
    <div className="relative">
      {leading && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-3">{leading}</span>}
      <input ref={ref} data-ui="input" {...p} className={controlClasses(cn('h-10', leading && 'pl-10', trailing && 'pr-10', className))} />
      {trailing && <span className="absolute inset-y-0 right-1 flex items-center">{trailing}</span>}
    </div>
  );
});

export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'trailing'>>(function PasswordInput(props, ref) {
  const [visible, setVisible] = React.useState(false);
  return (
    <Input
      ref={ref}
      autoComplete="current-password"
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button type="button" data-ui="icon-button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2">
          {visible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
        </button>
      }
    />
  );
});

export type SearchInputProps = Omit<InputProps, 'type' | 'leading' | 'trailing'> & { onClear?: () => void };

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput({ onClear, value, 'aria-label': ariaLabel, ...props }, ref) {
  return (
    <Input
      ref={ref}
      type="search"
      role="searchbox"
      aria-label={ariaLabel ?? (props.placeholder ? undefined : 'Search')}
      value={value}
      {...props}
      leading={<IconSearch size={18} />}
      trailing={onClear && value ? (
        <button type="button" data-ui="icon-button" onClick={onClear} aria-label="Clear search" className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"><IconClose size={16} /></button>
      ) : undefined}
      className={cn('[&::-webkit-search-cancel-button]:hidden', props.className)}
    />
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...props }, ref) {
  const p = useFieldProps(props);
  return <textarea ref={ref} data-ui="textarea" rows={rows} {...p} className={controlClasses(cn('min-h-[5rem] py-2 leading-6', className))} />;
});

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string };

/** Native select (best keyboard and mobile behaviour) with kit styling. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, children, placeholder, ...props }, ref) {
  const p = useFieldProps(props);
  return (
    <div className="relative">
      <select ref={ref} data-ui="select" {...p} className={controlClasses(cn('h-10 cursor-pointer appearance-none pr-9', className))}>
        {placeholder !== undefined && <option value="" disabled>{placeholder}</option>}
        {children}
      </select>
      <IconChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-2" />
    </div>
  );
});

/** Date / date-time picker using the native control (accessible, localised, mobile-friendly). */
export const DateInput = React.forwardRef<HTMLInputElement, Omit<InputProps, 'type'> & { withTime?: boolean }>(function DateInput({ withTime, className, ...props }, ref) {
  return <Input ref={ref} type={withTime ? 'datetime-local' : 'date'} {...props} className={cn('[color-scheme:light] dark:[color-scheme:dark]', className)} />;
});

/* -------------------------------------------------------------------------- */
/* Choice controls                                                            */
/* -------------------------------------------------------------------------- */

type ChoiceProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: React.ReactNode; description?: React.ReactNode };

export const Checkbox = React.forwardRef<HTMLInputElement, ChoiceProps & { indeterminate?: boolean }>(function Checkbox({ label, description, className, indeterminate, ...props }, ref) {
  const inner = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(ref, () => inner.current!);
  React.useEffect(() => { if (inner.current) inner.current.indeterminate = Boolean(indeterminate); }, [indeterminate]);
  const descId = React.useId();
  return (
    <label data-ui="checkbox" className={cn('group inline-flex cursor-pointer items-start gap-3', props.disabled && 'cursor-not-allowed opacity-60', className)}>
      <span className="relative mt-0.5 inline-flex h-[18px] w-[18px] shrink-0">
        <input ref={inner} type="checkbox" aria-describedby={description ? descId : undefined} {...props} className="peer focus-ring absolute inset-0 m-0 h-full w-full cursor-[inherit] appearance-none rounded-[3px] border-2 border-ink-2 bg-surface transition-colors checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary" />
        <IconCheck size={14} strokeWidth={2.5} className="pointer-events-none absolute left-[2px] top-[2px] text-on-primary opacity-0 peer-checked:opacity-100" />
        <span aria-hidden className="pointer-events-none absolute left-[4px] top-[8px] h-0.5 w-2.5 rounded bg-on-primary opacity-0 peer-indeterminate:opacity-100" />
      </span>
      <span className="min-w-0">
        <span className="block text-body text-ink">{label}</span>
        {description && <span id={descId} className="block text-support text-ink-2">{description}</span>}
      </span>
    </label>
  );
});

export const Radio = React.forwardRef<HTMLInputElement, ChoiceProps>(function Radio({ label, description, className, ...props }, ref) {
  const descId = React.useId();
  return (
    <label data-ui="radio" className={cn('inline-flex cursor-pointer items-start gap-3', props.disabled && 'cursor-not-allowed opacity-60', className)}>
      <input ref={ref} type="radio" aria-describedby={description ? descId : undefined} {...props} className="focus-ring mt-0.5 h-[18px] w-[18px] shrink-0 cursor-[inherit] appearance-none rounded-full border-2 border-ink-2 bg-surface transition-[border-color,border-width] checked:border-[5px] checked:border-primary" />
      <span className="min-w-0">
        <span className="block text-body text-ink">{label}</span>
        {description && <span id={descId} className="block text-support text-ink-2">{description}</span>}
      </span>
    </label>
  );
});

export const RadioGroup: React.FC<{ legend: React.ReactNode; name: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: React.ReactNode; description?: React.ReactNode; disabled?: boolean }>; className?: string; inline?: boolean }> = ({ legend, name, value, onChange, options, className, inline }) => (
  <fieldset data-ui="radio-group" className={className}>
    <legend className="mb-2 text-support font-medium text-ink">{legend}</legend>
    <div className={cn('flex gap-3', inline ? 'flex-wrap gap-x-6' : 'flex-col')}>
      {options.map((o) => (
        <Radio key={o.value} name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} label={o.label} description={o.description} disabled={o.disabled} />
      ))}
    </div>
  </fieldset>
);

export type ToggleProps = { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; description?: React.ReactNode; disabled?: boolean; className?: string; hideLabel?: boolean };

/** On/off switch (role="switch"). Use for settings that apply immediately. */
export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, description, disabled, className, hideLabel }) => {
  const id = React.useId();
  const descId = description ? `${id}-d` : undefined;
  return (
    <div data-ui="toggle" className={cn('flex items-start justify-between gap-4', disabled && 'opacity-60', className)}>
      <div className={cn('min-w-0', hideLabel && 'sr-only')}>
        <label htmlFor={id} className="block cursor-pointer text-body text-ink">{label}</label>
        {description && <p id={descId} className="text-support text-ink-2">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        data-ui="switch"
        aria-checked={checked}
        aria-describedby={descId}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'focus-ring relative mt-0.5 inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-[var(--duration-base)] disabled:cursor-not-allowed',
          checked ? 'border-primary bg-primary' : 'border-ink-3 bg-surface-2',
        )}
      >
        <span className={cn('inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-[var(--duration-base)]', checked ? 'translate-x-[19px] bg-on-primary' : 'translate-x-[3px] bg-ink-2')} />
      </button>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* File upload                                                                */
/* -------------------------------------------------------------------------- */

const formatBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export type FileUploadProps = {
  /** Accepted extensions without dots, e.g. ['pdf', 'docx']. */
  accept?: string[];
  maxSizeMb?: number;
  maxFiles?: number;
  multiple?: boolean;
  disabled?: boolean;
  files?: Array<{ id: string; name: string; size?: number }>;
  onFiles: (files: File[]) => void;
  onRemove?: (id: string) => void;
  hint?: React.ReactNode;
  className?: string;
};

/** Drop zone + file list. Validates type and size before handing files over. */
export const FileUpload: React.FC<FileUploadProps> = ({ accept, maxSizeMb, maxFiles, multiple = true, disabled, files = [], onFiles, onRemove, hint, className }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const field = React.useContext(FieldCtx);

  const accepts = (f: File) => !accept?.length || accept.includes(f.name.split('.').pop()?.toLowerCase() ?? '');
  const take = (list: FileList | null) => {
    if (!list || disabled) return;
    const incoming = Array.from(list);
    const bad = incoming.find((f) => !accepts(f));
    if (bad) return setError(`${bad.name} isn’t an accepted file type.`);
    const big = maxSizeMb ? incoming.find((f) => f.size > maxSizeMb * 1024 * 1024) : undefined;
    if (big) return setError(`${big.name} is larger than ${maxSizeMb} MB.`);
    if (maxFiles && files.length + incoming.length > maxFiles) return setError(`You can attach up to ${maxFiles} file${maxFiles === 1 ? '' : 's'}.`);
    setError(null);
    onFiles(incoming);
  };

  return (
    <div data-ui="file-upload" className={cn('flex flex-col gap-2', className)}>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); take(e.dataTransfer.files); }}
        className={cn(
          'flex flex-col items-center gap-2 rounded-card border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragging ? 'border-primary bg-primary-light' : 'border-line bg-surface',
          disabled && 'opacity-60',
        )}
      >
        <IconUpload size={22} className="text-primary" />
        <p className="text-body text-ink">
          Drag files here or{' '}
          <button type="button" data-ui="link" disabled={disabled} onClick={() => inputRef.current?.click()} className="focus-ring rounded-control font-medium text-primary underline-offset-2 hover:underline">browse</button>
        </p>
        <p className="text-meta text-ink-2">
          {hint ?? [accept?.length ? accept.map((a) => a.toUpperCase()).join(', ') : null, maxSizeMb ? `up to ${maxSizeMb} MB` : null, maxFiles ? `max ${maxFiles} files` : null].filter(Boolean).join(' · ')}
        </p>
        <input
          ref={inputRef}
          id={field?.id}
          aria-describedby={field?.describedBy}
          type="file"
          className="sr-only"
          tabIndex={-1}
          multiple={multiple}
          disabled={disabled}
          accept={accept?.map((a) => `.${a}`).join(',')}
          onChange={(e) => { take(e.target.files); e.target.value = ''; }}
        />
      </div>
      {error && <p role="alert" className="flex items-start gap-1.5 text-support text-danger-ink"><IconAlert size={16} className="mt-0.5 shrink-0" />{error}</p>}
      {files.length > 0 && (
        <ul className="divide-y divide-line-2 rounded-card border border-line bg-surface">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2">
              <IconFile size={18} className="shrink-0 text-ink-2" />
              <span className="min-w-0 flex-1 truncate text-support text-ink">{f.name}</span>
              {typeof f.size === 'number' && <span className="text-meta text-ink-2">{formatBytes(f.size)}</span>}
              {onRemove && <button type="button" data-ui="icon-button" onClick={() => onRemove(f.id)} aria-label={`Remove ${f.name}`} className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2"><IconClose size={16} /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
