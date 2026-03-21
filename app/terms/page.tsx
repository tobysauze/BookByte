import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing your use of BookByte, including user content and AI-generated output.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-8">
      <header className="space-y-2 border-b border-[rgb(var(--border))] pb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))]">
          Legal
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="text-sm text-[rgb(var(--muted-foreground))]">
          Last updated: March 19, 2026
        </p>
      </header>

      <div className="space-y-6 text-sm leading-relaxed text-[rgb(var(--foreground))]">
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Agreement</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            By accessing or using BookByte (“Service”), you agree to these Terms. If you do not
            agree, do not use the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">The Service</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            BookByte provides tools to upload documents, generate AI-assisted summaries and
            related content, listen to audio renditions, and browse or share content where the
            product allows. Features may change, and we may suspend or discontinue parts of the
            Service with reasonable notice where practicable.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Accounts</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            You are responsible for your account credentials and for activity under your account.
            Provide accurate information and notify us promptly if you suspect unauthorized use.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Your content</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            You retain ownership of content you upload. You grant BookByte a worldwide,
            non-exclusive license to host, process, store, reproduce, and display your content
            solely to operate, secure, and improve the Service — including sending portions to AI
            providers as needed to generate summaries and related outputs.
          </p>
          <p className="text-[rgb(var(--muted-foreground))]">
            You represent that you have the rights necessary to upload your content and that doing
            so does not violate law or third-party rights. Do not upload unlawful, infringing, or
            malicious material.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">AI-generated output</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            Summaries, insights, audio, cover images, and other outputs are generated using AI
            and automated systems.{" "}
            <strong className="text-[rgb(var(--foreground))]">
              AI can be inaccurate, incomplete, or misleading.
            </strong>{" "}
            Do not rely on outputs as professional, legal, medical, or financial advice. You are
            responsible for how you use generated content.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Acceptable use</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            You agree not to misuse the Service — including attempting to access others’ data,
            probing or attacking our systems, scraping in violation of our rules, circumventing
            limits, or using the Service to violate applicable law. We may suspend or terminate
            access for violations.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Intellectual property</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            The BookByte name, branding, and software (excluding your content) are owned by us
            or our licensors. Feedback you provide may be used without obligation to you.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Disclaimers</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF ANY KIND,
            EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
            NON-INFRINGEMENT, TO THE MAXIMUM EXTENT PERMITTED BY LAW.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Limitation of liability</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, BOOKBYTE AND ITS SUPPLIERS WILL NOT BE LIABLE
            FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOSS OF
            PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY
            FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF AMOUNTS YOU PAID
            US FOR THE SERVICE IN THE TWELVE (12) MONTHS BEFORE THE CLAIM OR ONE HUNDRED U.S.
            DOLLARS (US$100), IF YOU HAVE NOT PAID ANYTHING THEN THE LATTER CAP APPLIES.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Termination</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            You may stop using the Service at any time. We may suspend or terminate access if you
            breach these Terms or if we need to do so for legal, security, or operational
            reasons.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Changes</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            We may modify these Terms. We will post updates on this page and change the “Last
            updated” date. Continued use after changes constitutes acceptance of the revised Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Governing law</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            These Terms are governed by applicable law without regard to conflict-of-law rules,
            except where mandatory consumer protections in your jurisdiction require otherwise.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Contact</h2>
          <p className="text-[rgb(var(--muted-foreground))]">
            Questions about these Terms? See our{" "}
            <Link
              href="/privacy"
              className="font-medium text-[rgb(var(--accent))] underline-offset-4 hover:underline"
            >
              Privacy Policy
            </Link>{" "}
            or reach out through the contact options provided on the site.
          </p>
        </section>
      </div>
    </article>
  );
}
