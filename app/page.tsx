import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-6 px-6 py-24">
      <NotebookPen className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-3xl font-semibold tracking-tight">Notes</h1>
      <p className="text-muted-foreground">
        A small example app: sign in, write notes only you can read, delete them when you are done.
      </p>
      <Link href="/login" className={buttonVariants({ size: "lg" })}>
        Sign in
      </Link>
    </main>
  );
}
