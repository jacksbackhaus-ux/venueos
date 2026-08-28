// DRAFT CONTENT — factual/regulatory claims need Jack's review before publishing.
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import { GuideFooter, GuideHeader } from "@/components/guides/GuideShell";

const PATH = "/guides";
const URL = `https://mise-os.app${PATH}`;
const TITLE = "Food Safety Hub — Plain-English UK Guides | MiseOS";
const DESCRIPTION =
  "Plain-English guides to HACCP, SFBB, EHO inspections and food hygiene ratings for UK bakeries, cafés, home bakers and mobile food businesses.";

export const HUB_GUIDES = [
  {
    to: "/guides/records-for-solo-food-businesses",
    title: "How simple can your food safety records legally be if it's just you?",
    summary:
      "What proportionate record-keeping actually looks like for a home baker, market trader or one-person kitchen.",
    read: "7 min read",
  },
  {
    to: "/guides/no-cottage-food-law-uk",
    title: "There's no 'cottage food law' in the UK — here's what actually applies",
    summary:
      "Why the American term doesn't fit here, and what UK home food businesses genuinely need to do instead.",
    read: "6 min read",
  },
  {
    to: "/guides/sfbb-vs-haccp",
    title: "SFBB vs HACCP: which does my café or bakery need?",
    summary:
      "SFBB is the FSA's ready-made system for small caterers. Here's how to tell whether it covers you.",
    read: "6 min read",
  },
];

const MORE = [
  { to: "/guides/bakery-haccp-compliance", label: "HACCP for bakeries: the UK compliance guide" },
  { to: "/guides/sfbb-caterers-compliance", label: "Safer Food, Better Business for caterers" },
  { to: "/haccp", label: "What is HACCP? A beginner's explainer" },
];

export default function GuidesIndex() {
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Food Safety Hub",
    description: DESCRIPTION,
    inLanguage: "en-GB",
    mainEntityOfPage: { "@type": "WebPage", "@id": URL },
    publisher: { "@type": "Organization", name: "MiseOS", url: "https://mise-os.app" },
    hasPart: HUB_GUIDES.map((g) => ({
      "@type": "Article",
      headline: g.title,
      description: g.summary,
      url: `https://mise-os.app${g.to}`,
    })),
  };

  return (
    <div className="min-h-screen bg-white">
      <SEO title={TITLE} description={DESCRIPTION} path={PATH} />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(ld)}</script>
      </Helmet>
      <GuideHeader />

      <main className="max-w-5xl mx-auto px-4 py-10 md:py-14">
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
          Food Safety Hub
        </h1>
        <p className="mt-4 text-lg text-slate-600 leading-relaxed max-w-3xl">
          Plain-English guides to HACCP, SFBB, EHO inspections and food hygiene ratings for UK small
          food businesses — bakeries, cafés, home bakers, market traders and mobile food businesses.
          No jargon, no scare stories, just what actually applies to a business your size.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {HUB_GUIDES.map((g) => (
            <Link key={g.to} to={g.to} className="group">
              <Card className="h-full p-5 border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all flex flex-col">
                <h2 className="font-heading text-lg font-bold text-slate-900 leading-snug">
                  {g.title}
                </h2>
                <p className="mt-2.5 text-sm text-slate-600 leading-relaxed flex-1">{g.summary}</p>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {g.read}
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-700 group-hover:gap-2 transition-all">
                    Read <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <section className="mt-14">
          <h2 className="font-heading text-xl font-bold text-slate-900">More on the hub</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {MORE.map((m) => (
              <li key={m.to}>
                <Link
                  to={m.to}
                  className="text-slate-700 hover:text-slate-900 underline underline-offset-4 decoration-slate-300"
                >
                  {m.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/faq"
                className="text-slate-700 hover:text-slate-900 underline underline-offset-4 decoration-slate-300"
              >
                Food safety FAQ — short answers to the questions we get asked most
              </Link>
            </li>
          </ul>
        </section>

        <p className="mt-10 text-xs text-slate-500 max-w-3xl">
          General guidance for UK food businesses, not legal advice. Check current FSA guidance and
          speak to your local council's environmental health team about your own premises.
        </p>
      </main>

      <GuideFooter />
    </div>
  );
}
