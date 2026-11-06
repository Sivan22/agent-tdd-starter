"use client";

import { useActionState } from "react";
import { authenticate, type AuthState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthState = { error: null, notice: null, email: "" };

export function LoginForm() {
  const [state, action, pending] = useActionState(authenticate, initialState);
  return (
    <form action={action} className="grid gap-4" aria-label="Sign in">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {state.notice}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" name="intent" value="sign-in" disabled={pending}>
          Sign in
        </Button>
        <Button type="submit" name="intent" value="sign-up" variant="outline" disabled={pending}>
          Create account
        </Button>
      </div>
    </form>
  );
}
