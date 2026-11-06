
import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy | Foolioo",
  description: "Learn how Foolioo processes and protects information.",
};

const EFFECTIVE_DATE = "November 6, 2026";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      eyebrow="Legal"
      title="Privacy Policy"
      description="This policy explains the categories of information that may be processed when you use Foolioo and the choices and responsibilities that apply to your workspace."
      effectiveDate={EFFECTIVE_DATE}
    >
      <p>
        This Privacy Policy describes how the business operating Foolioo (“Foolioo,” “we,” “us” or
        “our”) handles information in connection with the Foolioo website, workspace, voice
        operations tools and related services (the “Service”). It applies to account holders,
        workspace users and people whose information customers place in the Service.
      </p>

      <h2>1. Roles and responsibilities</h2>
      <p>
        When you create and manage a Foolioo workspace, we generally use account and service
        information to operate the Service. When a customer uploads contact details, configures a
        campaign, or processes calls and transcripts through the Service, that customer decides why
        and how those individuals’ information is used. In those cases, the customer is responsible
        for providing required notices, obtaining permissions and responding to requests from those
        individuals. Our role in handling that information depends on the customer’s instructions
        and the agreement in place.
      </p>

      <h2>2. Information that may be processed</h2>
      <p>Depending on the features you use and how your workspace is configured, information may include:</p>
      <ul>
        <li><strong>Account details:</strong> name, work email, sign-in and authentication information, and account preferences.</li>
        <li><strong>Workspace details:</strong> organization settings, team members, roles, workflow instructions, prompts, scripts and configuration choices.</li>
        <li><strong>Contact and campaign data:</strong> names, phone numbers, CRM records, campaign lists, interaction history and other details supplied by you or an integration.</li>
        <li><strong>Voice and interaction data:</strong> call metadata, audio recordings, transcripts, summaries, outcomes and agent activity, where the relevant feature or provider is enabled.</li>
        <li><strong>Usage and device data:</strong> feature activity, timestamps, diagnostic logs, browser information, device information and security events.</li>
        <li><strong>Billing information:</strong> subscription, invoice and transaction status. Payment credentials may be handled by the payment provider used at checkout.</li>
        <li><strong>Support communications:</strong> information you provide when contacting support or reporting a problem.</li>
      </ul>

      <h2>3. How information is used</h2>
      <p>Information may be used to:</p>
      <ul>
        <li>Create and secure accounts, authenticate users and administer workspaces.</li>
        <li>Provide voice workflows, campaigns, integrations, dashboards, reporting and other requested features.</li>
        <li>Process call instructions and interaction data through the AI, telephony or other providers selected for the workspace.</li>
        <li>Provide customer support, troubleshoot errors and maintain the reliability and security of the Service.</li>
        <li>Manage subscriptions, payments, service notices and requested communications.</li>
        <li>Detect abuse, enforce our terms, protect users and comply with legal obligations.</li>
        <li>Understand service performance and improve the Service using appropriate operational information.</li>
      </ul>

      <h2>4. AI, voice recordings and transcripts</h2>
      <p>
        If you enable voice or AI features, the information needed to carry out those features may
        be processed by Foolioo and the relevant providers configured for your workspace. Depending
        on the workflow, this can include prompts, campaign instructions, contact details, audio,
        transcripts and interaction outcomes. The providers involved and the settings available to
        you depend on the integrations and configuration you select.
      </p>
      <p>
        Customers are responsible for deciding whether calls may be placed or recorded, giving any
        required notice, obtaining legally required consent, and honoring opt-outs and other rights.
        Do not upload contact information or enable recording unless you have a lawful basis and the
        required permissions to do so. Check your workspace and provider settings for available
        recording, transcription, retention and processing controls.
      </p>

      <h2>5. Public live demo calls</h2>
      <p>
        If you request a public Foolioo live demo call, we process the phone number you provide,
        your selected conversation scenario and language, your consent timestamp and policy version,
        and limited request and security information such as your IP address. We use this information
        to place the call you requested, prevent repeated or abusive requests, and operate the demo.
      </p>
      <p>
        Public demo calls are limited to two minutes and are not recorded. We do not retain the demo
        call transcript, summary or conversational analysis. The destination phone number is retained
        for approximately 24 hours to enforce the one-call-per-number cooldown, then redacted during the
        next 15-minute cleanup pass from the demo contact, queue and call records. Limited call metadata, such as whether the call connected,
        duration and service cost, may remain for operational, security and accounting purposes.
      </p>

      <h2>6. How information may be shared</h2>
      <p>Information may be disclosed in the following circumstances:</p>
      <ul>
        <li><strong>Service providers:</strong> hosting, infrastructure, authentication, AI, telephony, analytics, payment and support providers that help deliver the Service.</li>
        <li><strong>Your integrations:</strong> CRM, communication and other services that you choose to connect or authorize.</li>
        <li><strong>Workspace administrators:</strong> people with appropriate permissions in your organization may access workspace information and activity.</li>
        <li><strong>Legal and safety reasons:</strong> where disclosure is required by law or reasonably necessary to protect rights, users, systems or the public.</li>
        <li><strong>Business changes:</strong> in connection with a merger, acquisition, financing or transfer of all or part of the business, subject to applicable safeguards.</li>
      </ul>
      <p>
        We do not describe or promise a fixed list of providers in this policy because the providers
        used can depend on your plan, region and enabled integrations. Review your workspace
        configuration and applicable customer agreement for provider-specific information.
      </p>

      <h2>7. Retention and deletion</h2>
      <p>
        We retain information for as long as reasonably necessary to provide the Service, maintain
        security, meet contractual commitments, resolve disputes and comply with law. Retention can
        vary by information type, feature, customer configuration and provider. Customers should
        use available workspace controls and their connected-provider settings to manage call data
        and other Customer Content. Some information may remain in backups or records where required
        for security, accounting or legal reasons, and will be handled according to applicable
        retention requirements.
      </p>

      <h2>8. Security</h2>
      <p>
        We use reasonable technical and organizational measures designed to protect information
        against unauthorized access, loss, misuse or alteration. No online service or storage system
        can be guaranteed to be completely secure. You are responsible for protecting account
        credentials, limiting workspace access and promptly reporting suspected compromise.
      </p>

      <h2>9. International processing</h2>
      <p>
        Foolioo and its service providers may process information in countries other than the country
        where you or your contacts are located. Where required, appropriate contractual or other
        safeguards will be used for cross-border processing. Your use of a third-party integration
        may also involve transfers governed by that provider’s terms and privacy policy.
      </p>

      <h2>10. Your choices and privacy rights</h2>
      <p>
        Depending on your location and the role you have in the workspace, you may have rights to
        request access to, correction of, deletion of or a copy of personal information, or to object
        to or restrict certain processing. You may also be able to withdraw consent where processing
        relies on consent. Workspace users should first contact their organization’s administrator
        for requests relating to campaign or contact data that the organization controls.
      </p>
      <p>
        Account holders can manage some account and workspace information through the Service. For
        other requests, use the support contact provided in your workspace or customer agreement.
        We may need to verify your identity and may be unable to fulfill a request where an exception
        or legal obligation applies.
      </p>

      <h2>11. Cookies and similar technologies</h2>
      <p>
        The website or Service may use essential cookies or similar technologies to support sign-in,
        security, preferences and core functionality. If optional analytics or advertising
        technologies are used, the available controls and notices will be presented where required
        by law. You can manage cookies through your browser, although blocking essential cookies may
        affect sign-in or other features.
      </p>

      <h2>12. Children</h2>
      <p>
        The Service is intended for business use and is not designed for children. Do not create an
        account for a child or submit children’s personal information unless the feature and the
        applicable law expressly permit it and all required permissions have been obtained.
      </p>

      <h2>13. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy to reflect changes to the Service, our processing practices
        or legal requirements. We will update the effective date above and provide notice of material
        changes through the Service or another reasonable channel where required.
      </p>

      <h2>14. Contact</h2>
      <p>
        For questions or requests about this policy, use the support contact provided in your
        Foolioo workspace or customer agreement. The business operating Foolioo should make its
        legal identity and privacy contact available in the customer agreement or other official
        service materials.
      </p>
    </LegalPageShell>
  );
}
