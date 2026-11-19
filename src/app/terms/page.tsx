import Link from "next/link";
import type { Metadata } from "next";
import LegalPage, { LegalList, LegalNote, LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "The terms that govern the FixMate platform — how accounts, technician listings, bookings, Stripe checkout payments, cancellations, refunds, reviews and disputes work.",
};

const LAST_UPDATED = "19 November 2026";

const SECTIONS = [
  { id: "overview", title: "1. Platform overview and service scope" },
  { id: "customer-accounts", title: "2. Customer account responsibilities" },
  { id: "technician-registration", title: "3. Technician registration and listings" },
  { id: "listing-accuracy", title: "4. Service listing accuracy and approval" },
  { id: "bookings", title: "5. Booking requests and confirmation" },
  { id: "completion", title: "6. Booking status and repair completion" },
  { id: "payments", title: "7. Payments and Stripe Checkout" },
  { id: "cancellation-refunds", title: "8. Cancellation and refund rules" },
  { id: "reviews", title: "9. Reviews and prohibited misuse" },
  { id: "chat", title: "10. Chat and communication responsibilities" },
  { id: "disputes", title: "11. Disputes and support" },
  { id: "suspension", title: "12. Account suspension and termination" },
  { id: "limitations", title: "13. Platform limitations and liability" },
  { id: "changes", title: "14. Changes to these terms" },
  { id: "contact", title: "15. Contact information" },
] as const;

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="FixMate · Legal"
      title="Terms & Conditions"
      lede="How FixMate works and the rules that apply when you use it — for customers, technicians and administrators. These terms reflect the platform as it is actually implemented today."
      lastUpdated={LAST_UPDATED}
      sections={[...SECTIONS]}
    >
      <LegalSection id="overview" title="1. Platform overview and service scope">
        <p>
          FixMate is an online marketplace that connects customers who need devices or household
          appliances repaired with independent, verified repair technicians. FixMate itself does not
          perform any repairs. The technicians you engage through the platform are independent
          service providers, not employees or agents of FixMate.
        </p>
        <p>
          Only services that have been approved and marked available by our administration team are
          listed publicly. The categories currently supported are: Smartphone, Laptop &amp; PC, AC,
          Refrigerator, TV, Washing Machine and Electrical.
        </p>
        <p>By creating an account or using any part of the platform, you agree to these Terms &amp; Conditions and to our <Link className="font-semibold text-accent-strong hover:underline dark:text-accent" href="/privacy">Privacy Policy</Link>.</p>
      </LegalSection>

      <LegalSection id="customer-accounts" title="2. Customer account responsibilities">
        <p>
          Registration requires a real name, email address, phone number and service area, together
          with a password. Please provide accurate, current information and keep it up to date from
          your profile. You are responsible for all activity that happens under your account, for
          keeping your credentials confidential and for telling us promptly if you suspect your
          account has been compromised.
        </p>
        <LegalList
          items={[
            "Your email address is read-only on the platform; it cannot be changed from the profile form.",
            "Name, phone, service area and bio can be edited from your profile.",
            "Your role cannot be changed by you — technician status comes from an approved application, never from self-promotion.",
            "You must be at least the age required by law in your jurisdiction to form a binding agreement.",
          ]}
        />
      </LegalSection>

      <LegalSection id="technician-registration" title="3. Technician registration and listings">
        <p>
          Anyone with a customer account may apply to become a technician from the “Become a
          technician” page. The application is submitted to our administration team, who review it
          using your profile details (name, phone, area) plus application-specific information such
          as your experience, skills and bio. An application is either approved or rejected with a
          stated reason, and you are notified of the outcome.
        </p>
        <p>Once approved, technicians are expected to:</p>
        <LegalList
          items={[
            "Keep service listings accurate — title, category, description, hourly rate, security deposit, maximum capacity, location and image.",
            "Honour the bookings you accept and update their status honestly (requested → accepted → in-progress → completed).",
            "Set realistic availability and keep it current with the availability tools.",
            "Use only the support channels we provide — including the booking chat — for work-related communication.",
            "Charge only the final amount you set when marking the booking as completed. The final amount is your repair charge; it is the amount the customer will be asked to pay through the platform.",
          ]}
        />
      </LegalSection>

      <LegalSection id="listing-accuracy" title="4. Service listing accuracy and approval">
        <p>
          All listings are created, edited and re-submitted by technicians, and every listing is
          reviewed by our administration team before it appears publicly. A listing is only visible
          to the public once it is approved and marked available.
        </p>
        <LegalList
          items={[
            "Listings require a title, category, description/overview, hourly rate, security deposit, maximum capacity, location and at least one image (JPEG, PNG or WebP, up to 5 MB, hosted on our image host).",
            "Every new listing, and every edit to an existing listing, re-enters the approval queue and must be re-approved before it appears or is updated publicly.",
            "Approved/rejected status is set by the administration team; rejection includes a reason, and technicians may edit and re-submit.",
            "Misleading, inaccurate or unsafe listings will be rejected or removed; repeated or deliberate misrepresentation may lead to suspension of the technician account.",
            "Technicians control an isAvailable toggle — unavailable listings do not appear publicly, even if they are approved.",
          ]}
        />
      </LegalSection>

      <LegalSection id="bookings" title="5. Booking requests and confirmation">
        <p>
          Submitting a booking request is an offer, not a confirmed appointment. No appointment is
          confirmed until the technician accepts your request.
        </p>
        <LegalList
          items={[
            "A booking request includes the service, your problem description (10–2000 characters) and, where the technician publishes availability, an optional preferred date/time slot.",
            "While a booking is in an active state (requested, accepted or in-progress), you cannot make another booking for the same service; you may book again once the booking is completed, rejected or cancelled.",
            "The technician may accept or reject each request from their incoming-bookings queue.",
            "You can cancel a booking only while it is still in the “requested” state.",
            "After acceptance, the booking proceeds to in-progress and, eventually, completed.",
          ]}
        />
      </LegalSection>

      <LegalSection id="completion" title="6. Booking status and repair completion">
        <p>
          The booking lifecycle is: requested → accepted → in-progress → completed, or rejected /
          cancelled. Only the assigned technician can move a booking forward, and only after
          accepting it.
        </p>
        <LegalList
          items={[
            "When the repair is finished, the technician marks the booking as completed and sets the final amount — the actual charge for the work.",
            "The final amount is set by the technician and is binding for the payment step; FixMate does not mark up, re-price or discount it except through discretionary coupon codes applied at checkout.",
            "Completing a booking generates an invoice record for the booking; the invoice and booking timeline are kept for your records.",
            "Completed bookings become eligible for payment (Section 7) and for a review (Section 9).",
          ]}
        />
      </LegalSection>

      <LegalSection id="payments" title="7. Payments and Stripe Checkout">
        <p>
          FixMate does not process or store card payments itself. All payments are handled by Stripe,
          our payment processor, through Stripe Checkout — a hosted checkout page operated by Stripe.
          You pay Stripe directly; your card details are handled by Stripe and are never sent to or
          stored by FixMate.
        </p>
        <LegalList
          items={[
            "Payment is possible only for bookings that are completed and still unpaid, and only by the customer who made the booking.",
            "The amount is the final amount set by the technician at completion, charged in the platform’s configured currency.",
            "At most one pending checkout session can exist per booking at a time; an in-progress session is reused, or reused after it expires.",
            "Stripe notifies us asynchronously (webhook) whether a payment succeeded, failed or expired; the booking’s payment status is reconciled from those notifications, and a payment reference (the Stripe session id) is kept for reconciliation.",
            "Coupon codes, when issued by the administration team, can be applied to completed unpaid bookings and are subject to their stated rules (type, value, expiry, usage limits). They are discretionary, limited and may expire or be withdrawn.",
            "If Stripe reports a payment as failed or expired, the booking remains unpaid and can be paid again later.",
          ]}
        />
      </LegalSection>

      <LegalSection id="cancellation-refunds" title="8. Cancellation and refund rules">
        <p>FixMate has no fixed cancellation deadline other than the booking lifecycle itself.</p>
        <LegalList
          items={[
            "Cancellation by the customer is possible only while the booking is in the “requested” state. Once a technician accepts, the booking can no longer be self-cancelled.",
            "For bookings that are accepted, in-progress or completed, contact support (Section 11) — there is currently no self-service cancellation flow at those stages.",
            "Refunds are only possible for payments whose Stripe payment status is “succeeded”. A refund is requested with a reason (at least 10 characters, at most 500).",
            "Only one refund request can be pending per payment at a time, and each payment may accumulate at most ten refund records.",
            "Every refund request is reviewed by our administration team. Approval issues a real Stripe refund (full or remaining amount); rejection is given with a note. FixMate acts on the administration team’s decision.",
            "Refunds are not automatic, not guaranteed and not instant — after approval, Stripe’s own refund timelines apply. Partial refunds are supported.",
            "Once a refund fully covers a payment, the payment and booking are marked refunded; partially refunded payments remain partially refunded.",
          ]}
        />
        <LegalNote>
          FixMate does not charge security deposits, hold money in escrow, or deduct fees at
          checkout. The “security deposit” shown on a listing is stated by the technician at listing
          time and is <strong>not</strong> collected by the platform. What deposits mean in your
          arrangement with a technician is unresolved and is flagged as an open business decision in
          Section 15.
        </LegalNote>
      </LegalSection>

      <LegalSection id="reviews" title="9. Reviews and prohibited misuse">
        <p>
          Reviews can be left only for bookings that reached the completed state. Each completed
          booking can receive one review, with a rating from 1 to 5 and a comment of 10–1000
          characters.
        </p>
        <p>
          Reviews are public and are part of the trust system: the public reviews feed, the service
          rating and the aggregated ratings are computed from genuine stored reviews. Public reviews
          may show your display name, your comment, rating, date, the service title and category,
          the technician’s name and, if your account carries a profile image, your profile image.
        </p>
        <p>Prohibited in reviews and elsewhere on the platform:</p>
        <LegalList
          items={[
            "Fake, paid, coerced or otherwise inauthentic reviews; reviewing your own services or a competitor’s services dishonestly.",
            "Harassment, defamation, hate speech, threats or sharing another person’s private information.",
            "Content that is unlawful, fraudulent, spam, or designed to deceive (fake identities, fake listings, fake images).",
            "Using reviews, chat or the platform to circumvent the booking/payment system or to solicit unlawful off-platform arrangements.",
          ]}
        />
      </LegalSection>

      <LegalSection id="chat" title="10. Chat and communication responsibilities">
        <p>
          Each active booking has a private, booking-scoped chat between the customer and the
          assigned technician. Messages are at most 500 characters; a conversation is capped at 200
          messages. The chat is delivered in real time over the platform’s socket connection and is
          stored with the booking record.
        </p>
        <LegalList
          items={[
            "Keep chat professional and on-topic — it exists to coordinate the repair.",
            "Do not share passwords, full payment card details or other sensitive personal data in chat (FixMate will never ask for these).",
            "Administrators may read booking chats for moderation, safety and dispute handling.",
            "Abusive, unlawful or spam messages may lead to message removal and account action (Section 12).",
          ]}
        />
      </LegalSection>

      <LegalSection id="disputes" title="11. Disputes and support">
        <p>
          Most concerns are resolved fastest by contacting support with the booking reference,
          service title, date and a short description of the issue:
        </p>
        <LegalList
          items={[
            "Email: gmhgazi92@gmail.com",
            "Phone: 01952182385",
          ]}
        />
        <p>
          For refund-related disputes, the administration team’s decision — approve or reject, with
          an optional note — is the resolution the platform will act on, and it is implemented
          through Stripe where approved. FixMate can review the booking and payment records to help
          investigate, but does not adjudicate broader legal claims and cannot guarantee resolution
          timelines. Nothing in these terms limits rights that cannot legally be limited.
        </p>
      </LegalSection>

      <LegalSection id="suspension" title="12. Account suspension and termination">
        <p>
          We may suspend or terminate an account, or restrict features, when we have a reasonable
          basis to believe the terms are being violated or the platform needs protecting. Examples
          include:
        </p>
        <LegalList
          items={[
            "Fraud, misrepresentation, fake listings, fake reviews or impersonation.",
            "Repeated abusive cancellations (where possible), abuse of the refund process, or charge disputes resolved against you.",
            "Harassment or unlawful content in chat, reviews or listings.",
            "A compromised account, or activity that puts other users or the platform at risk.",
            "Technician listings repeatedly rejected for the same inaccurate information, or a technician not honouring accepted bookings.",
          ]}
        />
        <p>
          Administrative accounts are managed separately by the administrative hierarchy, not through
          the public site. Where feasible we will notify the affected user; you may contact support
          to ask about any action taken against your account.
        </p>
      </LegalSection>

      <LegalSection id="limitations" title="13. Platform limitations and liability">
        <p>
          FixMate is an intermediary. Repairs are performed by independent technicians. We are not
          a party to the repair agreement between you and the technician, and we are not liable for
          the workmanship, materials, delays, property damage or data loss arising from a repair.
          You should back up any device before handing it over.
        </p>
        <LegalList
          items={[
            "The platform is provided “as is” without warranties of uninterrupted or error-free operation.",
            "Booking requests are not guaranteed appointments; availability changes and technicians may accept or reject.",
            "Ratings and reviews are user-generated content; FixMate does not guarantee their accuracy (we provide the tools and moderation mechanisms).",
            "FixMate’s liability is limited to the extent permitted by law, and nothing in these terms excludes liability that cannot be excluded (including, where applicable, mandatory consumer rights).",
            "No liability is accepted for losses arising from events outside our control (force majeure), including network, hosting or third-party payment outages.",
          ]}
        />
      </LegalSection>

      <LegalSection id="changes" title="14. Changes to these terms">
        <p>
          We may update these Terms &amp; Conditions as the platform evolves. The “Last updated”
          date above shows when this page was last changed. Material changes will be highlighted on
          this page; continued use of the platform after a change constitutes acceptance of the
          updated terms. If you do not agree with an update, you should stop using the platform and
          contact support.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="15. Contact information">
        <p>Questions about these terms or the platform in general:</p>
        <LegalList
          items={[
            "Email: gmhgazi92@gmail.com",
            "Phone: 01952182385",
            "Address: Khulna, Bangladesh",
            "LinkedIn: linkedin.com/in/gazi-mohammadullah",
          ]}
        />
        <p className="text-sm text-muted">
          These pages are a practical, good-faith draft based on the platform’s actual current
          implementation. They are not legal advice and not a guarantee of compliance in your
          jurisdiction. Items that require a business-owner decision — for example the security
          deposit policy, refund timelines, warranty position, governing law and liability caps —
          must be defined by the business owner and reflected here before relying on them. Please
          obtain advice from a qualified lawyer for your jurisdiction.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
