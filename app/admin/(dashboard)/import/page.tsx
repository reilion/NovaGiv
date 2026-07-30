import { OkRuImportPanel } from "@/components/admin/okru-import-panel";
import { hasOkRuSession } from "@/lib/okru-scraper";

export const metadata = {
  title: "Importar de ok.ru | NovaGiv Admin",
};

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Importar desde ok.ru</h1>
        <p className="text-sm text-muted-foreground">
          Trae los canales y videos ya organizados en ok.ru para armar una colección. Se
          guardan como borrador — no aparecen en la página hasta que los publiques.
        </p>
      </div>
      <OkRuImportPanel hasSession={hasOkRuSession} />
    </div>
  );
}
