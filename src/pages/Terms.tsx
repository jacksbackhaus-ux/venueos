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
          <p>That includes:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>everyone you or your managers give access to, and what they do in MiseOS;</li>
            <li>keeping Staff ID codes and PINs private, and not letting staff share them;</li>
            <li>shared or kitchen devices — making sure people sign out when they finish and that codes aren't written down or left on display;</li>
            <li>removing access promptly when someone leaves your business or no longer needs it; and</li>
            <li>all activity carried out under your account, including by connected apps you or your team set up.</li>
          </ul>
          <p>If you think someone has accessed your account without permission, or a code or password has been shared or lost, tell us promptly at <a className="underline" href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> and change or remove the affected access straight away.</p>
          <p>We aren't liable for loss caused by your failure to keep access to your account secure.</p>
        </Section>
        <Section title="4. Acceptable use">
          <p>Don't use MiseOS unlawfully, try to access other businesses' data, disrupt or probe the service without permission, or upload harmful content.</p>
        </Section>
        <Section title="5. Trial and subscription">
          <p>New businesses get a free trial. After that, access continues on a paid subscription at the prices shown on our <a className="underline" href="/landing#pricing">pricing page</a>. Subscriptions renew automatically until cancelled; after cancelling, you keep access until the end of the period you've paid for.</p>
        </Section>
        <Section title="6. Changes to these terms and our prices">
          <p><strong>Changes to the terms.</strong> We may update these terms from time to time. If a change is material, we'll give you at least 30 days' notice by email and/or in the app before it takes effect. If you keep using MiseOS after the change takes effect, you accept the updated terms. If you don't agree, you can cancel before the change takes effect.</p>
          <p><strong>Changes to prices.</strong> We'll give you at least 30 days' notice before a new price applies to you. The new price takes effect from your next billing period after that notice ends. If you don't want to pay the new price, you can cancel before it applies.</p>
          <p><strong>Changes that can happen sooner.</strong> Minor changes (such as fixing typos or clarifying wording), and changes needed for legal, regulatory or security reasons, may take effect sooner than 30 days. Where we can, we'll still tell you about them.</p>
        </Section>
        <Section title="7. Availability">
          <p>We aim to keep MiseOS available and to fix problems quickly, but we can't promise uninterrupted service. We may carry out maintenance and change features, and we'll tell you about significant changes.</p>
          <p><strong>Keep your own copies.</strong> We take reasonable steps to protect and back up your data, but you should regularly export your records and keep your own copies — especially before an inspection or audit. To the extent a loss of data could have been avoided if you had kept your own exports, we aren't liable for it. This doesn't limit our liability for breach of confidentiality (see section 12), or any liability the law doesn't allow us to limit or exclude.</p>
        </Section>
        <Section title="8. Your food safety responsibilities">
          <p>MiseOS helps you keep clear, consistent records. Your business stays legally responsible for food safety and for what those records say.</p>
          <p>MiseOS is a logging and record-keeping system. You are responsible for checking that your historical records and exports are accurate, and for correcting anything you find to be missing, incomplete or incorrect. We aren't responsible for records that are missing, incomplete or incorrect because of what you or your team did or didn't log.</p>
        </Section>
        <Section title="9. Guidance and AI content is not professional advice">
          <p>MiseOS includes guides, templates, FAQs, HACCP and Safer Food Better Business material, safe methods, insights, alerts, estimated scores and AI-generated content. These are general information to help you run your own food safety management system. They are not legal, food safety, regulatory or other professional advice, and they don't replace your own judgement, your local authority's advice, or advice from a qualified adviser.</p>
          <p>AI-generated content can be inaccurate or incomplete. You must check it before relying on it.</p>
          <p>Your business remains responsible for its food safety management system and for complying with the law.</p>
        </Section>
        <Section title="10. Your staff's data">
          <p>Your business is the controller of the personal data about your staff that is recorded in MiseOS. That includes special category health data, such as illness and fitness-to-work records. We process it as your processor under the Data Processing Addendum below.</p>
          <p>As controller, you are responsible for:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>having a lawful basis for recording each type of staff data, and an Article 9 UK GDPR condition for health data;</li>
            <li>telling your staff that their data is recorded in MiseOS — for example, in your own staff privacy notice;</li>
            <li>handling requests from your staff to exercise their data protection rights; and</li>
            <li>only recording what is necessary.</li>
          </ul>
          <p>We'll help you respond to staff requests as your processor, including through the export and anonymise tools in Settings.</p>
        </Section>
        <Section title="11. Third-party services">
          <p>Payments are processed by Stripe under Stripe's own terms.</p>
          <p>If you connect a third-party service to MiseOS — such as your own AI assistant through the MiseOS connector, or another integration — your use of that service is governed by that third party's terms and your agreement with them. Data you direct to a connected service is handled by that provider under your agreement with them, as described in our <a className="underline" href="/privacy">Privacy Notice</a>.</p>
          <p>We aren't responsible for the availability or accuracy of third-party services, or for how they handle data once you direct it to them. This doesn't affect our responsibility for the sub-processors we use to provide MiseOS, which are listed in our Privacy Notice.</p>
        </Section>
        <Section title="12. Liability">
          <p>Nothing in these terms limits our liability where the law doesn't allow it to be limited.</p>
          <p>Otherwise, we aren't liable for indirect or consequential loss, or loss of profit. And if you make a claim under these terms, our total liability to you is limited to the total subscription fees you paid us in the 12 months before the event the claim is about.</p>
          <p>That cap doesn't apply to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>death or personal injury caused by our negligence — the law doesn't allow this to be limited or excluded at all;</li>
            <li>our gross negligence; and</li>
            <li>breach of confidentiality — for example, mishandling your business's data.</li>
          </ul>
          <p>Separately, any estimated or predicted food hygiene score shown in MiseOS is indicative only. Actual inspection outcomes can vary based on factors the app doesn't track, and we can't guarantee any particular rating.</p>
        </Section>
        <Section title="13. Your indemnity to us">
          <p>You will indemnify {LEGAL.legalEntityName} against claims, losses and reasonable costs arising from:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>your unlawful or unauthorised use of MiseOS;</li>
            <li>content or data you upload that you had no right to upload, or that is unlawful;</li>
            <li>your breach of data protection law as controller, including failing to tell your staff that their data is recorded in MiseOS; and</li>
            <li>your breach of these terms.</li>
          </ul>
          <p>If we receive a claim this covers, we'll tell you promptly and let you have reasonable conduct of it.</p>
        </Section>
        <Section title="14. Events beyond our control">
          <p>Neither of us is liable for delay or failure to meet our obligations caused by events beyond our reasonable control. Examples include outages at hosting or infrastructure providers, internet or power failures, cyber attacks despite reasonable security, natural events, pandemics, government action and strikes.</p>
          <p>If this happens, the affected party will tell the other and take reasonable steps to minimise the effect. This doesn't excuse any obligation to pay fees that are due.</p>
          <p>If the event continues for more than 30 days, either of us can end the agreement by giving written notice.</p>
        </Section>
        <Section title="15. Ending the agreement">
          <p>You can cancel at any time from Account &amp; Billing. We may suspend or end access if you seriously breach these terms or don't pay.</p>
        </Section>
        <Section title="16. Law">
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
            <li><strong>End of contract:</strong> you can export your data at any time, including after the service ends. We keep your records for 7 years after the service ends, so you can re-export them and meet your own record-keeping duties, and to cover the limitation period for legal claims. After that we delete them. You can ask us to delete them sooner, unless the law requires us to keep them.</li>
            <li><strong>Information and audits:</strong> we'll make available the information needed to show we meet these obligations and allow for reasonable audits.</li>
            <li><strong>International transfers:</strong> we'll only transfer personal data outside the UK where UK adequacy regulations apply, or with the UK International Data Transfer Agreement or the UK Addendum to the EU Standard Contractual Clauses in place. The providers involved are listed in our <a className="underline" href="/privacy">Privacy Notice</a>.</li>
          </ol>
        </Section>
      </LegalPage>
    </>
  );
}
