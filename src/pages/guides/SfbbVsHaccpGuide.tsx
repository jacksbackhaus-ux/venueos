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

const PATH = "/guides/sfbb-vs-haccp";
const URL = `https://mise-os.app${PATH}`;
const TITLE = "SFBB vs HACCP: Which Does My Café or Bakery Need?";
const DESCRIPTION =
  "SFBB is the FSA's ready-made way to meet HACCP requirements for small UK caterers. Here's how to tell whether SFBB covers you or you need a bespoke plan.";

export default function SfbbVsHaccpGuide() {
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: DESCRIPTION,
    inLanguage: "en-GB",
    mainEntityOfPage: { "@type": "WebPage", "@id": URL },
    author: { "@type": "Organization", name: "MiseOS", url: "https://mise-os.app" },
    publisher: { "@type": "Organization", name: "MiseOS", url: "https://mise-os.app" },
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
      <SEO title={TITLE} description={DESCRIPTION} path={PATH} />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(articleLd)}</script>
        <script type="application/ld+json">{JSON.stringify(breadcrumbLd)}</script>
      </Helmet>
      <GuideHeader />

      <main>
        <article className="max-w-3xl mx-auto px-4 py-10 md:py-14">
          <GuideBreadcrumb label="SFBB vs HACCP" />

          <h1 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            SFBB vs HACCP: which does my café or bakery need?
          </h1>
          <p className="mt-4 text-lg text-slate-600 leading-relaxed">
            It isn't really a choice between two things. HACCP is the legal requirement; SFBB is the
            FSA's free, ready-made way for small caterers to meet it. If you run a typical café or
            bakery, completing SFBB and keeping its diary is your HACCP system.
          </p>
          <GuideDisclaimer />

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-bold text-slate-900">The difference in one table</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Card className="p-5 border-slate-200">
                <h3 className="font-heading font-bold text-slate-900">HACCP</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  A set of principles: identify hazards, decide the critical points, set limits,
                  monitor, correct, verify, keep records. It's the outcome the law asks for — not a
                  specific document or product.
                </p>
              </Card>
              <Card className="p-5 border-slate-200">
                <h3 className="font-heading font-bold text-slate-900">SFBB</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  A free FSA pack that applies those principles for you through pre-written safe
                  methods plus a diary. Designed for small caterers so you don't have to build a system
                  from scratch.
                </p>
              </Card>
            </div>
            <p className="mt-5 text-slate-700 leading-relaxed">
              So "do I need SFBB or HACCP?" is best answered: you need a HACCP-based system, and SFBB
              is the easiest acceptable form of it for most small food businesses
              [VERIFY: FSA wording on SFBB satisfying HACCP requirements].
            </p>
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-bold text-slate-900">SFBB is right for you if…</h2>
            <ul className="mt-4 space-y-2.5 text-slate-700">
              {[
                "You're a café, bakery, sandwich shop, takeaway, stall or home baker selling mainly direct to customers",
                "Your processes are recognisable catering steps: chilling, cooking, cooling, reheating, cleaning, avoiding cross-contamination",
                "You want something free, quick to set up and familiar to your inspector",
                "You'd rather spend your time on the daily diary than on writing documents",
              ].map((x) => (
                <li key={x} className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              You may need a bespoke HACCP plan if…
            </h2>
            <ul className="mt-4 space-y-2.5 text-slate-700">
              {[
                "You vacuum pack, sous-vide or use modified-atmosphere packaging",
                "You set your own extended shelf lives, or make cook-chill products",
                "You supply wholesale into other businesses rather than selling direct",
                "You make an allergen-free or gluten-free claim that relies on strict segregation",
                "You handle higher-risk items such as raw milk products or fermented preserves",
              ].map((x) => (
                <li key={x} className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-slate-700 leading-relaxed">
              A practical middle ground is common and accepted: use SFBB for everything it covers, and
              add a short written plan for the one unusual process you have. Ask your environmental
              health officer to look at it — most are happy to say whether it's enough.
            </p>
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              Whichever route you take, the records decide your rating
            </h2>
            <p className="mt-4 text-slate-700 leading-relaxed">
              Inspectors judge "confidence in management" largely on whether your written system
              matches reality and whether the diary is genuinely kept up. A completed SFBB pack with
              three months of consistent entries and a couple of honest "here's what went wrong and
              what I did" notes tells a far better story than an immaculate binder with an empty diary.
            </p>
          </section>

          <GuideCta
            heading="Run SFBB in the app, or upload the pack you've already completed"
            body="MiseOS includes the SFBB safe methods for commercial, home and mobile kitchens, keeps the diary for you, and exports an inspection-ready pack per site. Already have a completed SFBB PDF? Upload it and log against it instead."
          />
        </article>
      </main>

      <GuideFooter />
    </div>
  );
}
