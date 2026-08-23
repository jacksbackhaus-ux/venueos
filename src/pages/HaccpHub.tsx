import { Helmet } from "react-helmet-async";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import miseosLogo from "@/assets/miseos-logo.png";

const BRAND_SAGE = "#3d8a6a";
const PATH = "/haccp";
const URL = `https://mise-os.app${PATH}`;
const TITLE = "What is HACCP? A Complete Guide for UK Food Businesses";
const DESCRIPTION =
  "What HACCP stands for, what a critical control point is, the 7 principles of HACCP, and how to write a HACCP plan in the UK. Plain-English reference guide.";
const PUBLISHED = "2026-08-23";
const MODIFIED = "2026-08-23";
const LAST_UPDATED_LABEL = "23 August 2026";

const principles: { name: string; body: string }[] = [
  {
    name: "Conduct a hazard analysis",
    body:
      "identify the biological, chemical, physical and allergenic hazards that could occur at each stage of your food process, from delivery through to service.",
  },
  {
    name: "Identify the critical control points",
    body:
      "decide the specific steps where control is essential to prevent, eliminate or reduce a food safety hazard to a safe level, such as cooking or chilling.",
  },
  {
    name: "Set critical limits",
    body:
      "define the measurable limit that separates safe from unsafe at each critical control point, for example a core cooking temperature of 75°C or a fridge running at 5°C or below.",
  },
  {
    name: "Establish monitoring procedures",
    body:
      "state how, how often and by whom each critical limit is checked, such as probing cooked food at the end of every batch and recording fridge temperatures twice a day.",
  },
  {
    name: "Establish corrective actions",
    body:
      "decide in advance what happens when a critical limit is not met, for example continuing to cook food that has not reached temperature, or discarding stock from a fridge that failed overnight.",
  },
  {
    name: "Establish verification procedures",
    body:
      "check that the system itself works, by calibrating probes, reviewing records for gaps, and confirming that staff follow the written procedures in practice.",
  },
  {
    name: "Establish record keeping and documentation",
    body:
      "keep dated records of monitoring, corrective actions, verification and reviews, so a food safety officer can see the system is being followed.",
  },
];

const howToSteps: { name: string; body: string }[] = [
  {
    name: "Describe your food business and products",
    body:
      "Write down what your business makes and sells, who eats it, and how it reaches them. A HACCP plan must reflect the real products, equipment and premises, so record shelf life, whether food is served hot or cold, and whether any customers are vulnerable groups such as children or care-home residents.",
  },
  {
    name: "Map every step of your process",
    body:
      "List each stage food passes through in your business, in order: delivery, storage, preparation, cooking, cooling, hot holding, chilled display, packing, and service or transport. A simple written flow of steps is enough for a small food business, and it becomes the backbone of the whole HACCP plan.",
  },
  {
    name: "Identify the hazards at each step",
    body:
      "Against each step, note what could make food unsafe: bacterial growth, survival of bacteria after cooking, cross-contamination from raw food, allergen contact, chemical contamination from cleaning products, or physical contamination such as glass or metal.",
  },
  {
    name: "Decide which steps are critical control points",
    body:
      "Pick out the steps where control is essential because no later step will remove the hazard. In most small UK food businesses these are cooking, chilling and cold storage, hot holding, reheating and allergen separation.",
  },
  {
    name: "Set a critical limit for each critical control point",
    body:
      "Give every critical control point a measurable limit that a member of staff can check without judgement, such as cooking to 75°C in the thickest part, chilling from 63°C to 8°C within 90 minutes, holding hot food at 63°C or above, and keeping fridges at 5°C or below.",
  },
  {
    name: "Write the monitoring and corrective action for each limit",
    body:
      "For each critical limit, record who checks it, how, how often, and what they do when the limit is missed. Written corrective actions matter as much as the checks themselves, because they show a food safety officer that failures are handled rather than ignored.",
  },
  {
    name: "Keep records and review the plan",
    body:
      "Keep dated records of the checks, failures and corrective actions, and review the plan whenever your menu, equipment, suppliers or premises change, and at least once a year. Record who carried out the review and what was changed.",
  },
];

