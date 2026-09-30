// DRAFT CONTENT — competitor prices/facts need Jack's review before publishing.
import { Helmet } from "react-helmet-async";
import { ExternalLink } from "lucide-react";
import { SEO } from "@/components/SEO";
import {
  GuideBreadcrumb,
  GuideCta,
  GuideDisclaimer,
  GuideFooter,
  GuideHeader,
} from "@/components/guides/GuideShell";

const PATH = "/compare";
const URL = `https://mise-os.app${PATH}`;
const TITLE = "MiseOS vs Other UK Food Safety Apps: An Honest Comparison";
const DESCRIPTION =
  "A factual, sourced comparison of UK food safety apps for small food businesses — MiseOS, SFBB+, HACCPapp, FoodDocs, Navitas Safety and the free FSA SFBB pack. Prices checked 30 September 2026.";

// Date competitor prices and facts were last verified against the sources below.
const LAST_CHECKED = "30 September 2026";

// ---------------------------------------------------------------------------
// Comparison data — edit this array to update the page. One line per fact.
// Keep every claim factual and sourced; no superlatives about competitors.
// ---------------------------------------------------------------------------
type Competitor = {
  name: string;
  price: string;
  audience: string;
  difference: string;
  context: string;
  sources: { label: string; url: string; internal?: boolean }[];
};

const COMPARISON: Competitor[] = [
  {
    name: "MiseOS",
    price: "£4.99 per site per month, plus £1 per staff user",
    audience: "Home bakers, micro food businesses and small independent kitchens",
    difference: "HACCP/SFBB-aligned daily checks with batch and lot traceability included at this price",
    context:
      "MiseOS is built specifically for solo and small operators: home bakers, market traders, micro bakeries and small independent kitchens. Daily opening and closing checks follow the SFBB structure inspectors recognise, and batch and lot traceability — recording which ingredient lots went into which batch — is included in the base price rather than sold as an add-on. Sites for commercial, home, mobile and prep/production kitchens are all supported.",
    sources: [{ label: "MiseOS pricing", url: "/pricing", internal: true }],
  },
  {
    name: "SFBB+",
    price: "£4.99 per month",
    audience: "Sole traders moving from paper to digital for the first time",
    difference: "A direct digital version of the FSA's paper SFBB pack",
    context:
      "SFBB+ takes the FSA's paper Safer Food, Better Business pack and reproduces it digitally, so the structure will feel immediately familiar if you've used the paper version. It's aimed at sole traders who want to stop keeping paper records without learning a new system.",
    sources: [
      {
        label: "Culinary Key: best food safety apps for UK businesses 2026",
        url: "https://www.culinarykey.co.uk/resources/the-best-food-safety-apps-for-uk-businesses-in-2026",
      },
      { label: "SFBB+ App Store listing", url: "https://apps.apple.com/gb/app/sfbb/id1405688537" },
    ],
  },
  {
    name: "HACCPapp",
    price: "From £9.99 per month",
    audience: "Small UK food businesses wanting SFBB-aligned digital checks",
    difference: "Positions itself as a low-cost HACCP app with SFBB-aligned daily checks",
    context:
      "HACCPapp offers SFBB-aligned daily checks in a digital format and describes itself as an affordable HACCP option for UK businesses. Pricing starts from £9.99 per month according to its website.",
    sources: [{ label: "HACCPapp UK website", url: "https://haccpapp.net/uk/" }],
  },
  {
    name: "FoodDocs",
    price: "Approximately €84–€299 per month depending on plan (approximate — check their site directly)",
    audience: "Restaurants, retail food-to-go, and multi-site or healthcare kitchens",
    difference: "AI-assisted HACCP plan building aimed at larger and multi-site operations",
    context:
      "FoodDocs is aimed at restaurants, retail food-to-go and larger operations including multi-site and healthcare kitchens, and includes AI-assisted HACCP plan building. Published pricing varies by source and currency — third-party listings show a Basic plan around €84 per month and Professional plans around €250–€299 per month — so treat these figures as approximate and confirm current pricing on the FoodDocs website.",
    sources: [
      { label: "Toolradar: FoodDocs pricing", url: "https://toolradar.com/tools/fooddocs/pricing" },
      { label: "FitGap: FoodDocs product page", url: "https://us.fitgap.com/products/fooddocs" },
    ],
  },
  {
    name: "Navitas Safety",
    price: "Custom pricing — contact required, no public price list",
    audience: "Multi-site hospitality and retail chains",
    difference: "Enterprise-focused compliance platform for chains rather than single sites",
    context:
      "Navitas Safety is built for multi-site hospitality and retail chains. It doesn't publish a price list; pricing is provided on request and is structured for enterprise deployments.",
    sources: [
      { label: "Capterra UK: Navitas Compliance", url: "https://www.capterra.co.uk/software/200496/navitas-compliance" },
    ],
  },
  {
    name: "Leafe",
    price: "No public price list — pricing is provided on request",
    audience: "Restaurants, hotels and pub groups",
    difference: "Broader kitchen operations platform that includes food hygiene records, not a food-safety-only tool",
    context:
      "Leafe is a Bristol-founded app whose clients include Sofitel Hotels & Resorts and Star Pubs & Bars. Alongside hygiene record-keeping, it covers rota and shift scheduling, time-tracking, inventory and food waste management, so it positions itself as a broader kitchen operations platform rather than a food-safety-only tool. No public pricing is listed; interested businesses need to contact them directly.",
    sources: [
      { label: "Leafe App Store listing", url: "https://apps.apple.com/app/id1562506324" },
      { label: "Leafe company profile (Welcome to the Jungle)", url: "https://app.welcometothejungle.com/companies/Leafe-2" },
    ],
  },
  {
    name: "FSA Safer Food, Better Business (SFBB) pack",
    price: "Free",
    audience: "Small caterers — the framework most UK apps are built around",
    difference: "The original paper-based system from the Food Standards Agency",
    context:
      "The FSA's SFBB pack is free and paper-based, and it's the framework that most UK food safety apps — including MiseOS — are built around. If you're happy keeping paper records and a handwritten diary, it remains a perfectly valid way to meet your legal obligations.",
    sources: [
      {
        label: "Food Standards Agency: Safer Food, Better Business",
        url: "https://www.food.gov.uk/business-guidance/safer-food-better-business-sfbb",
      },
    ],
  },
];

