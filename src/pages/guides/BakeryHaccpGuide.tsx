import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import miseosLogo from "@/assets/miseos-logo.png";

const BRAND_SAGE = "#3d8a6a";
const PATH = "/guides/bakery-haccp-compliance";
const URL = `https://mise-os.app${PATH}`;
const TITLE = "HACCP for Bakeries: The 2026 UK Compliance Guide";
const DESCRIPTION =
  "A practical 2026 HACCP guide for UK bakeries: hazard analysis, allergen cross-contamination, flour dust, CCPs, records and inspection prep.";

const faqs = [
  {
    q: "Do small UK bakeries legally need a HACCP plan?",
    a: "Yes. Under Regulation (EC) 852/2004, as retained in UK law, all food businesses must put in place procedures based on HACCP principles and keep them up to date. Very small bakeries, home bakers and market traders usually satisfy this with the FSA's Safer Food, Better Business (SFBB) pack rather than a full bespoke HACCP study, but the documented system and daily records are still required.",
  },
  {
    q: "Is Safer Food, Better Business enough, or do I need full HACCP?",
    a: "For most independent bakeries and cafés, a completed SFBB pack with up-to-date safe methods, daily diary and review records is accepted by environmental health officers as a HACCP-based system. Bakeries with unusual processes — vacuum packing, long fermentation for retail sale, cook-chill, or wholesale supply with extended shelf life — normally need a bespoke HACCP plan built around those steps.",
  },
  {
    q: "How does HACCP affect our Food Hygiene Rating?",
    a: "Inspectors score three areas: hygiene and safety, structure and cleanliness, and confidence in management. Your documented HACCP or SFBB system and the records that prove you follow it drive the confidence in management score. Missing or back-filled records is one of the most common reasons a bakery loses a 5.",
  },
  {
    q: "Which bakery records should we keep, and for how long?",
    a: "As a minimum: fridge and freezer temperatures, cooling and hot-holding checks where relevant, cleaning completion, delivery and supplier checks, probe calibration, staff fitness-to-work and training, allergen recipe information, and corrective actions for anything that went wrong. Most UK bakeries keep at least 12 months so records cover a full inspection cycle.",
  },
  {
    q: "Is flour dust a food safety hazard or a health and safety issue?",
    a: "Both. Flour dust is a recognised cause of occupational asthma and is controlled under COSHH, so it sits mainly in your health and safety risk assessment. It also matters for food safety because airborne flour carries allergens across a bakery, so dust control belongs in your allergen cross-contamination controls too.",
  },
  {
    q: "Can we run HACCP records on paper?",
    a: "Yes, paper is legal. The practical problem is retrieval: an inspector asking for last Tuesday's temperatures, or a customer allergen query mid-service, is where paper systems fail. Digital records make the same evidence searchable and exportable, which is why most bakeries move once they have more than one person logging checks.",
  },
];

const steps = [
  {
    n: "1",
    t: "Map every step of your bakery day",
    b: "List each stage from delivery to sale: goods in, dry store, chilled store, weighing, mixing, proving, baking, cooling, filling and finishing, packing, labelling, display, and any delivery or market stall. This flow diagram is the foundation of the hazard analysis — you cannot control what you have not written down.",
  },
  {
    n: "2",
    t: "Identify the hazards that actually apply to baking",
    b: "For each step, note biological, chemical, physical and allergen hazards. In bakeries the real risks cluster around cream and custard fillings, cooling of large bakes, cross-contamination from flour and nut dusts, foreign bodies from scrapers, blades and packaging, and mycotoxins or pests in dry stores.",
  },
  {
    n: "3",
    t: "Decide your critical control points",
    b: "A CCP is a step where control is essential to prevent, remove or reduce a hazard to a safe level. Typical bakery CCPs are chilled and frozen storage temperatures, the bake itself for cooked fillings, rapid cooling of high-risk products, chilled display of cream goods, and allergen segregation and labelling.",
  },
  {
    n: "4",
    t: "Set limits, monitoring and corrective actions",
    b: "Give every CCP a number, a check frequency and a named action if it fails. For example: chillers at 1–5°C checked twice daily; if a reading is 8°C, move stock, log the breach, record what was discarded and get the unit fixed before restocking.",
  },
  {
    n: "5",
    t: "Verify, review and keep the paperwork honest",
    b: "Calibrate probes, review the plan whenever a recipe, supplier, piece of equipment or process changes, and formally review at least annually. Sign off records daily, and never back-fill: a retrospective entry marked as such is far stronger than a fabricated one.",
  },
];

