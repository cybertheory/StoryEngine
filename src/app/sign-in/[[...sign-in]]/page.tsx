"use client";

import { Suspense, useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Masthead } from "@/components/layout/masthead";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppSession } from "@/contexts/auth-context";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { signInFormErrorMessage } from "@/lib/convex-user-error";
import { AlertCircle } from "lucide-react";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, setSessionToken } = useAppSession();
  const login = useMutation(api.auth.login);

  const redirectTo = safeRedirectPath(searchParams.get("redirect"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    router.replace(redirectTo);
  }, [isLoaded, isSignedIn, redirectTo, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const { token } = await login({ email, password });
      setSessionToken(token);
      router.replace(redirectTo);
    } catch (err) {
      setError(signInFormErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="newspaper-rule-thick mb-6" />
      <h1 className="font-display text-3xl font-black tracking-tight mb-2">
        Sign In
      </h1>
      <p className="text-sm text-muted-foreground font-body mb-6">
        Welcome back. Build and remix any universe — share your stories.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            className="flex gap-2 rounded-none border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive font-body"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle
              className="h-4 w-4 shrink-0 mt-0.5"
              aria-hidden
            />
            <span>{error}</span>
          </div>
        )}
        <div>
          <label className="section-label mb-1.5 block">Email</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="you@example.com"
            className="font-body border-foreground/30"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className="section-label mb-1.5 block">Password</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            placeholder="••••••••"
            className="font-body border-foreground/30"
            autoComplete="current-password"
            required
            minLength={8}
          />
        </div>
        <Button
          type="submit"
          disabled={pending}
          className="w-full font-mono-face text-xs tracking-wider uppercase h-10"
        >
          {pending ? "Signing in…" : "Sign In"}
        </Button>
      </form>

      <Separator className="bg-foreground/10 my-6" />

      <p className="text-center text-xs text-muted-foreground font-body">
        Don&apos;t have an account?{" "}
        <Link
          href={
            redirectTo !== "/"
              ? `/sign-up?redirect=${encodeURIComponent(redirectTo)}`
              : "/sign-up"
          }
          className="text-foreground underline underline-offset-2"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <>
      <Masthead />
      <main className="flex-1 flex items-center justify-center px-4 py-20">
        <Suspense
          fallback={
            <div className="w-full max-w-sm h-48 border border-foreground/10 animate-pulse bg-muted/20" />
          }
        >
          <SignInForm />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
