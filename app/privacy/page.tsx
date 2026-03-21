import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How BookByte collects, uses, and stores your data, uploads, summaries, and audio.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-8">
      <header className="space-y-2 border-b border-[rgb(var(--border))] pb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
          Legal
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          Last updated: March 19, 2026
        </p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-[rgb(var(--foreground))]">
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Who we are</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            BookByte (“we,” “us”) provides an online service that helps you upload books or
            documents, generate AI-assisted summaries and related content, and listen to audio
            versions where available. This policy explains what personal data we handle and how.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">What we collect</h2>
          <ul className="list-inside list-disc space-y-2 text-[rgb(var(--muted-foreground))]">
            <li>
              <strong className="text-[rgb(var(--foreground))]">Account information</strong> —
              such as your email address and authentication identifiers when you create an account
              (handled by our authentication provider).
            </li>
            <li>
              <strong className="text-[rgb(var(--foreground))]">Content you upload</strong> —
              files you submit (for example PDFs, text, or Markdown), including extracted text
              needed to produce summaries.
            </li>
            <li>
              <strong className="text-[rgb(var(--foreground))]">Generated content</strong> —
              summaries, structured sections, insights, cover art, and other outputs our systems
              create from your uploads or instructions.
            </li>
            <li>
              <strong className="text-[rgb(var(--foreground))]">Audio</strong> — when you use
              text-to-speech features, we store generated audio files associated with your
              summaries so you can play them in the app.
            </li>
            <li>
              <strong className="text-[rgb(var(--foreground))]">Technical data</strong> — basic
              logs and operational data needed to run the service securely (for example error
              logs, timestamps, and identifiers required for storage URLs).
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">How we use your information</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            We use this information to operate BookByte: authenticate you, process uploads,
            generate summaries and audio, show your library, and improve reliability and security.
            We use third-party AI and infrastructure providers to process content as part of the
            service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Who can see your content</h2>
          <ul className="list-inside list-disc space-y-2 text-[rgb(var(--muted-foreground))]">
            <li>
              Content you keep private is intended to be visible only to you and our systems that
              power the product, subject to technical and administrative access needed to run and
              secure the service.
            </li>
            <li>
              If you mark a summary or book as <strong className="text-[rgb(var(--foreground))]">public</strong>{" "}
              (or similar), it may appear on shared areas of the site (for example discovery or
              featured lists) for other visitors.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Retention</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            We keep your account data and content for as long as your account is active and as
            needed to provide the service. When you delete books or related content in the app,
            we work to remove associated files from our storage on a best-effort basis; some
            residual backups or logs may persist for a limited period for security and operations.
            If you need help with data requests, contact us using the details below.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Security</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            We use industry-standard hosting and access controls, but no method of transmission
            or storage is 100% secure. Please use a strong password and avoid uploading highly
            sensitive information you are not comfortable storing online.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Third-party services</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            BookByte relies on vendors for authentication, database and file storage, AI
            providers, and hosting. Their processing is governed by their terms and privacy
            policies in addition to this notice.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Children</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            The service is not directed at children under 13 (or the minimum age in your
            jurisdiction). Do not use BookByte if you do not meet that age requirement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Changes</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            We may update this policy from time to time. We will post the revised version on this
            page and update the “Last updated” date.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Contact</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            For privacy questions or requests, please reach out through the contact method shown
            on the site or your account communications. You can also review our{" "}
            <Link href="/terms" className="font-medium text-[rgb(var(--accent))] underline-offset-4 hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </section>
      </div>
    </article>
  );
}
