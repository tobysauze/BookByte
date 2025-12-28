import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md space-y-8 rounded-4xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] p-8 shadow-sm">
      <header className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
          Welcome back
        </p>
        <h1 className="text-3xl font-semibold">Sign in to BookByte</h1>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          Use your email to log in or create a new account.
        </p>
      </header>
      <AuthForm />
    </div>
  );
}