const risks = [
  {
    t: "Allergen cross-contamination",
    b: "Bakeries handle almost every one of the 14 regulated allergens in one small space: wheat gluten, milk, egg, nuts, soya, sesame, sulphites in dried fruit. Airborne flour and nut dust, shared mixers, dusted benches, cooling racks stacked above open product and reused piping bags all move allergens between products.",
    c: [
      "Schedule allergen-containing bakes last, or in a separated area and time slot",
      "Colour-code utensils, bowls, cloths and piping bags for nut and gluten-free work",
      "Full clean-down between allergen batches — dry brushing spreads dust, so wipe and wash",
      "Keep an accurate ingredient and recipe record per product, including 'may contain' decisions based on your actual segregation",
      "Apply PPDS (Natasha's Law) labelling to anything you pack on site for direct sale, with full ingredients and allergens emphasised",
      "Train every team member to say 'let me check' rather than guess on a customer allergen question",
    ],
  },
  {
    t: "Flour dust and airborne contamination",
    b: "Flour dust is the second most common cause of occupational asthma in the UK and is a COSHH-controlled substance. It also carries gluten across the whole bakery, which directly undermines any gluten-free claim.",
    c: [
      "Tip and sieve flour at low height, into deep bowls, away from finished product",
      "Use dusting shakers rather than handfuls, and dredge inside a designated area",
      "Extraction or ventilation over mixers and dough brakes where practical, plus RPE for heavy dusting tasks",
      "Vacuum with an appropriate filter instead of sweeping or blowing dust off surfaces",
      "Keep finished, unwrapped and gluten-free product out of dusting zones entirely",
      "Record dust controls in your COSHH assessment and mention them in your allergen safe method",
    ],
  },
  {
    t: "Cooling, filling and chilled display",
    b: "The highest microbiological risk in a bakery is rarely the bake — it is what happens after it. Warm product filled with cream or custard, slow cooling of dense bakes, and ambient display of cream goods are the classic failures inspectors look for.",
    c: [
      "Cool to chilled temperature as quickly as practical, split large bakes, and log the check",
      "Never fill with dairy or custard until the product is properly cooled",
      "Hold and display cream, cheesecake and custard products at 8°C or below, monitored and logged",
      "Set realistic use-by dates for high-risk filled goods and apply them consistently",
      "Batch-code so a single problem batch can be traced and withdrawn without guesswork",
    ],
  },
  {
    t: "Traceability, suppliers and recalls",
    b: "If a supplier issues a flour or dried fruit recall, you need to know which batches you used, what you made with them and where those products went — including wholesale and market sales.",
    c: [
      "Keep an approved supplier list with specifications for allergen-critical ingredients",
      "Check and record deliveries: temperature, condition, date codes, damaged packaging",
      "Record ingredient lot numbers against production batches",
      "Log wholesale customers, markets and events so a withdrawal can be targeted",
      "Write down your recall steps before you need them, including who contacts the local authority",
    ],
  },
  {
    t: "Pest, structure and equipment",
    b: "Dry stores full of flour and sugar are attractive to pests, and worn equipment sheds foreign bodies. Both sit in the structure and confidence in management parts of your inspection.",
    c: [
      "Store ingredients off the floor in sealed, labelled containers with rotation",
      "Regular documented pest checks and a professional contract where risk warrants it",
      "Planned preventative maintenance for ovens, provers, mixers and chillers",
      "Inspect scrapers, brushes, blades and container lids for damage, and remove them from use when worn",
    ],
  },
];

