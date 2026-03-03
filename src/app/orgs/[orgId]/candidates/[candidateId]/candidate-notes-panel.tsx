"use client";

import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MessageSquare, Pin, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Note = {
  id: string;
  content: string;
  isImportant: boolean;
  createdAt: string;
  updatedAt: string;
  authorId: string | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function extractMentions(content: string) {
  const matches = content.match(/@[a-zA-Z0-9._-]+/g) ?? [];
  return Array.from(new Set(matches));
}

function renderMentionedText(content: string) {
  const parts = content.split(/(@[a-zA-Z0-9._-]+)/g);
  return parts.map((part, idx) => {
    if (/^@[a-zA-Z0-9._-]+$/.test(part)) {
      return (
        <span
          key={`${part}-${idx}`}
          className="rounded-md bg-blue-50 px-1 py-0.5 font-medium text-blue-700"
        >
          {part}
        </span>
      );
    }
    return <Fragment key={`${part}-${idx}`}>{part}</Fragment>;
  });
}

export function CandidateNotesPanel({
  orgId,
  candidateId,
  initialNotes,
  initialNextCursor,
  totalCount,
}: {
  orgId: string;
  candidateId: string;
  initialNotes: Note[];
  initialNextCursor: string | null;
  totalCount: number;
}) {
  const PAGE_SIZE = 10;
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [totalNotes, setTotalNotes] = useState(totalCount);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [content, setContent] = useState("");
  const [isImportant, setIsImportant] = useState(false);
  const [filterMode, setFilterMode] = useState<"all" | "important" | "mentions">("all");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const orderedNotes = useMemo(
    () => [...notes].sort((a, b) => Number(b.isImportant) - Number(a.isImportant) || Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [notes]
  );
  const mentionsPreview = useMemo(() => extractMentions(content), [content]);
  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orderedNotes.filter((note) => {
      if (filterMode === "important" && !note.isImportant) return false;
      if (filterMode === "mentions" && extractMentions(note.content).length === 0) return false;
      if (q && !note.content.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [orderedNotes, filterMode, query]);

  async function addNote() {
    const trimmed = content.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidateId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, isImportant }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add note");
      setNotes((prev) => [
        {
          ...json.note,
          createdAt: new Date(json.note.createdAt).toISOString(),
          updatedAt: new Date(json.note.updatedAt).toISOString(),
        },
        ...prev,
      ]);
      setTotalNotes((prev) => prev + 1);
      setContent("");
      setIsImportant(false);
      setFilterMode("all");
      setQuery("");
      toast.success("Note added");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to add note"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidateId}/notes/${noteId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete note");
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      setTotalNotes((prev) => Math.max(0, prev - 1));
      toast.success("Note deleted");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to delete note"));
    }
  }

  async function saveEdit(noteId: string, nextContent: string, nextImportant: boolean) {
    const trimmed = nextContent.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidateId}/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, isImportant: nextImportant }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update note");
      setNotes((prev) =>
        prev.map((n) => (n.id === noteId ? { ...n, ...json.note } : n))
      );
      setEditingId(null);
      toast.success("Note updated");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to update note"));
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/candidates/${candidateId}/notes?cursor=${encodeURIComponent(
          nextCursor
        )}&limit=${PAGE_SIZE}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load notes");
      const incoming: Note[] = (json.notes ?? []).map((note: Note) => ({
        ...note,
        createdAt: new Date(note.createdAt).toISOString(),
        updatedAt: new Date(note.updatedAt).toISOString(),
      }));
      setNotes((prev) => [...prev, ...incoming]);
      setNextCursor(json.nextCursor ?? null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to load notes"));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Card className="premium-block rounded-3xl border border-slate-300 bg-gradient-to-br from-white via-white/90 to-slate-50 p-6 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.4)]">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Collaboration</div>
          <div className="text-lg font-semibold">Notes & comments</div>
        </div>
      </div>

      <Separator className="my-4" />

      <div className="space-y-3">
        <Textarea
          placeholder="Add a recruiter note, context, or follow-up..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[96px] rounded-2xl border-slate-300"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
              isImportant
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-slate-300 bg-white text-slate-600"
            }`}
            onClick={() => setIsImportant((prev) => !prev)}
          >
            <Pin className="h-3.5 w-3.5" />
            Mark important
          </button>
          <Button onClick={addNote} disabled={saving || !content.trim()} className="rounded-xl">
            {saving ? "Saving..." : "Add note"}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Use <span className="font-medium">@username</span> to mention teammates.
        </div>
        {mentionsPreview.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {mentionsPreview.map((mention) => (
              <Badge key={mention} variant="outline" className="rounded-full text-[11px]">
                {mention}
              </Badge>
            ))}
          </div>
        ) : null}
        <div className="text-xs text-muted-foreground">
          Showing {notes.length} of {totalNotes} notes
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-[auto_auto_auto_1fr]">
        <div className="inline-flex rounded-xl border border-slate-300 bg-white p-1">
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={`rounded-lg px-3 py-1 text-xs ${
              filterMode === "all" ? "bg-slate-900 text-white" : "text-slate-600"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("important")}
            className={`rounded-lg px-3 py-1 text-xs ${
              filterMode === "important" ? "bg-slate-900 text-white" : "text-slate-600"
            }`}
          >
            Important
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("mentions")}
            className={`rounded-lg px-3 py-1 text-xs ${
              filterMode === "mentions" ? "bg-slate-900 text-white" : "text-slate-600"
            }`}
          >
            Mentions
          </button>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes..."
          className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm sm:col-span-1"
        />
      </div>

      <div className="mt-5 space-y-3">
        {filteredNotes.length === 0 ? (
          <div className="text-sm text-muted-foreground">No notes for current filter.</div>
        ) : (
          filteredNotes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              editing={editingId === note.id}
              onStartEdit={() => setEditingId(note.id)}
              onCancelEdit={() => setEditingId(null)}
              onSave={saveEdit}
              onDelete={deleteNote}
            />
          ))
        )}

        {nextCursor ? (
          <div className="pt-1">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore
                ? "Loading..."
                : `Load more notes (${Math.max(totalNotes - notes.length, 0)} left)`}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function NoteRow({
  note,
  editing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  note: Note;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (noteId: string, content: string, isImportant: boolean) => Promise<void>;
  onDelete: (noteId: string) => Promise<void>;
}) {
  const [content, setContent] = useState(note.content);
  const [important, setImportant] = useState(note.isImportant);
  const mentions = extractMentions(note.content);

  return (
    <div className="premium-subblock rounded-2xl border border-slate-300/80 bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {note.isImportant ? (
            <Badge variant="secondary" className="rounded-full border-amber-300 bg-amber-50 text-amber-700">
              Important
            </Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {new Date(note.updatedAt).toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {!editing ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setContent(note.content);
                  setImportant(note.isImportant);
                  onStartEdit();
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(note.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[84px] rounded-xl"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                important
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-slate-300 bg-white text-slate-600"
              }`}
              onClick={() => setImportant((prev) => !prev)}
            >
              <Pin className="h-3.5 w-3.5" /> Important
            </button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onCancelEdit}>Cancel</Button>
              <Button size="sm" onClick={() => onSave(note.id, content, important)}>Save</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {renderMentionedText(note.content)}
          </p>
          {mentions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1">
              {mentions.map((mention) => (
                <Badge key={mention} variant="outline" className="rounded-full text-[11px]">
                  {mention}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
