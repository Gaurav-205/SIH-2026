/**
 * Bharosa design system primitives.
 * Colours come from semantic tokens (canvas, surface, line, fg, muted, accent, ok, warn, danger).
 */
import { forwardRef, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { buttonClass, cx, type Size, type Variant } from "@/lib/cx";


/* ── Button ─────────────────────────────────────────────── */

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...rest },
  ref
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={buttonClass(variant, size, className)} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});

/* ── Form fields ────────────────────────────────────────── */

const inputBase =
  "block w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg placeholder:text-muted/70 shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:opacity-60";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
}

export function Field({ label, hint, error, className, type, ...rest }: FieldProps) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && reveal ? "text" : type}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${id}-note` : undefined}
          className={cx(inputBase, "h-10", isPassword && "pr-10", error && "border-danger focus:border-danger focus:ring-danger/15")}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted hover:text-fg"
            aria-label={reveal ? "Hide password" : "Show password"}
          >
            {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {(error || hint) && (
        <p id={`${id}-note`} className={cx("mt-1.5 text-xs", error ? "text-danger" : "text-muted")}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string | number; label: string }[];
}

export function Select({ label, options, className, ...rest }: SelectProps) {
  const id = useId();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
          {label}
        </label>
      )}
      <select id={id} className={cx(inputBase, "h-10 pr-8")} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ── Segmented control ──────────────────────────────────── */

interface SegmentedProps<T extends string | number> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  size?: "sm" | "md";
  label: string;
}

export function Segmented<T extends string | number>({ value, onChange, options, size = "md", label }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-line bg-subtle p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-md font-medium transition-colors",
            size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
            value === o.value ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Card, badge, misc ──────────────────────────────────── */

export function Card({
  title,
  description,
  action,
  badge,
  children,
  footer,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("card transition-shadow duration-150 hover:shadow-card", className)}>
      {(title || action || badge) && (
        <header className="flex items-start justify-between gap-4 border-b border-line/80 px-5 py-3.5">
          <div className="min-w-0">
            {title && (
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-fg">{title}</h2>
                {badge}
              </div>
            )}
            {description && <p className="mt-0.5 text-xs text-muted leading-relaxed">{description}</p>}
          </div>
          {action && <div className="flex-shrink-0 pt-0.5">{action}</div>}
        </header>
      )}
      <div className={cx("p-5", bodyClassName)}>{children}</div>
      {footer && <footer className="border-t border-line/80 bg-subtle/40 px-5 py-3 text-xs text-muted rounded-b-xl">{footer}</footer>}
    </section>
  );
}

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";
const TONES: Record<Tone, string> = {
  neutral: "bg-subtle text-muted border-line",
  accent: "bg-fg text-surface border-fg font-semibold",
  ok: "bg-subtle text-fg border-line font-medium",
  warn: "bg-subtle text-fg border-fg/30 font-medium",
  danger: "bg-fg text-surface border-fg font-semibold",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-tight", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="grid min-h-[200px] place-items-center text-sm text-muted">
      <span className="inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-fg" aria-hidden="true" />
        {label}…
      </span>
    </div>
  );
}

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="h-7 w-7 flex-shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-fg" />
        <path d="M7 19c3-6 6-6 9 0s6 6 9 0" fill="none" stroke="rgb(var(--surface))" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M7 13c3-4 6-4 9 0s6 4 9 0" fill="none" stroke="rgb(var(--surface))" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {showText && <span className="text-[15px] font-bold tracking-tight text-fg">Bharosa</span>}
    </span>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 border-b border-line/60 pb-5 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
  icon,
  badge,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
  badge?: ReactNode;
}) {
  const ring: Record<Tone, string> = {
    neutral: "bg-subtle text-muted border-line",
    accent: "bg-fg text-surface border-fg",
    ok: "bg-subtle text-fg border-line",
    warn: "bg-subtle text-fg border-line",
    danger: "bg-fg text-surface border-fg",
  };
  const borderTone: Record<Tone, string> = {
    neutral: "border-line",
    accent: "border-fg/30 hover:border-fg/60",
    ok: "border-line hover:border-fg/40",
    warn: "border-line hover:border-fg/40",
    danger: "border-fg/40 hover:border-fg",
  };
  return (
    <div className={cx("card relative overflow-hidden p-4 sm:p-5 transition-all duration-150 hover:shadow-pop", borderTone[tone])}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
        <div className="flex items-center gap-1.5">
          {badge}
          {icon && <span className={cx("grid h-8 w-8 place-items-center rounded-lg border", ring[tone])}>{icon}</span>}
        </div>
      </div>
      <p className="num mt-2.5 text-2xl font-bold tracking-tight text-fg sm:text-3xl">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-muted line-clamp-2 leading-relaxed">{sub}</p>}
    </div>
  );
}
