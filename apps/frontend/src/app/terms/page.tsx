
import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Terms of Service | Foolioo",
  description: "Terms governing access to and use of the Foolioo platform.",
};

const EFFECTIVE_DATE = "November 6, 2026";

export default function TermsOfServicePage() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Terms of Service"
      description="These terms explain the rules for accessing and using Foolioo, including its workspace, voice operations tools, integrations and related services."
      effectiveDate={EFFECTIVE_DATE}
    >
      <p>
        These Terms of Service (the “Terms”) apply when you access or use Foolioo (the “Service”).
        “Foolioo,” “we,” “us,” and “our” refer to the business operating the Service. “You” means
        the individual using the Service or the organization on whose behalf that individual acts.
      </p>

      <h2>1. Accepting these Terms</h2>
      <p>
        By creating an account, accepting an order, or using the Service, you agree to these Terms.
        If you use the Service for an organization, you confirm that you have authority to bind that
        organization. If you do not agree, do not access or use the Service.
      </p>

      <h2>2. Accounts and workspace security</h2>
      <p>
        You must provide accurate account information and keep it current. You are responsible for
        protecting your sign-in credentials, controlling access to your workspace, and activity
        carried out through your account. Tell us promptly through your established support channel
        if you believe someone has accessed your account without permission.
      </p>
      <p>
        You must ensure that each person using your workspace is authorized to do so and follows
        these Terms. You remain responsible for actions taken by users you invite or authorize.
      </p>

      <h2>3. Trials, plans and payment</h2>
      <p>
        Foolioo may offer trials, paid plans or usage-based features. The duration of a trial, plan
        limits, included features, price, billing frequency, taxes and renewal terms are the details
        presented at sign-up, checkout or in your order form. Those transaction-specific details
        form part of your agreement with us.
      </p>
      <p>
        You authorize the payment method you provide to be charged for amounts you approve at
        checkout or under your order form. You are responsible for keeping billing details current
        and for applicable taxes, excluding taxes on our income. Cancellation takes effect according
        to the cancellation terms shown for your plan. Any refund rights required by applicable law
        remain unaffected.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You must use the Service lawfully and only for its intended business purposes. You must not:</p>
      <ul>
        <li>Use the Service to break the law, deceive, threaten, harass or harm another person.</li>
        <li>Send unlawful spam, make prohibited calls, or contact people who have opted out or must not be contacted.</li>
        <li>Use voice, messaging or automation features without obtaining notices, permissions and consent required by law.</li>
        <li>Upload content that infringes another party’s rights or contains malicious code.</li>
        <li>Probe, disrupt, reverse engineer or attempt to bypass security or usage restrictions, except where applicable law does not allow that restriction.</li>
        <li>Resell, sublicense or make the Service available to others outside the permissions in your plan or written agreement.</li>
      </ul>

      <h2>5. Voice campaigns, AI and legal compliance</h2>
      <p>
        You control the campaigns, contact lists, scripts, prompts, rules, voice settings and
        integrations that you configure. You are responsible for the content and purpose of your
        campaigns and for ensuring that your use of automated calls, synthetic or AI-generated
        voices, call recording, transcription, messaging and personal information complies with
        applicable laws and industry requirements.
      </p>
      <p>
        This includes determining whether you must obtain prior consent, provide disclosures, identify
        an automated or recorded interaction, maintain opt-out lists, respect calling hours, or make
        recordings available to individuals. You must obtain and retain any required permissions
        before uploading contact data or initiating communications. You must promptly honor opt-out
        requests and other applicable individual rights.
      </p>
      <p>
        AI-generated responses, classifications, summaries and recommendations can be incomplete or
        inaccurate. You must review outputs and configure appropriate human oversight for your use
        case. Do not rely on the Service as a substitute for professional legal, medical, financial or
        other regulated advice.
      </p>

      <h2>6. Public live demo calls</h2>
      <p>
        The public live demo is an optional, one-time product demonstration. When you request a call,
        you confirm that you own the destination phone number or have permission to use it, and that
        you agree to receive one automated AI-generated demo call from Foolioo. The demo is currently
        limited to eligible Indian mobile numbers, is available during the hours shown on the demo page,
        and may be limited by capacity or abuse-prevention controls.
      </p>
      <p>
        The showcase agent is an AI assistant and does not represent a real school, college or
        university. Do not provide sensitive personal, financial, identity or education information
        during the demo. Public demo calls last no longer than two minutes and are not recorded. You
        may end the call at any time. You may request another demo to the same number after the
        24-hour cooldown.
      </p>

      <h2>7. Your content and data</h2>
      <p>
        As between you and Foolioo, you retain your rights to the data, contact records, recordings,
        transcripts, prompts, scripts and other materials that you or your users submit to the Service
        (“Customer Content”). You grant us a limited, non-exclusive permission to host, process,
        transmit and display Customer Content only as needed to provide, secure, maintain and support
        the Service, comply with law, and carry out your instructions.
      </p>
      <p>
        You confirm that you have the rights and permissions needed to provide Customer Content and
        to grant this permission. You must not submit sensitive or regulated information unless the
        Service and your agreement with us expressly support that use.
      </p>

      <h2>8. Integrations and third-party services</h2>
      <p>
        The Service may connect to telephony providers, CRM systems, AI services, analytics tools or
        other third-party products. Those services are governed by their own terms and privacy
        policies. We are not responsible for third-party services that we do not operate. You are
        responsible for reviewing their terms, configuring permissions and maintaining any required
        accounts.
      </p>

      <h2>9. Foolioo intellectual property</h2>
      <p>
        We and our licensors retain all rights in the Service, including its software, design,
        features, branding and documentation. These Terms grant you a limited, non-exclusive,
        non-transferable right to use the Service during your active subscription or authorized trial,
        subject to these Terms and your plan. No other rights are transferred to you.
      </p>
      <p>
        If you provide suggestions or feedback, you allow us to use them to improve the Service
        without restriction or payment to you, provided we do not identify you publicly as the source
        without permission.
      </p>

      <h2>10. Confidentiality</h2>
      <p>
        Each party must take reasonable steps to protect the other party’s non-public information
        received through use of the Service and use it only for the purposes of the relationship.
        This does not apply to information that is public through no fault of the receiving party,
        already lawfully known, independently developed, or required to be disclosed by law.
      </p>

      <h2>11. Availability and changes</h2>
      <p>
        We may update, improve or discontinue parts of the Service. We will use reasonable efforts to
        communicate material changes that affect active customers. The Service may be unavailable
        from time to time because of maintenance, outages, security events or dependencies outside
        our control. These Terms do not promise uninterrupted or error-free operation.
      </p>

      <h2>12. Suspension and termination</h2>
      <p>
        You may stop using the Service and cancel your plan through the available account controls or
        the process stated in your order form. We may suspend or restrict access if reasonably needed
        to protect the Service or its users, respond to a security incident, comply with law, address
        non-payment, or prevent a material breach of these Terms. Where practical, we will provide
        notice and an opportunity to resolve the issue.
      </p>
      <p>
        When access ends, your right to use the Service stops. Data export and deletion are handled
        according to the applicable plan terms, our retention practices and legal requirements.
      </p>

      <h2>13. Disclaimers</h2>
      <p>
        To the maximum extent permitted by law, the Service is provided on an “as available” basis.
        We do not warrant that it will meet every requirement, achieve a particular business result,
        or operate without interruption, delay or error. Nothing in these Terms excludes a guarantee
        or right that cannot lawfully be excluded.
      </p>

      <h2>14. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, neither party is liable to the other for indirect,
        incidental, special, exemplary or consequential loss, or for loss of profits, revenue, goodwill
        or data arising from use of the Service. To the maximum extent permitted by law, each party’s
        total liability arising out of or relating to the Service and these Terms is limited to the
        fees paid or payable by you for the Service during the twelve months before the event giving
        rise to the claim. This section does not limit liability that cannot legally be limited.
      </p>

      <h2>15. Indemnity</h2>
      <p>
        To the extent permitted by law, you are responsible for claims arising from your Customer
        Content, campaigns, contact practices, breach of these Terms or violation of another
        person’s rights or applicable law. You agree to reasonably cooperate in the defense of such
        claims. This section does not apply to the extent a claim was caused by our breach of these
        Terms or unlawful conduct.
      </p>

      <h2>16. Changes to these Terms</h2>
      <p>
        We may update these Terms as the Service or applicable requirements change. We will update
        the effective date above and provide notice of material changes through the Service or
        another reasonable channel. Continued use after the updated Terms take effect means you
        accept the changes, where that form of acceptance is permitted by law.
      </p>

      <h2>17. Governing law and contact</h2>
      <p>
        These Terms are subject to the mandatory laws that apply to the contracting entity providing
        your Foolioo subscription. Any governing-law and dispute-resolution terms in a signed order
        form or customer agreement take precedence over this section. For questions about these
        Terms, use the support contact provided in your workspace or customer agreement.
      </p>
    </LegalPageShell>
  );
}
