import { describe, expect, it } from "vitest";
import { signInErrorMessage } from "@/lib/auth/sign-in-error";

describe("signInErrorMessage", () => {
  it("says the credentials are wrong only when Auth says so", () => {
    expect(signInErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe("Wrong email or password.");
  });

  it("asks for confirmation when the email is not confirmed", () => {
    expect(signInErrorMessage({ code: "email_not_confirmed", message: "Email not confirmed" })).toBe(
      "Confirm your email first: follow the link we sent, then sign in.",
    );
  });

  it("does not blame the password for a rate limit or an outage", () => {
    for (const error of [
      { code: "over_request_rate_limit", message: "Request rate limit reached" },
      { code: undefined, message: "fetch failed" },
    ]) {
      expect(signInErrorMessage(error)).toBe("Signing in is not possible right now. Wait a few minutes and try again.");
    }
  });
});
