import { Trash2 } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { deleteNote } from "@/app/notes/actions";
import { NoteForm } from "@/components/notes/note-form";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";

export default async function NotesPage() {
  const { supabase, user } = await requireUser();
  const { data: notes, error } = await supabase
    .from("notes")
    .select("id, title, body, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (
    <main className="mx-auto grid max-w-2xl gap-8 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your notes</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost">
            Sign out
          </Button>
        </form>
      </header>

      <NoteForm />

      {notes.length === 0 ? (
        <p className="text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="grid gap-4" aria-label="Notes">
          {notes.map((note) => (
            <li key={note.id}>
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2>{note.title}</h2>
                  </CardTitle>
                  <CardAction>
                    <form action={deleteNote}>
                      <input type="hidden" name="id" value={note.id} />
                      <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Delete note: ${note.title}`}>
                        <Trash2 aria-hidden />
                      </Button>
                    </form>
                  </CardAction>
                </CardHeader>
                {note.body ? <CardContent className="whitespace-pre-wrap">{note.body}</CardContent> : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
