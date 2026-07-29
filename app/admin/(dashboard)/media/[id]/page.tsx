import { notFound } from "next/navigation";

import { MediaForm } from "@/components/admin/media-form";
import { getMediaItemById } from "@/lib/queries";

export const metadata = {
  title: "Editar título | NovaGiv Admin",
};

export default async function EditMediaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getMediaItemById(id);

  if (!item) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Editar título</h1>
        <p className="text-sm text-muted-foreground">{item.title}</p>
      </div>
      <MediaForm item={item} />
    </div>
  );
}
