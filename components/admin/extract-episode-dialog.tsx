"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isEpisodic, MEDIA_TYPE_LABELS, type MediaType } from "@/types/media";

const MEDIA_TYPES = Object.keys(MEDIA_TYPE_LABELS) as MediaType[];

interface ExtractEpisodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Title of the episode moving out — the default name for the new collection. */
  episodeTitle: string;
  channelName?: string;
  isPending: boolean;
  error: string | null;
  onConfirm: (values: { title: string; type: MediaType }) => void;
}

/**
 * Asks for the two things that can't be guessed when pulling an episode out of
 * a mixed channel into a collection of its own: what to call it and whether it
 * is a movie (one video) or something that will hold several.
 */
export function ExtractEpisodeDialog({
  open,
  onOpenChange,
  episodeTitle,
  channelName,
  isPending,
  error,
  onConfirm,
}: ExtractEpisodeDialogProps) {
  const [title, setTitle] = useState(episodeTitle);
  const [type, setType] = useState<MediaType>("movie");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Extraer a una colección nueva</DialogTitle>
          <DialogDescription>
            El episodio se mueve a una colección propia
            {channelName ? (
              <>
                , que sigue vinculada al canal <strong>{channelName}</strong>
              </>
            ) : null}
            . También se guardan los cambios pendientes de esta colección.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="extract-title" className="text-sm font-medium text-foreground">
              Título de la nueva colección
            </label>
            <Input
              id="extract-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="extract-type" className="text-sm font-medium text-foreground">
              Tipo
            </label>
            <Select value={type} onValueChange={(value) => setType(value as MediaType)}>
              <SelectTrigger id="extract-type" className="w-full">
                <SelectValue>{MEDIA_TYPE_LABELS[type]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MEDIA_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {MEDIA_TYPE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isEpisodic(type)
                ? "Guarda el video como episodio 1; luego podrás añadirle más videos de otras colecciones del canal."
                : "Guarda el video como reproducción única. Elige Series o Anime si la colección va a tener varios videos."}
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={isPending || !title.trim()}
            onClick={() => onConfirm({ title, type })}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Crear colección
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
