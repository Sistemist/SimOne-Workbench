import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearchParams } from "@/lib/router";
import { Sparkles } from "lucide-react";
import { authApi, AuthApiError } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { AsciiArtAnimation } from "@/components/AsciiArtAnimation";
import { ThemeToggle } from "@/components/ThemeToggle";

const GENERIC_REQUEST_MESSAGE =
  "If an account exists for that email, a reset link will be sent. During Alpha, contact the administrator if it does not arrive.";

function RecoveryShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex bg-background">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <div className="flex w-full flex-col overflow-y-auto md:w-1/2">
        <div className="mx-auto my-auto w-full max-w-md px-8 py-12">
          <div className="mb-8 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Sysdom AI</span>
          </div>
          {children}
        </div>
      </div>
      <div className="hidden w-1/2 overflow-hidden md:block">
        <AsciiArtAnimation />
      </div>
    </div>
  );
}

export function PasswordRecoveryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const isReset = location.pathname.endsWith("/reset-password");
  const token = searchParams.get("token")?.trim() ?? "";
  const callbackError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    isReset && (callbackError || !token)
      ? "This reset link is invalid or has expired. Request a new one."
      : null,
  );
  const errorId = "password-recovery-error";

  const requestMutation = useMutation({
    mutationFn: () => authApi.requestPasswordReset({
      email: email.trim(),
      redirectTo: `${window.location.origin}/auth/reset-password`,
    }),
    onSuccess: () => {
      setError(null);
      setMessage(GENERIC_REQUEST_MESSAGE);
    },
    onError: (requestError) => {
      if (requestError instanceof AuthApiError && requestError.status === 429) {
        setError("Too many recovery requests. Wait a minute, then try again.");
        return;
      }
      // Keep the same account-neutral wording for delivery and lookup failures.
      setError(null);
      setMessage(GENERIC_REQUEST_MESSAGE);
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => authApi.resetPassword({ token, newPassword }),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.auth.session, null);
      navigate("/auth?passwordReset=success", { replace: true });
    },
    onError: () => {
      setError("This reset link is invalid or has expired. Request a new one.");
    },
  });

  if (!isReset) {
    return (
      <RecoveryShell>
        <h1 className="text-xl font-semibold">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the email used for your Sysdom AI account.
        </p>
        {message ? (
          <div className="mt-6 space-y-4">
            <p role="status" className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              {message}
            </p>
            <a href="/auth" className="text-sm font-medium text-foreground underline underline-offset-2">
              Back to sign in
            </a>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!email.trim() || requestMutation.isPending) return;
              requestMutation.mutate();
            }}
          >
            <div>
              <label htmlFor="recovery-email" className="mb-1 block text-xs text-muted-foreground">Email</label>
              <input
                id="recovery-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                aria-required="true"
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoFocus
              />
            </div>
            {error && <p id={errorId} role="alert" className="text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={requestMutation.isPending || !email.trim()} className="w-full">
              {requestMutation.isPending ? "Sending…" : "Send reset link"}
            </Button>
            <a href="/auth" className="block text-center text-sm font-medium text-foreground underline underline-offset-2">
              Back to sign in
            </a>
          </form>
        )}
      </RecoveryShell>
    );
  }

  const passwordsMatch = newPassword === confirmPassword;
  const canReset = token.length > 0 && !callbackError && newPassword.length >= 8 && passwordsMatch;

  return (
    <RecoveryShell>
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Use at least 8 characters. This one-time link expires after 15 minutes.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (resetMutation.isPending) return;
          if (!canReset) {
            setError(passwordsMatch ? "Enter a password with at least 8 characters." : "The passwords do not match.");
            return;
          }
          resetMutation.mutate();
        }}
      >
        <div>
          <label htmlFor="new-password" className="mb-1 block text-xs text-muted-foreground">New password</label>
          <input
            id="new-password"
            name="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            aria-required="true"
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoFocus={!error}
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-xs text-muted-foreground">Confirm password</label>
          <input
            id="confirm-password"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            aria-required="true"
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {error} <a href="/auth/forgot-password" className="font-medium underline underline-offset-2">Request a new link</a>
          </p>
        )}
        <Button type="submit" disabled={resetMutation.isPending || !canReset} className="w-full">
          {resetMutation.isPending ? "Resetting…" : "Reset password"}
        </Button>
      </form>
    </RecoveryShell>
  );
}
