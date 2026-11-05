import { AuthTopBar } from "@/components/auth/auth-ui";
import { RegisterForm } from "@/components/auth/register-form";
import { isSupabaseConfigured, NO_SUPABASE_ERROR } from "@/lib/supabase/config";

export const metadata = {
  title: "Crear cuenta | NovaGiv",
};

export default function RegisterPage() {
  return (
    <>
    <AuthTopBar />
    <div className="relative flex flex-1 justify-center overflow-hidden px-4 pb-10 pt-4 md:items-center md:py-16">
      <div className="pointer-events-none absolute left-1/2 top-1/3 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
      <RegisterForm warning={isSupabaseConfigured ? undefined : NO_SUPABASE_ERROR} />
    </div>
    </>
  );
}
