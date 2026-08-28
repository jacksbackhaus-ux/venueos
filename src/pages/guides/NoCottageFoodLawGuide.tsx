// DRAFT CONTENT — factual/regulatory claims need Jack's review before publishing.
import { Helmet } from "react-helmet-async";
import { SEO } from "@/components/SEO";
import {
  GuideBreadcrumb,
  GuideCta,
  GuideDisclaimer,
  GuideFooter,
  GuideHeader,
} from "@/components/guides/GuideShell";

const PATH = "/guides/no-cottage-food-law-uk";
const URL = `https://mise-os.app${PATH}`;
const TITLE = "There's No 'Cottage Food Law' in the UK — What Applies Instead";
const DESCRIPTION =
  "Cottage food laws are a US concept. Here's what UK home food businesses actually need: council registration, SFBB records, allergen info and a hygiene rating.";

export default function NoCottageFoodLawGuide() {
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
          <GuideBreadcrumb label="No cottage food law in the UK" />

          <h1 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            There's no "cottage food law" in the UK — here's what actually applies
          </h1>
          <p className="mt-4 text-lg text-slate-600 leading-relaxed">
            "Cottage food law" is an American term for state rules that let people sell certain
            low-risk homemade foods with light-touch oversight. The UK has no equivalent. Here, the
            same food hygiene rules apply whether you cook in a restaurant or your own kitchen — they're
            just applied proportionately to your size and risk.
          </p>
          <GuideDisclaimer />

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              Why the US framing doesn't translate
            </h2>
            <div className="mt-4 space-y-4 text-slate-700 leading-relaxed">
              <p>
                In the US, cottage food laws typically list approved products, cap annual sales and
                restrict where you can sell. Most of the advice you'll find online about "allowed
                foods" or "sales limits" comes from that system.
              </p>
              <p>
                UK food law doesn't work by product list or income cap. Instead, if you carry out a food
                business activity with some degree of organisation and continuity, you're a food
                business — and the same core duties apply to you as to any café
                [VERIFY: exact definition and regulation reference]. There's no threshold you stay
                under to opt out, and no separate category for home bakers.
              </p>
              <p>
                That sounds heavier than it is. Being in scope doesn't mean commercial-kitchen
                requirements; it means keeping your kitchen clean, understanding your risks and being
                able to show it.
              </p>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              What a UK home food business actually needs to do
            </h2>
            <ol className="mt-5 space-y-5">
              {[
                {
                  t: "Register with your local council",
                  b: "Registration is free, can't be refused, and should be done at least 28 days before you start trading [VERIFY: current registration lead time]. You register with the council for the area your kitchen is in, even if you sell elsewhere.",
                },
                {
                  t: "Put a HACCP-based food safety system in place",
                  b: "For most home bakers that means completing the FSA's free Safer Food, Better Business pack and keeping its diary, rather than writing a plan from scratch.",
                },
                {
                  t: "Keep the records that match what you make",
                  b: "Fridge and freezer temperatures on working days, cooking and cooling for high-risk items, a cleaning schedule, deliveries, and a note of anything that went wrong plus what you did about it.",
                },
                {
                  t: "Get allergen information right",
                  b: "You must be able to tell a customer about the 14 named allergens in what you sell. Prepacked-for-direct-sale items need a full ingredient list with allergens emphasised (often called Natasha's Law) [VERIFY: current PPDS labelling scope].",
                },
                {
                  t: "Train yourself to a sensible standard",
                  b: "There's no single mandatory certificate, but you must be trained in food hygiene proportionate to your work. A Level 2 Food Safety course is the common, inexpensive route and reassures inspectors and customers.",
                },
                {
                  t: "Expect an inspection and a hygiene rating",
                  b: "A council officer may visit your home kitchen. In England ratings are published under the Food Hygiene Rating Scheme; Wales and Northern Ireland require display [VERIFY: current display rules per nation]. Home businesses can and do score 5.",
                },
              ].map((s, i) => (
                <li key={s.t} className="flex gap-4">
                  <span className="shrink-0 h-7 w-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-900">{s.t}</h3>
                    <p className="mt-1 text-slate-600 leading-relaxed">{s.b}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-bold text-slate-900">
              Things that trip people up
            </h2>
            <div className="mt-4 space-y-4 text-slate-700 leading-relaxed">
              <p>
                <strong className="text-slate-900">Selling from home doesn't hide you.</strong> Council
                officers do look at social media and marketplace listings, and unregistered trading is
                the most common issue they raise with home businesses.
              </p>
              <p>
                <strong className="text-slate-900">Pets, family and shared space matter.</strong> You'll
                be asked how you separate business preparation from household life — surfaces, storage,
                pets kept out during production, separate cloths.
              </p>
              <p>
                <strong className="text-slate-900">Selling further afield changes things.</strong> Posting
                nationally, supplying shops or trading at events can bring extra considerations, from
                distance-selling information to a street trading consent or a separate stall
                registration [VERIFY: which activities require additional local permissions].
              </p>
              <p>
                <strong className="text-slate-900">Insurance isn't food law, but get it.</strong> Public
                and product liability cover is usually required by markets and is simply sensible once
                you're selling.
              </p>
            </div>
          </section>

          <GuideCta
            heading="Keep home-kitchen records without the paperwork pile"
            body="MiseOS was built with home bakers and market traders in mind: choose your production days, log the checks that apply to you, and export an inspection-ready pack when the council calls. £4.99 per site per month with a 14-day free trial."
          />
        </article>
      </main>

      <GuideFooter />
    </div>
  );
}
