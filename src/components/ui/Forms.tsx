import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
  const variants = {
    primary:
      "bg-[var(--brand-teal)] text-white shadow-sm hover:bg-[var(--brand-teal-deep)] focus-visible:outline-[var(--brand-teal)]",
    secondary:
      "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-slate-400",
    ghost: "text-slate-600 hover:bg-slate-100 focus-visible:outline-slate-400",
    danger:
      "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:outline-rose-400",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
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

export function TextInput({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-teal)] focus:ring-2 focus:ring-[var(--brand-teal)]/20 ${className}`}
      {...props}
    />
  );
}

export function TextArea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-teal)] focus:ring-2 focus:ring-[var(--brand-teal)]/20 ${className}`}
      {...props}
    />
  );
}

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
