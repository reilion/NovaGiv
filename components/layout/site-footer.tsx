import { Clapperboard, Cloud } from "lucide-react";

import { SOCIAL_META } from "@/components/layout/social-links";
import { getStreamerProfile } from "@/lib/queries";

export async function SiteFooter() {
  const profile = await getStreamerProfile();

  return (
    <footer className="mt-16 border-t border-border bg-surface-lowest">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex max-w-md flex-col gap-2">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <Clapperboard className="size-4 text-primary" />
              NovaGiv Archive
            </p>
            <p className="text-sm text-muted-foreground">
              Archivo de directos, maratones y noches de cine comunitario de {profile.name}.
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2" aria-label="Redes">
            {profile.socials.map((social) => {
              const meta = SOCIAL_META[social.platform];
              const Icon = meta.icon;
              return (
                <a
                  key={social.platform}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
                >
                  <Icon className="size-4" />
                  {meta.label}
                </a>
              );
            })}
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Cloud className="size-4" />
              ok.ru
            </span>
          </nav>
        </div>

        <div className="flex flex-col justify-between gap-2 border-t border-border pt-6 sm:flex-row">
          <p className="label-code text-outline">
            Videos reproducidos con el reproductor embebido de ok.ru. Índice comunitario sin fines de
            lucro.
          </p>
          <p className="text-xs text-outline">© {new Date().getFullYear()} NovaGiv.</p>
        </div>
      </div>
    </footer>
  );
}
