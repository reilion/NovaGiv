import { RegisterForm } from "@/components/auth/register-form";
import { isSupabaseConfigured, NO_SUPABASE_ERROR } from "@/lib/supabase/config";

export const metadata = {
  title: "Crear cuenta | NovaGiv",
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <RegisterForm warning={isSupabaseConfigured ? undefined : NO_SUPABASE_ERROR} />
    </div>
  );
}
