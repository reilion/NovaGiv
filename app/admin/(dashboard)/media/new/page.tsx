import { MediaForm } from "@/components/admin/media-form";

export const metadata = {
  title: "Nuevo título | NovaGiv Admin",
};

export default function NewMediaPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Nuevo título</h1>
        <p className="text-sm text-muted-foreground">
          Completa los datos y guarda para publicarlo en el catálogo.
        </p>
      </div>
      <MediaForm />
    </div>
  );
}
