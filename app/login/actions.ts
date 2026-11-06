"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signInErrorMessage } from "@/lib/auth/sign-in-error";
import { supabaseServer } from "@/lib/supabase/server";

export type AuthState = { error: string | null; notice: string | null; email: string };

const signInInput = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
const signUpInput = signInInput.extend({
  password: z.string().min(12, "Use at least 12 characters for the password."),
});

export async function authenticate(_previous: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim();
  const signingUp = form.get("intent") === "sign-up";
  const parsed = (signingUp ? signUpInput : signInInput).safeParse({ email, password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, notice: null, email };

  const supabase = await supabaseServer();
  if (signingUp) {
    const { data, error } = await supabase.auth.signUp(parsed.data);
    if (error) return { error: error.message, notice: null, email };
    // With email confirmation on, Auth returns no session until the link is followed.
    if (!data.session) return { error: null, notice: "Check your email to confirm the account, then sign in.", email };
  } else {
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { error: signInErrorMessage(error), notice: null, email };
  }
  redirect("/notes");
}

export async function signOut(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
