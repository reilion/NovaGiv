import { AuthTopBar } from "@/components/auth/auth-ui";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured, NO_SUPABASE_ERROR } from "@/lib/supabase/config";
import { safeRedirectPath } from "@/lib/url";

export const metadata = {
  title: "Iniciar sesión | NovaGiv",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, error } = await searchParams;

  // Said before anybody types a password into a form that cannot check it —
  // the same thing /admin does when it has only the demo catalog to show.
  // Otherwise: set by app/auth/confirm when a link from an email no longer works.
  const warning = !isSupabaseConfigured
    ? NO_SUPABASE_ERROR
    : error === "link"
      ? "Ese enlace ya no es válido: puede que haya caducado o que ya lo hayas usado. Inicia sesión con tu usuario."
      : undefined;

  return (
    <>
    <AuthTopBar />
    <div className="relative flex flex-1 justify-center overflow-hidden px-4 pb-10 pt-4 md:items-center md:py-16">
      <div className="pointer-events-none absolute left-1/2 top-1/3 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
      <LoginForm next={safeRedirectPath(next) ?? undefined} warning={warning} />
    </div>
    </>
  );
}
