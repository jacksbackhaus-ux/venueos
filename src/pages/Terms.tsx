// DRAFT CONTENT — factual/regulatory claims need Jack's review before publishing.
import { SEO } from "@/components/SEO";
import { LegalPage, Section, WhoWeAre } from "@/components/legal/LegalShell";
import { LEGAL } from "@/config/legal";

export default function Terms() {
  return (
    <>
      <SEO
        title="Terms of Service and Data Processing Addendum | MiseOS"
        description="The terms for using MiseOS, including our UK GDPR Data Processing Addendum."
        path="/terms"
      />
      <LegalPage
        title="Terms of Service"
        intro={<p>These terms apply when a business uses {LEGAL.tradingName}. By creating an account you agree to them on behalf of your business.</p>}
      >
        <Section title="1. Who we are">
          <WhoWeAre />
        </Section>
        <Section title="2. Business customers only">
          <p>MiseOS is for businesses, not consumers. You confirm you are acting for a business and have authority to accept these terms.</p>
        </Section>
        <Section title="3. Your account">
          <p>Keep sign-in details secure and give each person their own account with the lowest role they need. You are responsible for what happens under your account and for the people you invite.</p>
        </Section>
        <Section title="4. Acceptable use">
          <p>Don't use MiseOS unlawfully, try to access other businesses' data, disrupt or probe the service without permission, or upload harmful content.</p>
        </Section>
        <Section title="5. Trial and subscription">
          <p>New businesses get a free trial. After that, access continues on a paid subscription at the prices shown on our <a className="underline" href="/landing#pricing">pricing page</a>. Subscriptions renew automatically until cancelled; after cancelling, you keep access until the end of the period you've paid for.</p>
        </Section>
        <Section title="6. Availability">
          <p>We aim to keep MiseOS available and to fix problems quickly, but we can't promise uninterrupted service. We may carry out maintenance and change features, and we'll tell you about significant changes.</p>
        </Section>
        <Section title="7. Your food safety responsibilities">
          <p>MiseOS helps you keep clear, consistent records. Your business stays legally responsible for food safety and for what those records say.</p>
        </Section>
        <Section title="8. Liability">
          <p>Nothing limits liability that can't be limited by law. Otherwise, we aren't liable for indirect or consequential loss, or loss of profit, and our total liability in any 12 months is limited to the fees you paid in that period. [PLACEHOLDER – confirm liability cap with a solicitor]</p>
        </Section>
        <Section title="9. Ending the agreement">
          <p>You can cancel at any time from Account &amp; Billing. We may suspend or end access if you seriously breach these terms or don't pay.</p>
        </Section>
        <Section title="10. Law">
          <p>These terms are governed by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction.</p>
        </Section>

        <Section id="dpa" title="Data Processing Addendum">
          <p>This addendum applies where we process personal data for you as your processor (see our <a className="underline" href="/privacy">Privacy Notice</a>). It sets out the terms required by Article 28(3) UK GDPR.</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li><strong>Subject matter:</strong> providing MiseOS. The data covers your staff and people recorded in your food safety records, including health data in fitness-to-work records.</li>
            <li><strong>Instructions:</strong> we process personal data only on your documented instructions — these terms and your use of the service — unless the law requires otherwise, in which case we'll tell you if allowed.</li>
            <li><strong>Confidentiality:</strong> everyone we authorise to process the data is bound by confidentiality.</li>
            <li><strong>Security:</strong> we use appropriate technical and organisational measures, including encryption in transit, access controls that keep each business's data separate, role-based permissions and logging of access.</li>
            <li><strong>Sub-processors:</strong> you authorise the sub-processors listed on our <a className="underline" href="/privacy">Privacy Notice</a>. We'll give you notice of changes so you can object, and we'll put equivalent data protection terms in place with each one.</li>
            <li><strong>Data subject requests:</strong> we'll help you respond to people exercising their rights, including through the export and anonymise tools in Settings.</li>
            <li><strong>Security, breaches and DPIAs:</strong> we'll help you meet your obligations on security, breach notification, data protection impact assessments and prior consultation.</li>
            <li><strong>Breach notification:</strong> we'll tell you without undue delay after becoming aware of a personal data breach affecting your data.</li>
            <li><strong>End of contract:</strong> at the end of the service, we'll delete or return your personal data at your choice, unless the law requires us to keep it. [PLACEHOLDER – reconcile with the "records retained for 7 years" statement on the Account page]</li>
            <li><strong>Information and audits:</strong> we'll make available the information needed to show we meet these obligations and allow for reasonable audits.</li>
            <li><strong>International transfers:</strong> we'll only transfer personal data outside the UK with appropriate safeguards. [PLACEHOLDER – confirm safeguards]</li>
          </ol>
        </Section>
      </LegalPage>
    </>
  );
}