const faqs: { q: string; a: string }[] = [
  {
    q: "Do I legally need a HACCP plan for my food business?",
    a: "Yes. UK food hygiene law requires every food business to put in place, implement and maintain permanent procedures based on HACCP principles. The procedures must be documented and proportionate to the business, so a small café needs far less paperwork than a manufacturer, but it still needs written procedures and records.",
  },
  {
    q: "What's the difference between HACCP and Safer Food Better Business (SFBB)?",
    a: "HACCP is the internationally recognised method for controlling food safety hazards. Safer Food, Better Business is a free Food Standards Agency pack that turns HACCP principles into ready-made safe methods and a daily diary for small UK caterers and retailers. Completing SFBB properly satisfies the legal requirement for HACCP-based procedures.",
  },
  {
    q: "Can a small bakery or home kitchen write its own HACCP plan?",
    a: "Yes. No qualification or consultant is legally required to write a HACCP plan. A small bakery or registered home kitchen can complete Safer Food, Better Business or write a short plan covering its own steps, limits, checks and corrective actions. Level 2 food hygiene training helps, and local authority food teams will often advise.",
  },
  {
    q: "What happens if I don't have a documented HACCP plan during an inspection?",
    a: "A missing food safety management system usually results in a low Food Hygiene Rating score for confidence in management, which is the area weighted most heavily. Officers can issue improvement notices, require the plan within a set timescale, and revisit. Repeated failure to produce documented procedures can lead to prosecution.",
  },
  {
    q: "How often should a HACCP plan be reviewed?",
    a: "Review a HACCP plan at least once a year, and immediately whenever something changes: a new menu item, new supplier, new equipment, new premises, a change in staff responsibilities, or after a food complaint or safety incident. Record the date of each review and what was changed.",
  },
  {
    q: "What are the 7 principles of HACCP?",
    a: "The seven principles are: conduct a hazard analysis, identify the critical control points, set critical limits, establish monitoring procedures, establish corrective actions, establish verification procedures, and establish record keeping and documentation. Together they describe how a food business identifies hazards, controls them, and proves the controls work.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": `${URL}#article`,
      headline: TITLE,
      description: DESCRIPTION,
      datePublished: PUBLISHED,
      dateModified: MODIFIED,
      inLanguage: "en-GB",
      mainEntityOfPage: { "@type": "WebPage", "@id": URL },
      author: { "@id": "https://mise-os.app/#organization" },
      publisher: { "@id": "https://mise-os.app/#organization" },
    },
    {
      "@type": "HowTo",
      "@id": `${URL}#howto`,
      name: "How to write a HACCP plan (in 7 steps)",
      description:
        "How a UK food business writes a HACCP plan: describe the business, map the process, identify hazards, choose critical control points, set critical limits, define monitoring and corrective actions, then keep records and review.",
      inLanguage: "en-GB",
      step: howToSteps.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.name,
        text: `${s.name}. ${s.body}`,
      })),
    },
    {
      "@type": "FAQPage",
      "@id": `${URL}#faq`,
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl md:text-3xl font-bold text-slate-900 mt-14 mb-4 scroll-mt-24">
      {children}
    </h2>
  );
}

