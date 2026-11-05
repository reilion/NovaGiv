"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, PlayCircle, X, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Phones: the sign-in and sign-up screens are a stacked page with their own
 * bar — back, the logo, close — in place of the site header and tab bar.
 */
export function AuthTopBar() {
  const router = useRouter();

  function back() {
    // Arriving from a shared link there is nothing to go back to inside the app.
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  return (
    <div className="sticky top-0 z-40 flex h-16 items-center justify-between bg-surface-lowest/90 px-2 shadow-[0_1px_8px_rgba(0,0,0,0.4)] backdrop-blur-xl md:hidden">
      <button
        type="button"
        onClick={back}
        aria-label="Volver"
        className="flex size-11 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-surface"
      >
        <ArrowLeft className="size-6" />
      </button>
      <Link href="/" className="flex items-center gap-1.5">
        <PlayCircle className="size-6 text-primary" />
        <span className="text-xl font-semibold tracking-tight text-foreground">
          Nova<span className="text-primary">Giv</span>
        </span>
      </Link>
      <Link
        href="/"
        aria-label="Cerrar y volver al catálogo"
        className="flex size-11 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-surface"
      >
        <X className="size-6" />
      </Link>
    </div>
  );
}

/** A field's label row: the name, an optional icon, and a small tag or link on the right. */
export function FieldLabel({
  htmlFor,
  icon: Icon,
  aside,
  children,
}: {
  htmlFor: string;
  icon?: LucideIcon;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {Icon && <Icon className="size-4 text-primary" />}
        {children}
      </label>
      {aside}
    </div>
  );
}

/** The mono tag that sits on the right of a label: «Solo usuario», «Mínimo 8 car.». */
export function FieldTag({ children }: { children: ReactNode }) {
  return (
    <span className="label-caps rounded bg-surface-highest px-1.5 py-0.5 text-[10px] text-neon">
      {children}
    </span>
  );
}

const INPUT_CLASS =
  "h-12 w-full rounded-xl bg-surface-lowest pr-3 text-base text-foreground placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm";

/** A text input with a leading glyph — `@`, an envelope, a lock. */
export function IconInput({
  leading,
  className,
  ...props
}: ComponentProps<"input"> & { leading: ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground">
        {leading}
      </span>
      <input {...props} className={cn(INPUT_CLASS, "pl-10", className)} />
    </div>
  );
}

/** A password input with the eye that shows what was typed. */
export function PasswordInput({
  leading,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { leading?: ReactNode }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      {leading && (
        <span className="pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center text-muted-foreground">
          {leading}
        </span>
      )}
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={cn(INPUT_CLASS, "pr-12", leading ? "pl-10" : "pl-4")}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}

/** The help line under a field. */
export function FieldHint({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      {Icon && <Icon className="mt-px size-3.5 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}

/** The gradient call to action of both forms. */
export function AuthSubmitButton({
  disabled,
  children,
}: {
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#a078ff] via-primary to-[#ae05c6] text-base font-semibold text-primary-foreground shadow-[0_0_24px_-6px_rgba(208,188,255,0.55)] transition-all hover:brightness-110 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export interface Perk {
  icon: LucideIcon;
  title: string;
  text: string;
}

/** What an account is for, as a short list of perks under the form. */
export function PerkList({
  title,
  icon: Icon,
  perks,
}: {
  title: string;
  icon: LucideIcon;
  perks: Perk[];
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-surface-lowest p-5 ring-1 ring-border">
      <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <Icon className="size-5 text-neon" />
        {title}
      </h2>
      <ul className="flex flex-col gap-4">
        {perks.map((perk) => (
          <li key={perk.title} className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-high text-primary">
              <perk.icon className="size-5" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">{perk.title}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{perk.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
