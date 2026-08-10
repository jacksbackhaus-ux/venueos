import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import miseosLogo from "@/assets/miseos-logo.png";

const BRAND_SAGE = "#3d8a6a";
const PATH = "/guides/sfbb-caterers-compliance";
const URL = `https://mise-os.app${PATH}`;
const TITLE = "Safer Food Better Business for Caterers: 2026 UK Compliance Guide";
const DESCRIPTION =
  "A practical guide to Safer Food, Better Business for caterers: SFBB safe methods, diary records, inspection prep and how MiseOS digitises compliance.";

const faqs = [
  {
    q: "What is Safer Food, Better Business for caterers?",
    a: "It is the Food Standards Agency's free food safety management pack for caterers and retailers. It turns the legal requirement for HACCP-based procedures into a set of safe methods, a daily diary, opening and closing checks, and periodic review records. A completed pack is the documented system most small UK caterers need.",
  },
  {
    q: "Do caterers legally need SFBB, or can they use their own HACCP plan?",
    a: "You need a documented food safety management system based on HACCP principles. For most small caterers, the SFBB pack is the simplest accepted route. If you have complex processes — sous-vide, cook-chill, vacuum packing, extended shelf life, large-scale off-site catering — you may need a bespoke HACCP plan written around those specific steps.",
  },
  {
    q: "How does the SFBB diary differ from the safe methods?",
    a: "Safe methods are the written rules: how you control cross-contamination, chilling, cooking, cleaning, allergens and so on. The diary is the daily evidence that you followed them. You record temperatures, deliveries, cleaning, checks, problems and corrective actions. Both are needed; the diary proves the methods are real, not just paperwork.",
  },
  {
    q: "What records do EHOs ask caterers for during an inspection?",
    a: "Typically: completed safe methods, daily diary sheets, opening and closing checks, temperature logs, cleaning records, supplier and delivery checks, staff training and fitness-to-work records, probe calibration, allergen information, incident and corrective action logs, and four-weekly and annual review records.",
  },
  {
    q: "How often do I need to review the SFBB pack?",
    a: "The SFBB guidance asks you to do a four-weekly review of your records and safe methods, and an annual review of the whole system. You must also review whenever something changes: a new menu, new supplier, new equipment, new premises, or after a food complaint or incident.",
  },
  {
    q: "Can I run SFBB records on paper?",
    a: "Yes, paper is legal. The difficulty is retrieval: an inspector asking for last month's temperature records, or a customer asking for allergen information mid-service, is where paper falls short. Digital records make the same evidence searchable, exportable and harder to lose.",
  },
  {
    q: "Does MiseOS replace the SFBB pack?",
    a: "MiseOS digitises the records SFBB asks you to keep. You can complete every safe method in the app, or upload a finished SFBB pack as your documented system. The daily diary, checks, reviews, temperature logs and corrective actions become prompts on your phone, then one EHO-ready export.",
  },
];

const steps = [
  {
    n: "1",
    t: "Choose your system route: in-app or upload",
    b: "Decide whether you will complete each SFBB safe method inside MiseOS, or upload your already-completed FSA pack. Both give you a documented system. The right choice depends on whether you already have a paper pack you are happy with, or are starting from scratch.",
  },
  {
    n: "2",
    t: "Work through the safe methods that match your business",
    b: "Not every method applies in the same way. A sandwich shop, a hot-food caterer and a mobile coffee van have different risks. Answer each prompt honestly: how do you handle cross-contamination, chilling, cooking, cleaning, allergens, suppliers, staff training and complaints? Skip only what is genuinely not relevant.",
  },
  {
    n: "3",
    t: "Set up daily opening and closing checks",
    b: "Turn your safe methods into a checklist the team can sign off at the start and end of each day. Include fridge and freezer temperatures, handwashing and sanitiser, cleanliness of surfaces, equipment condition, pest signs, and whether anything needs fixing before service starts.",
  },
  {
    n: "4",
    t: "Keep a daily diary of checks and corrective actions",
    b: "Record cooking, hot holding, cooling, reheating and delivery checks as you work. When something is outside the limit, log what you did: the product moved, discarded or reheated, the equipment repaired, the supervisor informed. An honest missed check with a note is better than a fabricated perfect record.",
  },
  {
    n: "5",
    t: "Run the four-weekly and annual reviews",
    b: "Look back over the period for repeated problems, missing records, new allergens, new suppliers or equipment changes. Update any safe method affected. Then do a full annual review to confirm the whole system still reflects what you actually do.",
  },
];

