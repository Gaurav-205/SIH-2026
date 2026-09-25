/** Class-name helpers shared by the design system. */

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export type Variant = "primary" | "secondary" | "ghost" | "danger";
export type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent/90 shadow-sm",
  secondary: "bg-surface text-fg border border-line hover:bg-subtle shadow-sm",
  ghost: "text-muted hover:text-fg hover:bg-subtle",
  danger: "bg-danger text-white hover:bg-danger/90 shadow-sm",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export const buttonClass = (variant: Variant = "primary", size: Size = "md", extra?: string) =>
  cx(
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
    VARIANTS[variant],
    SIZES[size],
    extra
  );

