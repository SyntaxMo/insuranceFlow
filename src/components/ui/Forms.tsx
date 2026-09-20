import { forwardRef, type ComponentPropsWithRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function buttonClassName(
  variant: ButtonVariant = "primary",
  className = "",
): string {
  const base =
    "inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60";
  const variants: Record<ButtonVariant, string> = {
    primary:
      "border border-transparent bg-[var(--brand-teal)] text-white shadow-sm hover:bg-[var(--brand-teal-deep)] hover:text-white focus-visible:text-white focus-visible:outline-[var(--brand-teal)] active:text-white disabled:text-white",
    secondary:
      "border border-slate-300 bg-white text-[var(--brand-navy)] shadow-sm hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-slate-400",
    ghost:
      "border border-transparent text-slate-600 hover:bg-slate-100 hover:text-[var(--brand-navy)] focus-visible:outline-slate-400",
    danger:
      "border border-rose-300 bg-white text-rose-700 hover:border-rose-400 hover:bg-rose-50 focus-visible:outline-rose-400",
  };
  return `${base} ${variants[variant]} ${className}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
}) {
  return (
    <button
      className={buttonClassName(variant, className)}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-800"
      >
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const TextInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function TextInput({ className = "", ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-teal)] focus:ring-2 focus:ring-[var(--brand-teal)]/20 ${className}`}
      {...props}
    />
  );
});

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className = "", ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={`w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-teal)] focus:ring-2 focus:ring-[var(--brand-teal)]/20 ${className}`}
      {...props}
    />
  );
});

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info";
  children: ReactNode;
}) {
  const tones = {
    error: "border-rose-200 bg-rose-50 text-rose-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  };

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}
      role="status"
    >
      {children}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)] sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}
