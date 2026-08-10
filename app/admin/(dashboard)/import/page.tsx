import { OkRuImportPanel } from "@/components/admin/okru-import-panel";
import { hasOkRuSession } from "@/lib/okru-scraper";

export const metadata = {
  title: "Importar de ok.ru | NovaGiv Admin",
};

/**
 * The sync fetches ok.ru once per channel, so the server action behind this
 * page needs more than the default serverless budget.
 */
export const maxDuration = 60;

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Importar desde ok.ru</h1>
        <p className="text-sm text-muted-foreground">
          Actualiza el catálogo con los canales más recientes de ok.ru: crea los que falten y
          añade a los existentes solo los videos nuevos. Lo nuevo queda como borrador — no
          aparece en la página hasta que lo publiques.
        </p>
      </div>
      <OkRuImportPanel hasSession={hasOkRuSession} />
    </div>
  );
}