const risks = [
  {
    t: "Cross-contamination in small kitchens",
    b: "Caterers often prepare raw and ready-to-eat food in the same compact space, using shared fridges, prep boards and utensils. Without clear controls, raw meat juices, allergens and cleaning chemicals can reach food that will not be cooked again.",
    c: [
      "Use colour-coded boards, knives and cloths for raw, ready-to-eat and allergen-free work",
      "Store raw food below ready-to-eat food in every fridge and chiller",
      "Clean and disinfect prep areas between tasks, not just at the end of the day",
      "Schedule high-risk allergen prep in a separate time slot or area",
      "Train staff to treat 'gluten-free' or 'nut-free' claims as a serious cross-contamination risk",
    ],
  },
  {
    t: "Temperature control during cooking, cooling and holding",
    b: "The biggest microbiological risks in catering are undercooking, slow cooling of large batches, and hot or cold holding outside safe limits. Buffets, service counters and off-site events make this harder because food is outside controlled kitchens for long periods.",
    c: [
      "Check core cooking temperatures with a calibrated probe every batch",
      "Cool food in shallow trays quickly, then chill below 8°C within the safe time window",
      "Hold hot food at 63°C or above, and cold food at 8°C or below",
      "Log hot- and cold-holding checks during service and events",
      "Never leave high-risk food in the temperature danger zone longer than the safe limit",
    ],
  },
  {
    t: "Allergen management and customer information",
    b: "Caterers handle all 14 regulated allergens and must give accurate information to customers. Pre-packed-for-direct-sale foods need full PPDS labels under Natasha's Law. Loose food and menus must have allergen information available and up to date.",
    c: [
      "Keep an ingredient and allergen list for every dish, sauce, dressing and garnish",
      "Update allergen information every time a recipe, supplier or ingredient changes",
      "Label prep containers and buffet dishes clearly, even in the kitchen",
      "Train front-of-house staff to say 'let me check' and never guess",
      "Use PPDS labels for anything packed on site for direct sale",
    ],
  },
  {
    t: "Cleaning and disinfection",
    b: "A busy kitchen needs more than a wipe-down. Two-stage cleaning — remove dirt, then disinfect with the right contact time and dilution — is the foundation of food safety. Missed schedules, wrong chemicals or reused dirty cloths are common inspection failures.",
    c: [
      "Use a scheduled cleaning programme: daily, weekly, monthly and deep-clean tasks",
      "Follow two-stage clean for food contact surfaces and equipment",
      "Check disinfectant contact time and replace cloths and sponges regularly",
      "Record completion and any equipment or areas that need repair",
      "Keep cleaning chemicals away from food and clearly labelled",
    ],
  },
  {
    t: "Off-site catering, events and mobile units",
    b: "Serving away from your main kitchen introduces new risks: transport temperature, power for fridges, handwashing, allergen queries and traceability. The same SFBB principles apply, but the controls must be practical at a temporary site.",
    c: [
      "Transport high-risk food in insulated boxes or refrigerated vehicles with temperature logs",
      "Set up a handwashing station, or use sanitiser only where handwashing is not practical",
      "Keep raw and ready-to-eat foods separate during transport and service",
      "Record batch codes and use-by dates for food taken off-site",
      "Have a plan for leftovers, waste and emergency temperature failures",
    ],
  },
];

const automation = [
  { t: "SFBB safe methods in the app", b: "Complete every safe method in MiseOS, or upload your finished FSA pack — both count as your documented food safety management system." },
  { t: "Digital daily diary", b: "Opening and closing checks, temperature logs, delivery checks and corrective actions are turned into prompts the team can tap through on a phone." },
  { t: "Temperature logs with limits", b: "Cooking, hot holding, cooling and fridge checks compare against your own limits and flag a corrective action when something is out of range." },
  { t: "Allergen recipes and PPDS labels", b: "Hold ingredients and allergens per recipe and produce compliant PPDS labels for anything packed on site for direct sale." },
  { t: "Cleaning, pest, PPM and training", b: "Scheduled cleaning with completion records, pest checks, maintenance tasks and staff training evidence in one place." },
  { t: "Inspection pack export", b: "One EHO-ready PDF or Excel export pulling together your plan, daily records, reviews and corrective actions." },
];