export default function HaccpHub() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SEO title={TITLE} description={DESCRIPTION} path={PATH} type="article" />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <header className="border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 h-20 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <img src={miseosLogo} alt="MiseOS — digital HACCP software for UK food businesses" className="h-10 w-auto" />
            <span className="text-xl font-bold tracking-tight">MiseOS</span>
          </a>
          <a href="/#how" className="text-sm text-slate-600 hover:text-slate-900">
            How MiseOS works
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        <article>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight">
            What is HACCP? A Complete Guide for UK Food Businesses
          </h1>
          <p className="mt-3 text-sm text-slate-500">Last updated: {LAST_UPDATED_LABEL}</p>
          <p className="mt-6 text-lg text-slate-700 leading-relaxed">
            A plain-English reference guide to HACCP for UK food businesses: what the term means, what a critical
            control point is, the seven principles, how to write a HACCP plan, and how HACCP relates to Safer Food,
            Better Business.
          </p>

          <nav aria-label="On this page" className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-900">On this page</p>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              <li><a className="hover:text-slate-900 underline" href="#what-is-haccp">What is HACCP?</a></li>
              <li><a className="hover:text-slate-900 underline" href="#what-does-haccp-stand-for">What does HACCP stand for?</a></li>
              <li><a className="hover:text-slate-900 underline" href="#critical-control-point">What is a critical control point?</a></li>
              <li><a className="hover:text-slate-900 underline" href="#seven-principles">The 7 principles of HACCP</a></li>
              <li><a className="hover:text-slate-900 underline" href="#write-a-haccp-plan">How to write a HACCP plan (in 7 steps)</a></li>
              <li><a className="hover:text-slate-900 underline" href="#legal-requirement">Is HACCP a legal requirement in the UK?</a></li>
              <li><a className="hover:text-slate-900 underline" href="#haccp-vs-sfbb">Does HACCP replace Safer Food Better Business (SFBB)?</a></li>
              <li><a className="hover:text-slate-900 underline" href="#faq">Frequently asked questions</a></li>
            </ul>
          </nav>

          <div className="prose-none text-slate-700 leading-relaxed">
            <H2 id="what-is-haccp">What is HACCP?</H2>
            <p>
              HACCP is a systematic method of managing food safety by identifying the hazards in a food process and
              controlling them at the steps where control matters most. A HACCP system records what could make food
              unsafe, the limits that keep it safe, the checks that prove those limits are met, and the action taken
              when they are not.
            </p>
            <p className="mt-4">
              HACCP applies to every kind of food business, from a home baker to a factory, and is scaled to the risk
              involved. In UK small food businesses, a HACCP system usually consists of a short written plan plus daily
              records of temperatures, cleaning, deliveries and corrective actions.
            </p>

            <H2 id="what-does-haccp-stand-for">What does HACCP stand for?</H2>
            <p>
              HACCP stands for Hazard Analysis and Critical Control Points. The term is pronounced "hassup" and is used
              worldwide as the basis of food safety management. UK food hygiene law requires food businesses to operate
              procedures based on HACCP principles.
            </p>

            <H2 id="critical-control-point">What is a critical control point?</H2>
            <p>
              A critical control point is a step in a food process where control is essential to prevent, eliminate or
              reduce a food safety hazard to a safe level, and where no later step will fix the problem. Cooking is a
              typical critical control point in a small food business: a burger cooked to 75°C in the centre is safe,
              while an undercooked burger cannot be made safe once it is served.
            </p>
            <p className="mt-4">
              Chilling is another common critical control point. Cooked food cooled slowly at room temperature allows
              bacteria to multiply, so a bakery cooling a large batch of filled pastries sets a limit — for example
              chilled from hot to 8°C or below within 90 minutes — and records the result.
            </p>

            <H2 id="seven-principles">The 7 principles of HACCP</H2>
            <p>
              The seven principles of HACCP describe how a food business identifies hazards, controls them, and proves
              the controls work. Each principle below is a standalone statement of what that principle requires.
            </p>
            <ol className="mt-5 list-decimal pl-6 space-y-3">
              {principles.map((p) => (
                <li key={p.name} className="pl-1">
                  <span className="font-semibold text-slate-900">{p.name}.</span> {p.body}
                </li>
              ))}
            </ol>

            <H2 id="write-a-haccp-plan">How to write a HACCP plan (in 7 steps)</H2>
            <p>
              A HACCP plan is written by describing the business, mapping the food process, identifying hazards,
              choosing the critical control points, setting measurable limits, defining monitoring and corrective
              actions, and keeping dated records. The seven steps below can be completed by the owner of a small food
              business without outside help.
            </p>
            <ol className="mt-5 list-decimal pl-6 space-y-4">
              {howToSteps.map((s) => (
                <li key={s.name} className="pl-1">
                  <span className="font-semibold text-slate-900">{s.name}.</span> {s.body}
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm text-slate-600">
              For a worked example in a bakery setting, read the{" "}
              <a className="underline hover:text-slate-900" href="/guides/bakery-haccp-compliance">
                HACCP compliance guide for UK bakeries
              </a>
              .
            </p>

            <H2 id="legal-requirement">Is HACCP a legal requirement in the UK?</H2>
            <p>
              Yes — UK food hygiene law requires all food businesses to put in place, implement and maintain permanent
              procedures based on HACCP principles. The requirement comes from Regulation (EC) 852/2004 as retained in
              UK law, applied through the Food Safety and Hygiene (England) Regulations 2013 and equivalent regulations
              in Scotland, Wales and Northern Ireland. The procedures must be documented, kept up to date, and
              proportionate to the size and nature of the business.
            </p>

            <H2 id="haccp-vs-sfbb">Does HACCP replace Safer Food Better Business (SFBB)?</H2>
            <p>
              No — Safer Food, Better Business is a way of meeting the HACCP requirement, not an alternative to it. The
              Food Standards Agency designed the SFBB pack so that small caterers and retailers can satisfy HACCP
              principles using ready-made safe methods and a daily diary instead of writing a bespoke plan. Businesses
              with more complex processes, such as sous-vide, cook-chill, vacuum packing or extended shelf life, usually
              need a tailored HACCP plan alongside or instead of SFBB.
            </p>
            <p className="mt-4 text-sm text-slate-600">
              For a detailed walkthrough of the pack, read the{" "}
              <a className="underline hover:text-slate-900" href="/guides/sfbb-caterers-compliance">
                Safer Food, Better Business guide for caterers
              </a>
              .
            </p>

            <H2 id="faq">Frequently asked questions</H2>
            <div className="mt-5 space-y-4">
              {faqs.map((f) => (
                <div key={f.q} className="rounded-lg border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900">{f.q}</h3>
                  <p className="mt-2 text-slate-700">{f.a}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm text-slate-600">
              More questions about pricing, offline logging and multi-site records are answered on the{" "}
              <a className="underline hover:text-slate-900" href="/#faq">
                MiseOS common questions section
              </a>
              .
            </p>
          </div>

          <section className="mt-16 rounded-xl border border-slate-200 bg-slate-50 p-7">
            <h2 className="text-2xl font-bold text-slate-900">Managing HACCP digitally</h2>
            <p className="mt-3 text-slate-700 leading-relaxed">
              MiseOS helps UK food businesses build, maintain, and evidence their HACCP plan digitally — including
              temperature logs, cleaning records, and Environmental Health Officer inspection packs.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/#how">
                <Button variant="outline">See how it works</Button>
              </a>
              <a href="/auth?mode=signup">
                <Button style={{ backgroundColor: BRAND_SAGE }} className="text-white hover:opacity-90">
                  Start free trial <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </a>
            </div>
          </section>
        </article>
      </main>

      <footer className="border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-10 flex flex-col md:flex-row gap-4 items-center justify-between text-sm text-slate-500">
          <span>© {new Date().getFullYear()} MiseOS · Built for UK food businesses</span>
          <div className="flex flex-wrap gap-5">
            <a className="hover:text-slate-900" href="/#how">How it works</a>
            <a className="hover:text-slate-900" href="/#pricing">Pricing</a>
            <a className="hover:text-slate-900" href="/#faq">FAQ</a>
            <a className="hover:text-slate-900" href="/guides/bakery-haccp-compliance">HACCP guide for bakeries</a>
            <a className="hover:text-slate-900" href="/guides/sfbb-caterers-compliance">SFBB for caterers</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
