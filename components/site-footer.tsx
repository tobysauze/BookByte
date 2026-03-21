import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[rgb(var(--border))] pb-8 pt-10 text-center text-xs text-[rgb(var(--muted-foreground))]">
      <p className="mb-3">&copy; {new Date().getFullYear()} BookByte. All rights reserved.</p>
      <nav
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1"
        aria-label="Legal"
      >
        <Link href="/privacy" className="underline-offset-4 hover:underline">
          Privacy Policy
        </Link>
        <span aria-hidden className="text-[rgb(var(--border))]">
          ·
        </span>
        <Link href="/terms" className="underline-offset-4 hover:underline">
          Terms of Service
        </Link>
      </nav>
    </footer>
  );
}
