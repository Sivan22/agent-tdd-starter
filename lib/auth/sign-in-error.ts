/** What a failed sign-in tells the user. Only Auth's own verdict blames the credentials. */
export function signInErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === "invalid_credentials") return "Wrong email or password.";
  if (error.code === "email_not_confirmed") return "Confirm your email first: follow the link we sent, then sign in.";
  return "Signing in is not possible right now. Wait a few minutes and try again.";
}
