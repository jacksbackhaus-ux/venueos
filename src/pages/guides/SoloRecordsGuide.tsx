// DRAFT CONTENT — factual/regulatory claims need Jack's review before publishing.
import { Helmet } from "react-helmet-async";
import { Card } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import {
  GuideBreadcrumb,
  GuideCta,
  GuideDisclaimer,
  GuideFooter,
  GuideHeader,
} from "@/components/guides/GuideShell";

const PATH = "/guides/records-for-solo-food-businesses";
const URL = `https://mise-os.app${PATH}`;
const TITLE = "How Simple Can Your Food Safety Records Be If It's Just You?";
const DESCRIPTION =
  "Proportionate food safety records for UK home bakers, market traders and one-person kitchens: what to write down, how often, and what an inspector expects.";

const dayToDay = [
  {
    t: "Fridge and freezer temperatures",
    b: "One check on the days you're working is usually enough for a small operation. Write the number down, not just a tick — a number shows you looked.",
  },
  {
    t: "Cooking, cooling and reheating",
    b: "Only for the things you actually make. If you bake and cool one high-risk product, record that product. You don't need a form for a process you never do.",
  },
  {
    t: "Cleaning",
    b: "A short list of what gets cleaned daily, weekly and monthly, with a date when it's done. A schedule you follow beats a detailed one you ignore.",
  },
  {
    t: "Deliveries and suppliers",
    b: "Note who you buy from and flag anything that arrived warm, damaged or out of date, plus what you did about it.",
  },
  {
    t: "Allergens and recipes",
    b: "Keep the ingredient list for each product you sell so you can answer an allergen question in seconds and label correctly.",
  },
  {
    t: "When something goes wrong",
    b: "This is the one people skip and the one inspectors care about most. What happened, what you did, and what you changed so it doesn't repeat.",
  },
];

export default function SoloRecordsGuide() {
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: DESCRIPTION,
    inLanguage: "en-GB",
    mainEntityOfPage: { "@type": "WebPage", "@id": URL },
    author: { "@type": "Organization", name: "MiseOS", url: "https://mise-os.app" },
    publisher: { "@type": "Organization", name: "MiseOS", url: "https://mise-os.app" },
    about: "Proportionate food safety record keeping for solo food businesses in the UK",
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://mise-os.app/" },
      { "@type": "ListItem", position: 2, name: "Food Safety Hub", item: "https://mise-os.app/guides" },
      { "@type": "ListItem", position: 3, name: TITLE, item: URL },
    ],
  };

  return (
    <div className="min-h-screen bg-white">
      <SEO title={TITLE} description={DESCRIPTION} path={PATH} type="article" />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(articleLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
      </Helmet>
      <GuideHeader />

      <main>
        <article className="max-w-3xl mx-auto px-4 py-10 md:py-14">
          <GuideBreadcrumb label="Records for solo food businesses" />

          <h1 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            How simple can your food safety records legally be if it's just you?
          </h1>
          <p className="mt-4 text-lg text-slate-600 leading-relaxed">
            Simpler than most people fear — but not nothing. If you're a home baker, a market trader
            or a one-person kitchen, your paperwork is meant to match the size and risk of what you
            do. Here's what "proportionate" looks like in practice.
          </p>
          <GuideDisclaimer />

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              Records scale with the business, not with the rulebook
            </h2>
            <div className="mt-4 space-y-4 text-slate-700 leading-relaxed">
              <p>
                Every UK food business needs food safety procedures based on HACCP principles, written
                down and kept up to date [VERIFY: exact regulation reference and wording]. What that
                looks like is deliberately flexible: a solo baker making sponges to order is not
                expected to produce the same folder as a 40-cover restaurant with three chillers and
                eight staff.
              </p>
              <p>
                The test an environmental health officer applies is simple and fair. Can you show
                what you check, when you checked it, and what you did when something wasn't right? If
                yes, your records are doing their job — even if they fit on two sides of paper.
              </p>
              <p>
                Being small doesn't remove the duty. It shapes it. Fewer processes means fewer things
                to monitor, so a short record set that you complete consistently is genuinely better
                than a comprehensive one with gaps.
              </p>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              SFBB is the standard route for most small food businesses
            </h2>
            <div className="mt-4 space-y-4 text-slate-700 leading-relaxed">
              <p>
                The FSA's Safer Food, Better Business (SFBB) pack is free and built for exactly this
                situation. Instead of writing a food safety system from scratch, you work through
                ready-made "safe methods" — chilling, cooking, cleaning, cross-contamination,
                allergens — tick the ones that apply to you, and note anything you do differently.
              </p>
              <p>
                Alongside the safe methods sits a diary: a short daily record plus periodic reviews
                [VERIFY: current SFBB diary and review intervals]. For most home bakers, stalls and
                small cafés, a completed SFBB pack plus that diary is what an inspector expects to
                see, and it satisfies the requirement for a HACCP-based system.
              </p>
              <p>
                You can keep SFBB on paper, as a PDF, or in an app. What matters is that it reflects
                what you actually do and that the diary is filled in as you go rather than the night
                before a visit.
              </p>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              When a bespoke HACCP plan makes more sense
            </h2>
            <p className="mt-4 text-slate-700 leading-relaxed">
              SFBB assumes fairly typical catering processes. If your process steps outside those
              assumptions, the pack stops describing your business and you'd write a plan around your
              own steps instead. Common triggers:
            </p>
            <ul className="mt-4 space-y-2.5 text-slate-700">
              {[
                "Vacuum packing, sous-vide or modified-atmosphere packing",
                "Long ambient or extended chilled shelf lives you set yourself",
                "Wholesale supply into other businesses rather than direct to customers",
                "A gluten-free or allergen-free claim that depends on strict segregation",
                "Higher-risk products such as cook-chill, raw dairy or fermented preserves",
              ].map((x) => (
                <li key={x} className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-slate-700 leading-relaxed">
              If none of those apply, you almost certainly don't need a consultant or a bespoke plan.
              If one or two do, it's worth a conversation with your local environmental health team —
              they'd generally rather advise early than find a problem later.
            </p>
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              What proportionate records look like day to day
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {dayToDay.map((d) => (
                <Card key={d.t} className="p-5 border-slate-200">
                  <h3 className="font-semibold text-slate-900">{d.t}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{d.b}</p>
                </Card>
              ))}
            </div>
            <p className="mt-6 text-slate-700 leading-relaxed">
              Two habits matter more than the format. First, record on the day — a real entry with a
              gap is more credible than a perfect page written in hindsight. Second, when something
              fails, write the fix next to it. That single habit is what turns a pile of numbers into
              evidence that you're managing your kitchen properly.
            </p>
            <p className="mt-4 text-slate-700 leading-relaxed">
              Keep your records long enough to cover a full inspection cycle [VERIFY: retention period
              expected by local authorities], and store them somewhere you can find a specific day
              quickly. That's usually the moment paper starts to hurt.
            </p>
          </section>

          <GuideCta />
        </article>
      </main>

      <GuideFooter />
    </div>
  );
}
