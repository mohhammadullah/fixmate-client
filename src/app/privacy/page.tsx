import type { Metadata } from "next";
import LegalPage, { LegalList, LegalNote, LegalSection } from "@/components/legal/LegalPage";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Privacy Policy",
  description:
    "Read FixMate's Privacy Policy to understand what information is collected, how it is used, and how bookings, payments, chat, and reviews are handled.",
  path: "/privacy",
});

const LAST_UPDATED = "19 November 2026";

const SECTIONS = [
  { id: "registration", title: "1. Information collected at registration" },
  { id: "profile", title: "2. Personal information in your profile" },
  { id: "bookings", title: "3. Booking and payment information" },
  { id: "chat-reviews", title: "4. Chat messages and reviews" },
  { id: "images", title: "5. Uploaded images" },
  { id: "authentication", title: "6. Authentication, sessions and JWT" },
  { id: "stripe", title: "7. Payment processing through Stripe" },
  { id: "imgbb", title: "8. Image hosting through ImgBB" },
  { id: "use", title: "9. Why we collect it and how we use it" },
  { id: "access-security", title: "10. Data access, security and retention" },
  { id: "sharing", title: "11. Data sharing with service providers" },
  { id: "rights", title: "12. Your rights and requests" },
  { id: "updates", title: "13. Changes to this policy" },
  { id: "contact", title: "14. Contact information" },
] as const;

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="FixMate · Legal"
      title="Privacy Policy"
      lede="What FixMate collects from you, why we need it, who can see it and what you can ask us to do — written from the way the platform actually works today."
      lastUpdated={LAST_UPDATED}
      sections={[...SECTIONS]}
    >
      <LegalSection id="registration" title="1. Information collected at registration">
        <p>
          Registration uses your name, the email address you sign up with, a password and — because
          the sign-up form requires them — your phone number and service area. Passwords are stored
          only as salted hashes by the authentication system; FixMate never sees or stores your
          plain-text password.
        </p>
        <p>
          Registration creates a Better Auth account in the platform database. Your email address
          identifies your account and is read-only on the platform. Your role (customer, technician
          or administrator) is assigned server-side and can never be set from the client.
        </p>
      </LegalSection>

      <LegalSection id="profile" title="2. Personal information in your profile">
        <p>The profile you maintain on the platform includes:</p>
        <LegalList
          items={[
            "Name, email address, phone number, service area and bio — the fields the profile form edits.",
            "Account metadata such as your role, account creation date, and (for customers) your technician-application status when you apply to become a technician.",
            "Your location — only if you choose to set or share it (for example through location matching or “nearby services”). Where provided, FixMate stores the area and, only with your consent, approximate coordinates rounded to about 1e-5 degrees. Raw coordinates are never returned by the public API; other users see only whether you have a location on file, never the coordinates themselves.",
            "A profile image, only if one is associated with your account through the authentication provider’s profile data. FixMate currently has no profile-photo upload flow; avatars are shown where they exist, with an initials fallback otherwise.",
          ]}
        />
      </LegalSection>

      <LegalSection id="bookings" title="3. Booking and payment information">
        <p>When you make a booking we record the booking itself — the service, your problem description, the scheduling information you optionally provide, the status timeline (requested, accepted, in-progress, completed, rejected or cancelled) and a link to the technician. The booking stores snapshots of your name and email as they were when the booking was made.</p>
        <p>For payments, FixMate stores:</p>
        <LegalList
          items={[
            "The final amount set by the technician at completion, the currency and the payment status.",
            "Stripe identifiers needed to reconcile payments — the checkout session id, the payment intent id and the checkout URL — plus invoice references.",
            "The status of refunds where any were requested or processed.",
          ]}
        />
        <LegalNote>
          FixMate does <strong>not</strong> receive or store your full card number, CVC or card
          PIN. Card payments are processed by Stripe on Stripe’s hosted checkout page; your card
          details go to Stripe, not to FixMate. See Section 7.
        </LegalNote>
      </LegalSection>

      <LegalSection id="chat-reviews" title="4. Chat messages and reviews">
        <p>
          Each booking carries a private, booking-scoped conversation between you and the assigned
          technician. Messages are at most 500 characters and a conversation holds at most 200
          messages; they are stored with the booking record and are readable in real time over the
          platform’s socket channel. Administrators can read booking conversations for moderation
          and dispute handling.
        </p>
        <p>
          When you leave a review, the review (rating 1–5 and your comment), your display name, the
          service you reviewed, the date and your profile image — if your account has one — are
          shown publicly. Ratings are aggregated per service; removing fake or abusive reviews is
          part of how the platform keeps its ratings trustworthy.
        </p>
      </LegalSection>

      <LegalSection id="images" title="5. Uploaded images">
        <p>
          Technicians can upload service images. Uploads are limited to JPEG, PNG or WebP, up to
          5 MB per file, are streamed in memory through our server directly to our image host, and
          the resulting public image URL is stored on the service listing. Images you upload must
          show the service honestly and must not contain inappropriate or unlawful content.
        </p>
        <p>
          There is currently no self-service profile-photo upload. If your account carries a
          profile image from the authentication provider’s profile data, it is displayed publicly
          wherever the platform shows avatars (navigation, dashboard, and your public reviews).
        </p>
      </LegalSection>

      <LegalSection id="authentication" title="6. Authentication, sessions and JWT">
        <p>
          Authentication is handled by Better Auth, backed by the platform database. Your browser
          holds a session cookie managed by Better Auth; authenticated API requests also use a
          short-lived token issued by the authentication system (claims: your account id, email and
          role), which is fetched per request from the authentication service and never persisted in
          local storage.
        </p>
        <LegalList
          items={[
            "Every protected API request is verified server-side; nothing in the client is trusted to prove identity or role.",
            "Your role (customer / technician / administrator) changes only through server-side processes, never from the client.",
            "Rate limits are applied to credential paths (sign-in / sign-up / recovery) and to the general API to reduce abuse.",
          ]}
        />
      </LegalSection>

      <LegalSection id="stripe" title="7. Payment processing through Stripe">
        <p>
          All payments go through Stripe. Stripe Checkout is a hosted page; card details you enter
          there are processed by Stripe under Stripe’s own privacy and PCI DSS compliance framework.
          FixMate does not see your card number and stores only the Stripe identifiers listed in
          Section 3, together with booking and invoice state.
        </p>
        <p>
          Stripe tells us asynchronously (webhook) whether a checkout completed, failed or expired;
          the platform marks the booking accordingly and generates an invoice. Stripe’s use of your
          payment details is governed by Stripe’s privacy policy, not this one.
        </p>
      </LegalSection>

      <LegalSection id="imgbb" title="8. Image hosting through ImgBB">
        <p>
          Service images are hosted by ImgBB. When a technician uploads an image, the file is sent
          from our server to ImgBB’s upload API; the resulting public image URL is stored on the
          listing and served from ImgBB’s infrastructure to anyone viewing the service. ImgBB’s
          privacy practices apply to files hosted there.
        </p>
        <p>
          Do not upload images containing personal data you would not want hosted publicly (the
          images will be publicly viewable as part of the listing). Service images do not go into
          the application database; only the URL is stored.
        </p>
      </LegalSection>

      <LegalSection id="use" title="9. Why we collect it and how we use it">
        <p>Everything listed above exists for a platform purpose:</p>
        <LegalList
          items={[
            "To run your account and authenticate you on every request.",
            "To show you listings, support search and filter them, and keep bookings matched to the right technician.",
            "To operate the booking lifecycle end to end: request, acceptance, in-progress, completion, payment and invoice.",
            "To process payments, refunds and invoices, and to keep Stripe’s records reconciled with booking state.",
            "To show public trust signals — genuine reviews and ratings — and to prevent fake or abusive content.",
            "To let administrators moderate listings, applications, reviews and chats for safety and for dispute handling.",
            "To send you in-app notifications about booking and refund events.",
          ]}
        />
      </LegalSection>

      <LegalSection id="access-security" title="10. Data access, security and retention">
        <p>
          Access inside the platform is role-scoped. Customers see their own data; technicians see
          bookings assigned to them and their own listings; administrators see what administration
          requires (applications, listings, bookings, payments, refunds, users for support and
          moderation). Public users see only approved, available services and public review data.
        </p>
        <LegalList
          items={[
            "Passwords are stored only as salted hashes; FixMate cannot recover your password.",
            "Authentication is verified server-side on every request; role decisions never come from the client.",
            "Database access is not public; transport security depends on deployment (TLS in production) — we do not claim end-to-end encryption, and this policy makes no certification claims.",
            "Retention: we keep account and transaction records while your account exists and as needed for bookkeeping, dispute handling, fraud prevention and legal compliance. There is no fixed, published retention period or automated deletion timer today — if you need data removed, contact us (Section 12).",
            "Backups, if any, are operated by the hosting provider and are outside your control.",
          ]}
        />
        <LegalNote>
          We cannot honestly verify claims such as database encryption at rest, ISO-27001
          certification or GDPR adequacy for the hosting provider — none are asserted here. Ask
          support for the current deployment’s specifics if you need them for a compliance review.
        </LegalNote>
      </LegalSection>

      <LegalSection id="sharing" title="11. Data sharing with service providers">
        <p>
          FixMate shares data only with the providers that make the platform work, and never sells
          personal data:
        </p>
        <LegalList
          items={[
            "Stripe — payments and refunds; receives booking/invoice references and your payment details directly from you at checkout.",
            "ImgBB — service images uploaded by technicians; receives the image file itself.",
            "The database and hosting providers that operate the platform’s storage and network.",
            "FixMate administrators, acting in a moderation/support capacity under the platform’s administrative controls.",
            "Law enforcement or regulators, when legally required.",
          ]}
        />
        <p>
          We do not share your profile, bookings or reviews with advertisers or data brokers, and
          we do not run marketing cookies or analytics trackers on this site (the only client-side
          preference stored is your theme choice).
        </p>
      </LegalSection>

      <LegalSection id="rights" title="12. Your rights and requests">
        <p>You can correct most profile data yourself at any time from your profile page. For everything else, contact:</p>
        <LegalList
          items={[
            "Email: gmhgazi92@gmail.com",
            "Phone: 01952182385",
          ]}
        />
        <p>
          Include your account email and, where relevant, the booking or payment reference. We will
          act on access, correction and deletion requests as a practical matter, but we cannot
          guarantee specific timelines, and we currently do not offer a fully self-service
          account-deletion flow. Deletion requests may be refused or limited where retention is
          required for bookkeeping, dispute, fraud-prevention or legal reasons.
        </p>
      </LegalSection>

      <LegalSection id="updates" title="13. Changes to this policy">
        <p>
          This policy is updated as the platform evolves. The “Last updated” date at the top of this
          page shows when it was last changed, and material changes will be highlighted here.
          Continued use after a change constitutes acceptance of the updated policy.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="14. Contact information">
        <p>Questions or requests about this policy or your data:</p>
        <LegalList
          items={[
            "Email: gmhgazi92@gmail.com",
            "Phone: 01952182385",
            "Address: Khulna, Bangladesh",
            "LinkedIn: linkedin.com/in/gazi-mohammadullah",
          ]}
        />
        <p className="text-sm text-muted">
          This policy was drafted from the platform’s actual implementation as of 19 November 2026.
          It is a practical operating document, not legal advice, and not a guarantee of compliance
          in your jurisdiction. Decisions that are yours to make — a data-deletion SLA, a retention
          schedule, a privacy contact role, governing jurisdiction and any certification you want
          to pursue — are deliberately marked as open items rather than invented here. A qualified
          lawyer should review this policy before relying on it for compliance purposes.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
