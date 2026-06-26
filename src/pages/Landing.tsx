import { useState } from "react";
import { motion } from "framer-motion";
import {
  Menu, X, Check, ArrowRight, ShieldCheck, FileText, Thermometer,
  SprayCan, ClipboardCheck, BookCheck, Wheat, AlertTriangle, Leaf,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import miseosLogo from "@/assets/miseos-logo.png";
import { SEO } from "@/components/SEO";

const AUTH_URL = "/auth";

// Brand palette
const BRAND_SAGE = "#3d8a6a";
const BRAND_LIGHT = "#6BAE8E";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" as const },
  transition: { duration: 0.5, ease: "easeOut" as const },
};

const Section = ({ id, className = "", children }: { id?: string; className?: string; children: React.ReactNode }) => (
  <section id={id} className={`py-20 md:py-24 px-4 ${className}`}>
    <motion.div {...fadeUp} className="max-w-6xl mx-auto">{children}</motion.div>
  </section>
);

function Nav() {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "#how", label: "How it works" },
    { href: "#features", label: "What it does" },
    { href: "#pricing", label: "Pricing" },
    { href: "#faq", label: "FAQ" },
  ];
  return (
    <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5">
          <img src={miseosLogo} alt="MiseOS logo" className="h-10 md:h-12 w-auto" />
          <span className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">MiseOS</span>
        </a>
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              {l.label}
            </a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-2">
          <a href={AUTH_URL}><Button variant="outline" size="sm">Log In</Button></a>
          <a href={AUTH_URL}>
            <Button size="sm" style={{ backgroundColor: BRAND_SAGE }} className="hover:opacity-90 text-white">
              Start Free Trial
            </Button>
          </a>
        </div>
        <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block text-sm text-slate-700 py-1">
              {l.label}
            </a>
          ))}
          <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
            <a href={AUTH_URL}><Button variant="outline" className="w-full">Log In</Button></a>
            <a href={AUTH_URL}>
              <Button className="w-full text-white" style={{ backgroundColor: BRAND_SAGE }}>Start Free Trial</Button>
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden px-4 pt-16 md:pt-24 pb-20 md:pb-28">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(60% 80% at 10% 0%, ${BRAND_LIGHT}22 0%, transparent 60%), radial-gradient(50% 70% at 90% 20%, ${BRAND_SAGE}1a 0%, transparent 60%)`,
        }}
      />
      <div className="max-w-5xl mx-auto text-center">
        <motion.div {...fadeUp}>
          <Badge variant="outline" className="mb-6 border-slate-300 text-slate-700 font-medium">
            For UK bakeries, cafés & independent kitchens
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 leading-[1.05]">
            Digital HACCP & food safety,{" "}
            <span style={{ color: BRAND_SAGE }}>without the paperwork</span>.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Replace paper diaries with simple digital logs. Stay inspection-ready every day —
            in minutes, not hours.
          </p>
          <div className="mt-9 flex flex-wrap gap-3 justify-center">
            <a href={AUTH_URL}>
              <Button size="lg" style={{ backgroundColor: BRAND_SAGE }} className="hover:opacity-90 text-white h-12 px-7 text-base font-semibold">
                Start 14-day free trial <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </a>
            <a href="#how">
              <Button size="lg" variant="outline" className="h-12 px-7 text-base">
                See how it works
              </Button>
            </a>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            No card required · Cancel anytime · 14-day free trial
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    { icon: Thermometer, title: "Temperatures", desc: "Log fridges, freezers, hot holding & cooking probes." },
    { icon: SprayCan, title: "Cleaning", desc: "Daily, weekly and deep-clean schedules with sign-off." },
    { icon: ClipboardCheck, title: "Day Sheet", desc: "Opening and closing checks the team can finish in minutes." },
    { icon: BookCheck, title: "HACCP Plan", desc: "Build and publish a written HACCP plan — share with your EHO." },
    { icon: Wheat, title: "Allergens & PPDS labels", desc: "Recipes, ingredients, Natasha's Law labels." },
    { icon: AlertTriangle, title: "Incidents & Pest", desc: "Log non-conformances, pest sightings and corrective actions." },
    { icon: FileText, title: "Inspection Pack", desc: "One-click EHO-ready PDF and Excel exports of all your records." },
    { icon: ShieldCheck, title: "Inspection Readiness score", desc: "See how close to a 5-star FHRS your records look every day." },
  ];
  return (
    <Section id="features" className="bg-slate-50">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Everything you need to stay compliant</h2>
        <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
          One simple app covering the records UK EHOs look for.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((f) => (
          <Card key={f.title} className="p-5 hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${BRAND_SAGE}1a` }}>
              <f.icon className="h-5 w-5" style={{ color: BRAND_SAGE }} />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">{f.title}</h3>
            <p className="text-sm text-slate-600">{f.desc}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "1", title: "Sign up in 60 seconds", desc: "Create your site, invite your team. No card, no setup call." },
    { n: "2", title: "Log on phone or tablet", desc: "Temperatures, cleaning, deliveries, incidents — all in one place." },
    { n: "3", title: "Stay inspection-ready", desc: "Export your Inspection Pack any time. Show the EHO with confidence." },
  ];
  return (
    <Section id="how">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">How it works</h2>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {steps.map((s) => (
          <div key={s.n} className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg text-white mb-4" style={{ backgroundColor: BRAND_SAGE }}>
              {s.n}
            </div>
            <h3 className="font-semibold text-lg text-slate-900 mb-2">{s.title}</h3>
            <p className="text-slate-600">{s.desc}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Pricing() {
  return (
    <Section id="pricing" className="bg-slate-50">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Simple pricing</h2>
        <p className="mt-3 text-slate-600">One plan. No surprises. Cancel anytime.</p>
      </div>
      <div className="max-w-xl mx-auto">
        <Card className="p-8 border-2" style={{ borderColor: BRAND_SAGE }}>
          <Badge className="text-white" style={{ backgroundColor: BRAND_SAGE }}>MiseOS HACCP</Badge>
          <div className="mt-4">
            <span className="text-5xl font-bold text-slate-900">£4.99</span>
            <span className="text-slate-600"> / site / month</span>
          </div>
          <p className="text-sm text-slate-600 mt-2">
            Includes 1 user. Each additional user: <strong>£1 / month</strong>.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Annual: pay for 10 months, get 12 (2 months free).
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-700">
            {[
              "All HACCP & food safety modules",
              "Inspection Pack (PDF + Excel)",
              "Unlimited records & 7-year retention",
              "Customer Feedback log",
              "14-day free trial, no card required",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: BRAND_SAGE }} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <a href={AUTH_URL} className="block mt-6">
            <Button size="lg" className="w-full text-white" style={{ backgroundColor: BRAND_SAGE }}>
              Start 14-day free trial
            </Button>
          </a>
          <p className="text-xs text-slate-500 text-center mt-3">No long contracts. Cancel anytime.</p>
        </Card>
        <p className="text-xs text-slate-500 text-center mt-6 flex items-center justify-center gap-1.5">
          <Leaf className="h-3.5 w-3.5" style={{ color: BRAND_SAGE }} />
          5% of every subscription goes to carbon removal via Stripe Climate.
        </p>
      </div>
    </Section>
  );
}

function FAQ() {
  const faqs = [
    { q: "Is MiseOS suitable for my small business?", a: "Yes. MiseOS is designed specifically for UK bakeries, cafés, independent kitchens and small restaurants — typically 1–5 sites." },
    { q: "Does it replace Safer Food Better Business (SFBB)?", a: "MiseOS digitises every diary record SFBB asks you to keep — temperatures, cleaning, opening/closing checks, supplier records, incidents and more — and lets you export them as an Inspection Pack." },
    { q: "Will my Environmental Health Officer accept digital records?", a: "Yes. UK EHOs accept digital food safety records. The Inspection Pack export is laid out so an inspector can read everything quickly." },
    { q: "What about my Food Hygiene Rating (FHRS)?", a: "MiseOS gives you an Inspection Readiness score and breakdown across the three FSA pillars (Hygiene, Premises, Confidence in Management) so you can address weak spots before an inspection." },
    { q: "How long does setup take?", a: "Most owners are logging within 10 minutes. There's no setup call, no card and no contract — just sign up and start." },
    { q: "What happens if I cancel?", a: "You keep access until the end of your billing period. Your data is retained for 7 years so you can re-export records if needed." },
  ];
  return (
    <Section id="faq">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Common questions</h2>
      </div>
      <div className="max-w-3xl mx-auto space-y-3">
        {faqs.map((f, i) => (
          <details key={i} className="group rounded-lg border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer font-medium text-slate-900 list-none flex items-center justify-between">
              {f.q}
              <span className="ml-2 text-slate-400 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
            </summary>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function CTA() {
  return (
    <Section className="text-center">
      <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Stop chasing paper. Start logging digitally.</h2>
      <p className="mt-4 text-slate-600 max-w-xl mx-auto">
        Try MiseOS free for 14 days. No card required.
      </p>
      <div className="mt-8">
        <a href={AUTH_URL}>
          <Button size="lg" style={{ backgroundColor: BRAND_SAGE }} className="hover:opacity-90 text-white h-12 px-7 text-base font-semibold">
            Start free trial <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </a>
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <img src={miseosLogo} alt="MiseOS logo" className="h-8 w-auto" />
          <span>© {new Date().getFullYear()} MiseOS · Built for UK food businesses</span>
        </div>
        <div className="flex items-center gap-5 text-sm text-slate-500">
          <a href="#pricing" className="hover:text-slate-900">Pricing</a>
          <a href="#faq" className="hover:text-slate-900">FAQ</a>
          <a href={AUTH_URL} className="hover:text-slate-900">Log in</a>
        </div>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <SEO
        title="MiseOS — Digital HACCP for UK Food Businesses"
        description="Digital HACCP, temperatures and cleaning logs for UK bakeries, cafés and small restaurants. Inspection-ready records. £4.99/site/month. 14-day free trial."
        path="/"
      />
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
