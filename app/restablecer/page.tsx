import { redirect } from "next/navigation";

import { AuthTopBar } from "@/components/auth/auth-ui";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getAccount } from "@/lib/auth";

export const metadata = {
  title: "Nueva contraseña | NovaGiv",
  robots: { index: false },
};

/**
 * Where the reset email lands, after app/auth/confirm has turned its link into
 * a session. Without that session there is nothing to reset: send the visitor
 * to ask for a link.
 */
export default async function ResetPasswordPage() {
  const account = await getAccount();
  if (!account) redirect("/recuperar");

  return (
    <>
      <AuthTopBar />
      <div className="relative flex flex-1 justify-center overflow-hidden px-4 pb-10 pt-4 md:items-center md:py-16">
        <div className="pointer-events-none absolute left-1/2 top-1/3 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        <ResetPasswordForm username={account.username} />
      </div>
    </>
  );
}
