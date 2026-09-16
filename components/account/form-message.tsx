import { CheckCircle2 } from "lucide-react";

import type { AccountState } from "@/lib/actions/account";

/** The one line of feedback each account form leaves behind after a submit. */
export function FormMessage({ state }: { state: AccountState | undefined }) {
  if (state?.error) return <p className="text-sm text-destructive">{state.error}</p>;

  if (state?.notice) {
    return (
      <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>{state.notice}</span>
      </p>
    );
  }

  return null;
}
