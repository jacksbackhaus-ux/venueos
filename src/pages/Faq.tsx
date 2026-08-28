// DRAFT CONTENT — factual/regulatory claims need Jack's review before publishing.
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SEO } from "@/components/SEO";
import { GuideCta, GuideFooter, GuideHeader } from "@/components/guides/GuideShell";

const PATH = "/faq";
const TITLE = "Food Safety FAQ for UK Small Food Businesses | MiseOS";
const DESCRIPTION =
  "Short, plain-English answers on HACCP, SFBB, home baking, EHO inspections, hygiene ratings and digital records for UK small food businesses.";

type Faq = { q: string; a: string };
type Group = { heading: string; items: Faq[] };

const GROUPS: Group[] = [
  {
    heading: "Getting started",
    items: [
      {
        q: "Do I need to register my food business with the council?",
        a: "Yes. Registration is free, cannot be refused, and should be done at least 28 days before you start trading [VERIFY: current registration lead time]. You register with the council covering the address where you prepare food, even if you sell somewhere else.",
      },
      {
        q: "Can I legally sell food made in my home kitchen in the UK?",
        a: "Yes, provided you register with your local council, keep your kitchen and practices hygienic, have a HACCP-based food safety system such as SFBB, and give customers accurate allergen information. There is no separate 'cottage food' category in the UK — the same rules apply proportionately.",
      },
      {
        q: "Do I need a food hygiene certificate?",
        a: "There is no single mandatory certificate, but you must be trained to a level appropriate to the work you do. A Level 2 Food Safety and Hygiene course is the usual, inexpensive route and is what most inspectors and event organisers expect to see.",
      },
    ],
  },
  {
    heading: "HACCP and SFBB",
    items: [
      {
        q: "What does HACCP stand for?",
        a: "Hazard Analysis and Critical Control Point. It is a structured way of finding the points in your process where food safety could fail, deciding how you control them, and recording that you did.",
      },
      {
        q: "Is SFBB the same as HACCP?",
        a: "Not quite. HACCP is the legal requirement; Safer Food, Better Business is the FSA's free ready-made pack that lets small caterers meet that requirement without writing a plan from scratch. Completing SFBB and keeping its diary is your HACCP system.",
      },
      {
        q: "Do I need a bespoke HACCP plan instead of SFBB?",
        a: "Usually only if your processes fall outside typical catering — vacuum packing, sous-vide, cook-chill, self-set extended shelf lives, wholesale supply, or allergen-free claims that depend on strict segregation. Otherwise SFBB is enough for a café, bakery, stall or home kitchen.",
      },
      {
        q: "How often do I have to fill in the diary?",
        a: "On the days you trade or produce. A short daily entry plus periodic reviews is the expected pattern [VERIFY: current SFBB diary and review intervals]. If you only bake two days a week, records for those days are what matters — closed days should not look like missed checks.",
      },
    ],
  },
  {
    heading: "Records and inspections",
    items: [
      {
        q: "What records will an environmental health officer ask to see?",
        a: "Typically your food safety system (SFBB pack or HACCP plan), fridge and freezer temperature records, cooking and cooling records for high-risk items, a cleaning schedule, delivery and supplier notes, allergen information, staff training records, and evidence of what you did when something went wrong.",
      },
      {
        q: "Are digital food safety records acceptable in the UK?",
        a: "Yes. There is no requirement for paper. Records must be accurate, kept up to date, and available to an officer on request — a phone or laptop record, or a printed export, meets that.",
      },
      {
        q: "How long should I keep my records?",
        a: "Long enough to cover a full inspection cycle and to trace a product if there is a problem [VERIFY: retention period expected by local authorities]. Many small businesses keep at least the last 12 months.",
      },
      {
        q: "How is the food hygiene rating decided?",
        a: "Officers score three areas: hygienic food handling, the condition and cleanliness of the premises and structure, and confidence in management — which is largely about your documented system and whether records match what actually happens.",
      },
      {
        q: "Will a missed check ruin my rating?",
        a: "One gap rarely does. Patterns do. Consistent entries, plus honest notes on what went wrong and what you changed, generally read better than a perfect-looking record with no corrective actions in it at all.",
      },
    ],
  },
  {
    heading: "Using MiseOS",
    items: [
      {
        q: "How much does MiseOS cost?",
        a: "£4.99 per site per month, plus £1 per extra user per month, with a 14-day free trial. One subscription covers the food safety modules — there is no separate compliance tier.",
      },
      {
        q: "Does MiseOS work for home bakers and market traders?",
        a: "Yes. You choose your premises type and operating mode, so a home or on-demand business logs against production days rather than a seven-day schedule, and closed days never count against you.",
      },
      {
        q: "Can I use my existing completed SFBB pack?",
        a: "Yes. You can either complete the SFBB safe methods inside MiseOS or upload your finished SFBB PDF as your food safety management system and keep your daily records in the app alongside it.",
      },
      {
        q: "What happens if I lose signal in the kitchen?",
        a: "Logs can be recorded offline and sync when you are back online, so a poor connection does not create gaps in your records.",
      },
      {
        q: "Can I give an inspector a single document?",
        a: "Yes. The Inspection Pack export produces a per-site PDF or spreadsheet covering your chosen period, laid out around the three areas inspectors assess.",
      },
    ],
  },
];

export default function Faq() {
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "en-GB",
    mainEntity: GROUPS.flatMap((g) => g.items).map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="min-h-screen bg-white">
      <SEO title={TITLE} description={DESCRIPTION} path={PATH} />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
      </Helmet>
      <GuideHeader />

      <main className="max-w-3xl mx-auto px-4 py-10 md:py-14">
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
          Food safety FAQ
        </h1>
        <p className="mt-4 text-lg text-slate-600 leading-relaxed">
          Short answers to the questions we hear most from UK bakeries, cafés, home bakers and market
          traders. General guidance, not legal advice — check current FSA guidance and your local
          council for your own setup.
        </p>

        <div className="mt-10 space-y-10">
          {GROUPS.map((g) => (
            <section key={g.heading}>
              <h2 className="font-heading text-xl font-bold text-slate-900">{g.heading}</h2>
              <Accordion type="single" collapsible className="mt-3">
                {g.items.map((f) => (
                  <AccordionItem key={f.q} value={f.q}>
                    <AccordionTrigger className="text-left text-slate-900">{f.q}</AccordionTrigger>
                    <AccordionContent className="text-slate-600 leading-relaxed">
                      {f.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>

        <p className="mt-10 text-sm text-slate-600">
          Want more detail? Browse the{" "}
          <Link to="/guides" className="underline underline-offset-4 decoration-slate-300 hover:text-slate-900">
            Food Safety Hub guides
          </Link>
          .
        </p>

        <GuideCta />
      </main>

      <GuideFooter />
    </div>
  );
}