export default function Compare() {
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: DESCRIPTION,
    inLanguage: "en-GB",
    dateModified: "2026-09-30",
    mainEntityOfPage: { "@type": "WebPage", "@id": URL },
    author: { "@type": "Organization", name: "MiseOS", url: "https://mise-os.app" },
    publisher: { "@type": "Organization", name: "MiseOS", url: "https://mise-os.app" },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://mise-os.app/" },
      { "@type": "ListItem", position: 2, name: "Compare", item: URL },
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
          <GuideBreadcrumb label="Compare" />

          <h1 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            MiseOS vs other UK food safety apps
          </h1>
          <p className="mt-4 text-lg text-slate-600 leading-relaxed">
            A factual look at the main options for digital food safety records in the UK — what each
            costs, who it's aimed at, and how it differs. We've linked the source for every price so
            you can check it yourself.
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Last checked: {LAST_CHECKED}. Prices and features change — if you spot anything out of
            date, please{" "}
            <a
              href="mailto:hello@mise-os.app"
              className="underline underline-offset-4 decoration-slate-300 hover:text-slate-900"
            >
              let us know
            </a>{" "}
            and we'll correct it.
          </p>
          <GuideDisclaimer />

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-bold text-slate-900">At a glance</h2>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-slate-900">
                  <tr>
                    <th className="px-4 py-3 font-semibold">App</th>
                    <th className="px-4 py-3 font-semibold">Price</th>
                    <th className="px-4 py-3 font-semibold">Aimed at</th>
                    <th className="px-4 py-3 font-semibold">Key difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {COMPARISON.map((c) => (
                    <tr key={c.name}>
                      <td className="px-4 py-3 font-medium text-slate-900 align-top">{c.name}</td>
                      <td className="px-4 py-3 align-top">{c.price}</td>
                      <td className="px-4 py-3 align-top">{c.audience}</td>
                      <td className="px-4 py-3 align-top">{c.difference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-12 space-y-10">
            <h2 className="font-heading text-2xl font-bold text-slate-900">Each option in turn</h2>
            {COMPARISON.map((c) => (
              <div key={c.name}>
                <h3 className="font-heading text-xl font-bold text-slate-900">{c.name}</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">{c.price}</p>
                <p className="mt-3 text-slate-700 leading-relaxed">{c.context}</p>
              </div>
            ))}
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              Why a home baker or micro business might pick MiseOS
            </h2>
            <p className="mt-4 text-slate-700 leading-relaxed">
              MiseOS costs the same per month as the cheapest paid option on this page. The
              difference is who it was designed for: it's built from the ground up for solo and
              small operators rather than being a cut-down version of a tool aimed at chains, and
              batch and lot traceability is included in the base price. It was also built by a
              founder who runs a micro bakery himself, so the daily checks reflect how a one-person
              kitchen actually runs. Whether that matters more than another app's particular
              features is for you to judge — the sources above are there so you can compare
              directly.
            </p>
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-bold text-slate-900">Sources</h2>
            <p className="mt-3 text-sm text-slate-600">
              All prices and descriptions above were checked against these sources on {LAST_CHECKED}.
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
              {COMPARISON.flatMap((c) =>
                c.sources.map((s) => (
                  <li key={s.url} className="flex gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                    <span>
                      <span className="font-medium text-slate-900">{c.name}:</span>{" "}
                      {s.internal ? (
                        <a
                          href={s.url}
                          className="underline underline-offset-4 decoration-slate-300 hover:text-slate-900"
                        >
                          {s.label}
                        </a>
                      ) : (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-4 decoration-slate-300 hover:text-slate-900 inline-flex items-center gap-1"
                        >
                          {s.label}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </span>
                  </li>
                )),
              )}
            </ul>
          </section>

          <GuideCta
            heading="Try MiseOS free for 14 days"
            body="Card required, but no charge until your trial ends. Set up takes a few minutes, and your first site works for commercial, home, mobile or prep kitchens."
          />
        </article>
      </main>

      <GuideFooter />
    </div>
  );
}