export default function SfbbCaterersGuide() {
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: DESCRIPTION,
    inLanguage: "en-GB",
    mainEntityOfPage: { "@type": "WebPage", "@id": URL },
    author: { "@type": "Organization", name: "MiseOS", url: "https://mise-os.app" },
    publisher: { "@type": "Organization", name: "MiseOS", url: "https://mise-os.app" },
    about: "Safer Food, Better Business for caterers in the United Kingdom",
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://mise-os.app/" },
      { "@type": "ListItem", position: 2, name: "Guides", item: "https://mise-os.app/guides" },
      { "@type": "ListItem", position: 3, name: TITLE, item: URL },
    ],
  };

  return (
    <div className="min-h-screen bg-white">
      <SEO title={TITLE} description={DESCRIPTION} path={PATH} type="article" />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(articleLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
      </Helmet>

      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-2.5">
            <img src={miseosLogo} alt="MiseOS — digital HACCP software for UK food businesses" className="h-8 w-auto" />
            <span className="text-lg font-bold text-slate-900 tracking-tight">MiseOS</span>
          </Link>
          <a href="/auth?mode=signup">
            <Button size="sm" style={{ backgroundColor: BRAND_SAGE }} className="text-white hover:opacity-90">
              Start free trial
            </Button>
          </a>
        </div>
      </header>

      <main>
        <article className="max-w-3xl mx-auto px-4 py-10 md:py-14">
          <nav aria-label="Breadcrumb" className="text-xs text-slate-500 mb-4">
            <Link to="/landing" className="hover:text-slate-900">Home</Link>
            <span className="mx-1.5">/</span>
            <span>Guides</span>
          </nav>

          <h1 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Safer Food Better Business for Caterers: 2026 UK Compliance Guide
          </h1>
          <p className="mt-4 text-lg text-slate-600 leading-relaxed">
            A practical guide to completing the FSA's Safer Food, Better Business pack for caterers,
            cafés, sandwich bars, mobile food units and small restaurants. Build a daily diary and
            safe-method system that holds up on inspection day.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            General guidance for UK food businesses, not legal advice. Always check current FSA
            guidance and speak to your local authority environmental health team about your premises.
          </p>

          <Card className="mt-8 p-5 bg-slate-50 border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">On this page</h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {[
                ["what-is-sfbb", "What is Safer Food, Better Business?"],
                ["what-the-law-requires", "What the law requires"],
                ["sfbb-or-haccp", "SFBB or full HACCP?"],
                ["complete-sfbb", "How to complete the pack step by step"],
                ["caterer-risks", "The five caterer risks that fail inspections"],
                ["records", "Records an EHO will ask for"],
                ["how-miseos-helps", "How MiseOS digitises this"],
                ["faq", "SFBB questions"],
              ].map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-slate-700 hover:text-slate-900 underline underline-offset-4 decoration-slate-300">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </Card>

          <section id="what-is-sfbb" className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-bold text-slate-900">What is Safer Food, Better Business?</h2>
            <div className="mt-4 space-y-4 text-slate-700 leading-relaxed">
              <p>
                Safer Food, Better Business (SFBB) is the Food Standards Agency's free food safety
                management system for small caterers and retailers. It is designed to meet the legal
                requirement for HACCP-based procedures without writing a full bespoke plan from scratch.
              </p>
              <p>
                The pack contains a set of safe methods, a daily diary, opening and closing checks, and
                review sheets. For a small caterer, completing it properly gives you a documented system
                that an Environmental Health Officer will recognise and accept.
              </p>
              <p>
                MiseOS digitises the diary and safe-method records, so the same daily checks live on your
                phone and export into an EHO-ready pack in one click.
              </p>
            </div>
          </section>

          <section id="what-the-law-requires" className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-bold text-slate-900">What the law requires</h2>
            <div className="mt-4 space-y-4 text-slate-700 leading-relaxed">
              <p>
                Every UK food business must have food safety management procedures based on HACCP
                principles, keep them in writing, follow them and keep them up to date. This comes from
                Regulation (EC) 852/2004 as retained in UK law, and the Food Safety and Hygiene
                (England) Regulations 2013 and their equivalents in Scotland, Wales and Northern
                Ireland.
              </p>
              <p>
                For caterers specifically, the law also requires:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Accurate allergen information for the 14 regulated allergens, available to customers before purchase.</li>
                <li>PPDS labels for food packed on site for direct sale, with full ingredients and allergens emphasised.</li>
                <li>Traceability records showing where ingredients came from and where finished products went.</li>
                <li>Staff trained to a level appropriate for their work, supervised and fit to handle food.</li>
              </ul>
              <p>
                On inspection, your business is scored on hygiene and safety, structure and cleanliness,
                and confidence in management. The third area is where your SFBB pack and daily records
                live — and where most small caterers lose marks.
              </p>
            </div>
          </section>

          <section id="sfbb-or-haccp" className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-bold text-slate-900">SFBB or full HACCP?</h2>
            <div className="mt-4 space-y-4 text-slate-700 leading-relaxed">
              <p>
                Most independent caterers, cafés, sandwich bars and small restaurants do not need a
                full textbook HACCP study. A completed SFBB for Caterers pack — safe methods, daily
                diary, opening and closing checks, four-weekly and annual reviews — is normally what an EHO
                expects to see.
              </p>
              <p>
                You should move to a bespoke HACCP plan when your process goes beyond SFBB's assumptions:
                for example, sous-vide, vacuum packing, cook-chill, long ambient shelf-life products,
                large-scale off-site catering with complex transport, or supplying other businesses.
              </p>
              <p>
                Either route is legal if it describes what you actually do and the daily records prove you
                follow it. The best system is the one your team will actually use every day.
              </p>
            </div>
          </section>

          <section id="complete-sfbb" className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-bold text-slate-900">How to complete the pack step by step</h2>
            <p className="mt-3 text-slate-600">
              Treat the SFBB pack as a working document, not a one-off form.
            </p>
            <ol className="mt-6 space-y-5">
              {steps.map((s) => (
                <li key={s.n} className="flex gap-4">
                  <span
                    className="mt-0.5 h-8 w-8 shrink-0 rounded-full text-white text-sm font-semibold flex items-center justify-center"
                    style={{ backgroundColor: BRAND_SAGE }}
                  >
                    {s.n}
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-900">{s.t}</h3>
                    <p className="mt-1 text-slate-700 leading-relaxed">{s.b}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section id="caterer-risks" className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-bold text-slate-900">The five caterer risks that fail inspections</h2>
            <div className="mt-6 space-y-6">
              {risks.map((r) => (
                <Card key={r.t} className="p-5">
                  <h3 className="font-heading text-lg font-semibold text-slate-900">{r.t}</h3>
                  <p className="mt-2 text-slate-700 leading-relaxed">{r.b}</p>
                  <ul className="mt-4 space-y-2">
                    {r.c.map((c) => (
                      <li key={c} className="flex gap-2.5 text-sm text-slate-700">
                        <Check className="h-4 w-4 shrink-0 mt-0.5" style={{ color: BRAND_SAGE }} />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </section>

          <section id="records" className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-bold text-slate-900">Records an EHO will ask for</h2>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <caption className="sr-only">
                  Typical SFBB records for caterers, how often to complete them and what they prove
                </caption>
                <thead>
                  <tr className="text-left border-b border-slate-200">
                    <th scope="col" className="py-2 pr-4 font-semibold text-slate-900">Record</th>
                    <th scope="col" className="py-2 pr-4 font-semibold text-slate-900">Frequency</th>
                    <th scope="col" className="py-2 font-semibold text-slate-900">What it proves</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {[
                    ["Opening and closing checks", "Daily", "Safe methods are followed at start and end of day"],
                    ["Daily diary entries", "Every service", "Temperatures, deliveries, cleaning and corrective actions are recorded"],
                    ["Fridge, freezer and hot-holding temperatures", "At least twice daily", "Cold and hot CCPs stay within limits"],
                    ["Cooking and reheating checks", "Every batch", "Food reaches a safe core temperature"],
                    ["Cooling checks", "Every high-risk batch", "Food is chilled within safe time limits"],
                    ["Cleaning schedule completion", "Per task", "Structure and equipment hygiene is controlled"],
                    ["Supplier and delivery checks", "Every delivery", "Ingredients are safe and from approved suppliers"],
                    ["Probe calibration", "Monthly or per FSA advice", "Temperature readings can be trusted"],
                    ["Allergen recipe records and PPDS labels", "On recipe change", "Customer allergen information is accurate"],
                    ["Staff training and fitness to work", "On joining and refreshed", "Handlers are trained and fit to work"],
                    ["Incidents and corrective actions", "As they happen", "Problems are found, recorded and fixed"],
                    ["Four-weekly and annual reviews", "Every 4 weeks / yearly", "The system is reviewed and kept up to date"],
                  ].map(([r, f, p]) => (
                    <tr key={r} className="border-b border-slate-100 align-top">
                      <td className="py-2.5 pr-4 font-medium text-slate-900">{r}</td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">{f}</td>
                      <td className="py-2.5">{p}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-slate-700 leading-relaxed">
              A missed entry with a note explaining what happened is far better than a perfect sheet filled
              in the night before the inspection. Officers are experienced at spotting back-filled records.
            </p>
          </section>

          <section id="how-miseos-helps" className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-bold text-slate-900">How MiseOS digitises this</h2>
            <p className="mt-3 text-slate-700 leading-relaxed">
              MiseOS is built for independent UK food businesses: cafés, sandwich bars, caterers, home
              kitchens, food trucks and small restaurants. The app turns the records above into prompts
              on a phone and exports them into one EHO-ready pack.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {automation.map((a) => (
                <Card key={a.t} className="p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 shrink-0 mt-0.5" style={{ color: BRAND_SAGE }} />
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">{a.t}</h3>
                      <p className="mt-1 text-sm text-slate-600 leading-relaxed">{a.b}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
              <h3 className="font-heading text-xl font-bold text-slate-900">
                Move from paper SFBB to digital compliance
              </h3>
              <p className="mt-2 text-slate-600">
                Start a 14-day free trial and build your caterer's food safety records from day one.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <a href="/auth?mode=signup">
                  <Button style={{ backgroundColor: BRAND_SAGE }} className="text-white hover:opacity-90">
                    Start free trial <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
                <Link to="/landing#features">
                  <Button variant="outline">See what MiseOS does</Button>
                </Link>
              </div>
            </div>
          </section>

          <section id="faq" className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-bold text-slate-900">SFBB questions</h2>
            <div className="mt-5 divide-y divide-slate-200">
              {faqs.map((f) => (
                <div key={f.q} className="py-5">
                  <h3 className="font-semibold text-slate-900">{f.q}</h3>
                  <p className="mt-2 text-slate-700 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-lg font-semibold text-slate-900">Useful sources</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                ["FSA — Safer Food, Better Business for caterers", "https://www.food.gov.uk/business-guidance/safer-food-better-business-sfbb"],
                ["FSA — Allergen guidance for businesses", "https://www.food.gov.uk/business-guidance/allergen-guidance-for-food-businesses"],
                ["FSA — Food Hygiene Rating Scheme", "https://www.food.gov.uk/safety-hygiene/food-hygiene-rating-scheme"],
                ["FSA — Food law codes of practice", "https://www.food.gov.uk/business-guidance/food-law-codes-of-practice"],
              ].map(([label, href]) => (
                <li key={href}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-700 hover:text-slate-900 underline underline-offset-4 decoration-slate-300"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </main>

      <footer className="border-t border-slate-200 py-8">
        <div className="max-w-3xl mx-auto px-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>© {new Date().getFullYear()} MiseOS</span>
          <div className="flex gap-4">
            <Link to="/landing" className="hover:text-slate-900">Home</Link>
            <Link to="/landing#pricing" className="hover:text-slate-900">Pricing</Link>
            <a href="/auth" className="hover:text-slate-900">Sign in</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
