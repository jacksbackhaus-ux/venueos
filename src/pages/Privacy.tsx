// DRAFT CONTENT — factual/regulatory claims need Jack's review before publishing.
import { SEO } from "@/components/SEO";
import { LegalPage, Section, Table, WhoWeAre } from "@/components/legal/LegalShell";
import { LEGAL } from "@/config/legal";

export default function Privacy() {
  const mail = <a className="underline" href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>;
  return (
    <>
      <SEO
        title="Privacy Notice | MiseOS"
        description="How MiseOS collects, uses and protects personal data under UK GDPR and the Data Protection Act 2018."
        path="/privacy"
      />
      <LegalPage
        title="Privacy Notice"
        intro={<p>This notice explains, in plain English, what personal data MiseOS handles, why, and what rights you have under UK GDPR and the Data Protection Act 2018.</p>}
      >
        <Section title="Who we are">
          <WhoWeAre />
        </Section>

        <Section title="Our two roles">
          <p><strong>We are the controller</strong> for your business account (the owner and managers who sign up with email), billing, and visitors to our website. We decide how that data is used.</p>
          <p><strong>We are the processor</strong> for the staff and operational data a business puts into MiseOS: team members, rotas, training, food safety checks and so on. The business is the controller of that data and decides why it is kept. We only handle it on the business's instructions, under our <a className="underline" href="/terms#dpa">Data Processing Addendum</a>.</p>
          <p>If you work for a business that uses MiseOS and want to ask about your data, please contact your employer first. We will help them respond.</p>
        </Section>

        <Section title="What we collect">
          <h3 className="font-semibold text-slate-900">Owners and managers</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Name, email address and password (the password is stored in scrambled form; we can't read it)</li>
            <li>Business name, site names and addresses, premises type and council registration details</li>
            <li>Subscription and billing history. Card details are handled by Stripe and never reach MiseOS.</li>
            <li>Settings you choose, such as notification preferences and connected AI apps</li>
          </ul>
          <h3 className="font-semibold text-slate-900">Staff (entered by the business)</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Name, optional email address and Staff ID</li>
            <li>Roles and which sites they work at</li>
            <li>Rota shifts, availability, holiday requests, shift swaps and timesheets</li>
            <li>Hourly rate, where the business enters one</li>
            <li>Training records and uploaded certificates</li>
            <li>Messages sent in the team messenger</li>
            <li>Fitness-to-work (illness) records — see below</li>
            <li>The name recorded on each food safety check they complete (temperatures, cleaning, deliveries, day sheets, batches, incidents and similar)</li>
          </ul>
          <h3 className="font-semibold text-slate-900">Website visitors</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Technical information your browser sends when loading a page, such as your IP address</li>
            <li>Anything you type into a form, such as sign-up details or feedback</li>
          </ul>
        </Section>

        <Section title="Health information (fitness to work)">
          <p>Food businesses must keep anyone with vomiting or diarrhoea away from food until they have been symptom-free for 48 hours. MiseOS lets a business record this: the person's name, symptoms, the date they were excluded and the date they were cleared to return.</p>
          <p>This is health data, which the law treats as special category data. The business is the controller and is responsible for having a lawful basis and condition for recording it — typically its legal duties as an employer and food business operator.</p>
          <p>Only the business's managers and owners can see these records. They are kept for as long as the business keeps its food safety records: [PLACEHOLDER – confirm retention period for fitness-to-work records].</p>
        </Section>

        <Section title="Why we use data (lawful bases)">
          <Table
            head={["What we do", "Lawful basis"]}
            rows={[
              ["Run your account and provide the service", "Contract"],
              ["Take payments and keep billing records", "Contract; legal obligation (tax records)"],
              ["Send service emails (sign-in links, trial reminders, billing notices)", "Contract; legitimate interests"],
              ["Keep the service secure and prevent misuse", "Legitimate interests"],
              ["Process staff and food safety data for a business", "The business's own basis — we act on its instructions"],
              ["Answer questions and support requests", "Legitimate interests"],
            ]}
          />
        </Section>

        <Section title="AI features">
          <p>Some optional features send data to an AI service to produce a suggestion or summary. They only run when a business uses them.</p>
          <Table
            head={["Feature", "Sent to", "What is sent"]}
            rows={[
              ["Rota suggestions", "Anthropic (Claude)", "Staff names, roles, availability, holidays and past shifts for the site"],
              ["Morning briefing", "Anthropic (Claude)", "Recent temperatures, cleaning, day sheets, incidents, waste and the day's rota, which can include staff names"],
              ["Compliance write-up", "Anthropic (Claude)", "Food safety records for the period, such as checks, deliveries, pest and maintenance logs and incidents"],
              ["Equipment drift check", "Anthropic (Claude)", "Temperature readings and fridge/freezer details"],
              ["Margin alert", "Anthropic (Claude)", "Recipe cost and pricing figures"],
              ["Sales insights, sales matching, cashflow insights", "Google Gemini, via the Lovable AI service", "Sales line items, product names, overheads and cashflow figures"],
            ]}
          />
        </Section>

        <Section title="Connected apps (AI assistants)">
          <p>A business can connect its own AI assistant, such as Claude or ChatGPT, in Settings › Connected Apps. The assistant signs in as a named person and can only see and do what that person already can. Anything the assistant reads is shared with that AI provider at the business's direction, under the business's own agreement with that provider. Every assistant action is logged against the person who connected it.</p>
        </Section>

        <Section title="Who we share data with (sub-processors)">
          <Table
            head={["Provider", "What for"]}
            rows={[
              ["Lovable Cloud (with Supabase)", "Hosting, database, sign-in and file storage"],
              ["Stripe", "Payments and subscriptions"],
              ["Anthropic", "AI features listed above"],
              ["Lovable AI service (Google Gemini)", "AI features listed above"],
              ["Lovable email service", "Sending service emails from notify.mise-os.app"],
              ["Google Fonts", "Loading the typeface on our pages"],
            ]}
          />
          <p>Hosting region and international transfer safeguards: [PLACEHOLDER – confirm hosting region and the safeguards (e.g. UK IDTA / Addendum to EU SCCs) used for each provider outside the UK].</p>
          <p>We don't sell personal data.</p>
        </Section>

        <Section title="How long we keep data">
          <ul className="list-disc pl-5 space-y-1">
            <li>After a subscription is cancelled, records are retained for 7 years so the business can re-export them.</li>
            <li>Billing records: [PLACEHOLDER – confirm period].</li>
            <li>Email delivery logs and website technical data: [PLACEHOLDER – confirm period].</li>
          </ul>
        </Section>

        <Section title="What deleting an account actually does">
          <p>When a person's account is anonymised, their name on their profile is replaced with "Former staff member", their email and Staff ID are removed, and they can no longer sign in.</p>
          <p>Food safety records they completed are <strong>kept</strong>, including the name recorded at the time, because the business is required to keep those records. Screens that look the name up live (for example training records, rota history and timesheets) will show "Former staff member" from then on. We do not claim that everything is erased.</p>
        </Section>

        <Section title="Your rights">
          <p>You have the right to access your data, have it corrected, have it erased, restrict or object to how it's used, and receive it in a portable format. Some rights are limited where a business must keep records by law.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Owners and managers:</strong> use Settings › Account › Data &amp; Privacy, or email {mail}.</li>
            <li><strong>Staff:</strong> ask your employer first. They can export your data for you, and we will help them.</li>
          </ul>
          <p>You can also complain to the Information Commissioner's Office at <a className="underline" href="https://ico.org.uk" target="_blank" rel="noreferrer">ico.org.uk</a>. We'd appreciate the chance to put things right first.</p>
        </Section>

        <Section id="cookies" title="Cookies and storage on your device">
          <p>MiseOS stores a few small items on your device to make the app work or to remember your choices. We don't use advertising or analytics cookies.</p>
          <Table
            head={["What", "Purpose", "How long", "Type"]}
            rows={[
              ["Sign-in session", "Keeps you signed in", "Until you sign out or it expires", "Essential"],
              ["Staff ID session", "Keeps a Staff ID sign-in on a shared device", "Until sign-out", "Essential"],
              ["Chosen site", "Remembers which site you're working in", "Until changed or cleared", "Essential"],
              ["Where to go after sign-in", "Returns you to the right page", "Until replaced", "Essential"],
              ["Support access session", "Marks when MiseOS support is viewing an account with permission", "Until the session ends", "Essential"],
              ["Pricing selections", "Keeps your choices while you check out", "This browser tab only", "Essential"],
              ["Offline queue (device storage)", "Holds checks recorded without signal until they're sent", "Until sent", "Essential"],
              ["Offline page cache", "Lets screens open without signal", "Until the app updates", "Essential"],
              ["Push notification subscription", "Delivers notifications you turned on", "Until you turn them off", "Essential"],
              ["Stripe checkout cookies", "Fraud prevention during payment (set by Stripe)", "Set by Stripe", "Essential"],
              ["Sidebar open/closed", "Remembers your layout", "Until cleared", "Preference"],
              ["Messenger notice seen", "Stops the same notice reappearing", "Until cleared", "Preference"],
              ["Dismissed prompts", "Stops setup prompts reappearing", "Until cleared", "Preference"],
            ]}
          />
          <p>Our pages load a typeface from Google Fonts. This sets no cookies, but your browser sends your IP address to Google when it downloads the font.</p>
          <p>We only use storage that is strictly necessary or that remembers your appearance and functionality preferences, so no cookie banner is needed.</p>
        </Section>

        <Section title="Changes">
          <p>We'll update this page when things change and show the date at the top.</p>
        </Section>
      </LegalPage>
    </>
  );
}