const automation = [
  { t: "Guided SFBB and HACCP plan", b: "Complete every safe method in the app, or upload your finished SFBB pack — both count as your documented food safety management system." },
  { t: "Temperature logs with pass/fail built in", b: "Fridge, freezer, cooking, cooling and hot-holding checks compare against your own limits and prompt a corrective action when something fails." },
  { t: "Allergen recipes and PPDS labels", b: "Hold ingredients and allergens per recipe, and produce compliant PPDS labels for anything packed on site." },
  { t: "Batch tracking and traceability", b: "Batch codes, use-by dates, ingredient lots and a withdrawal trail for wholesale and market sales." },
  { t: "Cleaning, pest, PPM and training", b: "Scheduled tasks with a completion record, plus staff training and fitness-to-work evidence in one place." },
  { t: "Inspection pack export", b: "One EHO-ready PDF pulling your plan, records, corrective actions and reviews together, ready for the visit." },
];

export default function BakeryHaccpGuide() {
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: DESCRIPTION,
    inLanguage: "en-GB",
    mainEntityOfPage: { "@type": "WebPage", "@id": URL },
    author: { "@type": "Organization", name: "MiseOS", url: "https://mise-os.app" },
    publisher: { "@type": "Organization", name: "MiseOS", url: "https://mise-os.app" },
    about: "HACCP compliance for bakeries in the United Kingdom",
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
            HACCP for Bakeries: The 2026 UK Compliance Guide
          </h1>
          <p className="mt-4 text-lg text-slate-600 leading-relaxed">
            Everything an independent UK bakery needs to build a HACCP-based food safety system that
            holds up on inspection day — written around real bakery risks: allergen
            cross-contamination, flour dust, cooling and filling, and traceability.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            General guidance for UK food businesses, not legal advice. Always check current FSA
            guidance and speak to your local authority environmental health team about your premises.
          </p>

          <Card className="mt-8 p-5 bg-slate-50 border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">On this page</h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {[
                ["what-the-law-requires", "What UK law requires"],
                ["sfbb-or-haccp", "SFBB or full HACCP?"],
                ["seven-principles", "Building the plan step by step"],
                ["bakery-risks", "The five bakery risks that fail inspections"],
                ["records", "The records an inspector will ask for"],
                ["how-miseos-helps", "How MiseOS automates this"],
                ["faq", "Bakery HACCP questions"],
              ].map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-slate-700 hover:text-slate-900 underline underline-offset-4 decoration-slate-300">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </Card>

          <section id="what-the-law-requires" className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-bold text-slate-900">What UK law requires</h2>
            <div className="mt-4 space-y-4 text-slate-700 leading-relaxed">
              <p>
                Every UK food business — including a home bakery, a market stall and a two-person
                artisan bakery — must have food safety management procedures based on HACCP
                principles, keep them in writing, follow them, and keep them up to date. That comes
                from Regulation (EC) 852/2004 as retained in UK law, alongside the Food Safety and
                Hygiene (England) Regulations 2013 and their equivalents in Scotland, Wales and
                Northern Ireland.
              </p>
              <p>
                Two further duties bite hard in bakeries. Allergen information for the 14 regulated
                allergens must be accurate and available, and anything you pack on site for direct
                sale needs full PPDS labelling under Natasha's Law. Separately, flour dust is a
                COSHH-controlled substance, so dust exposure belongs in your health and safety risk
                assessment as well as your allergen controls.
              </p>
              <p>
                On inspection you are scored on hygiene and safety, structure and cleanliness, and
                confidence in management. The third one is where documentation lives — and where most
                small bakeries lose their rating, not because the baking is unsafe but because the
                evidence is missing.
              </p>
            </div>
          </section>

          <section id="sfbb-or-haccp" className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-bold text-slate-900">SFBB or full HACCP?</h2>
            <div className="mt-4 space-y-4 text-slate-700 leading-relaxed">
              <p>
                You do not have to write a textbook HACCP study to be compliant. The FSA's Safer
                Food, Better Business pack is a HACCP-based system designed for small caterers and
                retailers, and for most independent bakeries a completed SFBB pack — safe methods,
                daily diary, opening and closing checks, four-weekly and annual reviews — is exactly
                what an officer expects to see.
              </p>
              <p>
                Move to a bespoke HACCP plan when your process goes beyond SFBB's assumptions:
                vacuum packing or modified atmosphere packaging, long ambient shelf lives, cook-chill
                or sous-vide components, wholesale supply into other businesses, or a gluten-free
                claim that depends on strict segregation. In those cases the plan needs to reason
                about your specific steps rather than reuse a generic method.
              </p>
              <p>
                Either route satisfies the legal requirement for a documented food safety management
                system. What matters is that it describes what you actually do, and that the daily
                records prove you did it.
              </p>
            </div>
          </section>

          <section id="seven-principles" className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-bold text-slate-900">Building the plan step by step</h2>
            <p className="mt-3 text-slate-600">
              The seven HACCP principles, translated into a bakery day.
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

          <section id="bakery-risks" className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              The five bakery risks that fail inspections
            </h2>
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
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              The records an inspector will ask for
            </h2>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <caption className="sr-only">
                  Typical bakery HACCP records, how often to complete them and what they prove
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
                    ["Fridge, freezer and display temperatures", "Opening and closing", "Chilled CCPs are within limits"],
                    ["Cooling and filling checks", "Every high-risk batch", "Cream and custard goods were cooled before filling"],
                    ["Opening and closing checks", "Daily", "Safe methods are followed, not just written"],
                    ["Cleaning schedule completion", "Per task", "Structure and equipment hygiene is controlled"],
                    ["Deliveries and supplier checks", "Every delivery", "Ingredients arrived safe from approved suppliers"],
                    ["Probe calibration", "Monthly, or per FSA advice", "Temperature readings can be trusted"],
                    ["Batch and ingredient lots", "Per production batch", "Traceability and targeted withdrawal"],
                    ["Allergen recipe records and PPDS labels", "On recipe change", "Allergen information is accurate"],
                    ["Staff training and fitness to work", "On joining and refreshed", "Handlers are trained and fit to work"],
                    ["Corrective actions and incidents", "As they happen", "Problems were found and dealt with"],
                    ["Plan review", "On change and at least yearly", "The system is kept up to date"],
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
              A gap is not automatically a failure — an honest note explaining a missed check, and
              what you did about it, is worth far more than a tidy page of invented numbers. Officers
              are experienced at spotting records completed in one sitting.
            </p>
          </section>

          <section id="how-miseos-helps" className="mt-12 scroll-mt-24">
            <h2 className="font-heading text-2xl font-bold text-slate-900">How MiseOS automates this</h2>
            <p className="mt-3 text-slate-700 leading-relaxed">
              MiseOS is built for independent bakeries, cafés and small kitchens — including home
              bakers and market traders. It turns the list above into prompts on a phone and a single
              export you can hand to an officer.
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
                Get inspection-ready without the paperwork
              </h3>
              <p className="mt-2 text-slate-600">
                Start a 14-day free trial and build your bakery's HACCP records from day one.
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
            <h2 className="font-heading text-2xl font-bold text-slate-900">Bakery HACCP questions</h2>
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
                ["FSA — Safer Food, Better Business", "https://www.food.gov.uk/business-guidance/safer-food-better-business-sfbb"],
                ["FSA — Allergen guidance for businesses", "https://www.food.gov.uk/business-guidance/allergen-guidance-for-food-businesses"],
                ["FSA — Food Hygiene Rating Scheme", "https://www.food.gov.uk/safety-hygiene/food-hygiene-rating-scheme"],
                ["HSE — Flour dust in bakeries", "https://www.hse.gov.uk/food/flour.htm"],
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
