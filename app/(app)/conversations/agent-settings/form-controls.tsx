'use client';

import { Loader2, Check, AlertCircle } from 'lucide-react';

export function TextField({
  label,
  hint,
  required,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}
        {required && <span className="text-photocan-amber ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-muted-foreground mb-1.5">{hint}</p>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 px-3 rounded-md bg-secondary border border-border text-sm outline-none focus:border-photocan-amber/50"
      />
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  required,
  highlight,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  highlight?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}
        {required && <span className="text-photocan-amber ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-muted-foreground mb-1.5">{hint}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full px-3 py-2 rounded-md bg-secondary border text-sm outline-none resize-y focus:border-photocan-amber/50 ${
          highlight ? 'border-photocan-amber/40' : 'border-border'
        }`}
      />
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  size = 'sm',
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: 'sm' | 'lg';
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className={`font-medium ${size === 'lg' ? 'text-base' : 'text-sm'}`}>
          {label}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`flex-shrink-0 rounded-full transition-colors ${
          size === 'lg' ? 'w-12 h-7' : 'w-10 h-6'
        } ${checked ? 'bg-photocan-amber' : 'bg-secondary border border-border'}`}
      >
        <span
          className={`block rounded-full bg-white transition-transform ${
            size === 'lg' ? 'w-5 h-5 m-1' : 'w-4 h-4 m-1'
          } ${
            checked
              ? size === 'lg'
                ? 'translate-x-5'
                : 'translate-x-4'
              : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export function SaveBar({
  onSave,
  saving,
  saved,
  error,
  disabled,
  label = 'Guardar capa',
}: {
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  error: string | null;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        onClick={onSave}
        disabled={saving || disabled}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-photocan-amber text-black text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        {label}
      </button>
      {saved && (
        <span className="inline-flex items-center gap-1 text-sm text-green-500">
          <Check className="w-4 h-4" />
          Guardado
        </span>
      )}
      {error && (
        <span className="inline-flex items-center gap-1 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          {error}
        </span>
      )}
    </div>
  );
}
