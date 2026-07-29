import { LoginForm } from "@/components/admin/login-form";

export const metadata = {
  title: "Iniciar sesión | NovaGiv Admin",
};

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <LoginForm />
    </div>
  );
}
