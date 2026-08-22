import { useState } from "react";
import { motion } from "framer-motion";
import {
  Menu, X, Check, ArrowRight, ShieldCheck, FileText, Thermometer,
  SprayCan, ClipboardCheck, BookCheck, Wheat, AlertTriangle, Leaf,
  Truck, GraduationCap, WifiOff, Home, Store, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import miseosLogo from "@/assets/miseos-logo.png";
import { SEO } from "@/components/SEO";

const AUTH_URL = "/auth";
const SIGNUP_URL = "/auth?mode=signup";

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
          <img src={miseosLogo} alt="MiseOS — Digital HACCP software for UK food businesses" className="h-10 md:h-12 w-auto" />
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
          <a href={SIGNUP_URL}>
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
            <a href={SIGNUP_URL}>
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
            Built for UK bakeries, cafés & independent kitchens
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 leading-[1.05]">
            Food safety records done.{" "}
            <span style={{ color: BRAND_SAGE }}>Before the inspector walks in</span>.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Replace paper diaries with simple digital logs. Log temperatures, cleaning, deliveries and incidents in minutes — then export an EHO-ready Inspection Pack whenever you need it.
          </p>
          <div className="mt-9 flex flex-wrap gap-3 justify-center">
            <a href={SIGNUP_URL}>
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
            Card required. No charge until your trial ends. Cancel anytime.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    { icon: Thermometer, title: "Temperature logs", desc: "Fridge, freezer, hot-holding and probe checks — logged in seconds with corrective actions." },
    { icon: SprayCan, title: "Cleaning schedules", desc: "Daily, weekly and deep-clean tasks with sign-off, reminders and missed-task alerts." },
    { icon: ClipboardCheck, title: "Day Sheet", desc: "Opening and closing checks the team can finish in minutes, every day." },
    { icon: BookCheck, title: "HACCP Plan", desc: "Build and publish a written food safety management system — ready to share with your EHO." },
    { icon: Wheat, title: "Allergens & PPDS", desc: "Track ingredients, recipes and Natasha's Law labels in one place." },
    { icon: Truck, title: "Batch & Traceability", desc: "Log batches, mark used, sold or disposed, and trace ingredients from delivery to sale." },
    { icon: AlertTriangle, title: "Incidents & Pest", desc: "Record non-conformances, pest sightings, maintenance issues and the fix you applied." },
    { icon: GraduationCap, title: "Staff Training", desc: "Assign, record and track food hygiene and safety training for every team member." },
    { icon: FileText, title: "Inspection Pack", desc: "One-click EHO-ready PDF and Excel export of all your records." },
    { icon: ShieldCheck, title: "Inspection Readiness score", desc: "See how close your records look to a 5-star Food Hygiene Rating every day." },
    { icon: WifiOff, title: "Works offline", desc: "Log on your phone even without signal. Entries sync automatically when you're back online." },
  ];
  return (
    <Section id="features" className="bg-slate-50">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">What MiseOS does for you</h2>
        <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
          The daily and weekly records UK Environmental Health Officers expect, all in one simple app.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
    {
      n: "1",
      title: "Set up your site in minutes",
      desc: "Pick your premises type — home kitchen, commercial premises, mobile / market stall or production kitchen — then add your staff, fridges and freezers, cleaning schedules and food safety procedures.",
      highlight: "No sales call. No complicated setup.",
    },
    {
      n: "2",
      title: "Log as you work",
      desc: "Log temperatures, tick off cleaning tasks, record production batches, track staff training and report incidents as they happen — not hours later from memory.",
      highlight: "Works on phone, tablet and desktop — and keeps logging offline when your signal drops.",
    },
    {
      n: "3",
      title: "Stay ready for inspections",
      desc: "Generate an Inspection Pack instantly, keep every record stored securely, hold staff training records in one place and maintain your SFBB-style documentation — so you can hand your Environmental Health Officer what they ask for on the spot.",
      highlight: "Everything an EHO asks for, in one export.",
    },
  ];
  return (
    <Section id="how">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">How it works</h2>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {steps.map((s) => (
          <div key={s.n} className="text-center md:text-left">
            <div className="mx-auto md:mx-0 h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg text-white mb-4" style={{ backgroundColor: BRAND_SAGE }}>
              {s.n}
            </div>
            <h3 className="font-semibold text-lg text-slate-900 mb-2">{s.title}</h3>
            <p className="text-slate-600">{s.desc}</p>
            <p className="mt-3 text-sm font-semibold" style={{ color: BRAND_SAGE }}>{s.highlight}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── Lightweight, accurate in-app previews (real markup, not stock imagery) ── */

const PreviewFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 bg-slate-50">
      <span className="h-2 w-2 rounded-full bg-slate-300" />
      <span className="h-2 w-2 rounded-full bg-slate-300" />
      <span className="h-2 w-2 rounded-full bg-slate-300" />
    </div>
    <div className="p-3 space-y-2 text-[11px]">{children}</div>
  </div>
);

const Row = ({ label, value, tone = "ok" }: { label: string; value: string; tone?: "ok" | "warn" | "muted" }) => (
  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2">
    <span className="text-slate-700">{label}</span>
    <span
      className="font-semibold"
      style={{ color: tone === "ok" ? BRAND_SAGE : tone === "warn" ? "#b45309" : "#64748b" }}
    >
      {value}
    </span>
  </div>
);

function InAction() {
  const cards = [
    {
      title: "Dashboard",
      caption: "See today's food safety status at a glance.",
      preview: (
        <PreviewFrame>
          <div className="rounded-lg px-2.5 py-3" style={{ backgroundColor: `${BRAND_SAGE}14` }}>
            <p className="font-bold text-slate-900 text-sm">Safe to trade</p>
            <p className="text-slate-600">All critical checks complete</p>
          </div>
          <Row label="Opening checks" value="Done" />
          <Row label="Temperatures" value="6 of 6" />
          <Row label="Cleaning" value="1 due" tone="warn" />
        </PreviewFrame>
      ),
    },
    {
      title: "Temperature logging",
      caption: "Record temperatures quickly from any device.",
      preview: (
        <PreviewFrame>
          <Row label="Walk-in fridge" value="3.1 °C" />
          <Row label="Under-counter fridge" value="4.6 °C" />
          <Row label="Chest freezer" value="-19 °C" />
          <Row label="Display chiller" value="9.2 °C — fix logged" tone="warn" />
        </PreviewFrame>
      ),
    },
    {
      title: "Cleaning schedule",
      caption: "Track completed and overdue cleaning tasks.",
      preview: (
        <PreviewFrame>
          <Row label="Prep surfaces" value="Signed off" />
          <Row label="Mixer & attachments" value="Signed off" />
          <Row label="Floor drains" value="Overdue" tone="warn" />
          <Row label="Deep clean — oven" value="Due Friday" tone="muted" />
        </PreviewFrame>
      ),
    },
    {
      title: "Batch & traceability",
      caption: "Keep production records and traceability organised.",
      preview: (
        <PreviewFrame>
          <Row label="SD-0912 Sourdough" value="Sold" />
          <Row label="CR-0913 Croissants" value="In production" tone="muted" />
          <Row label="CK-0914 Custard tarts" value="Chilling" tone="muted" />
          <Row label="Flour lot 88421" value="Traced" />
        </PreviewFrame>
      ),
    },
    {
      title: "Staff training",
      caption: "Track training, certificates and renewals.",
      preview: (
        <PreviewFrame>
          <Row label="Level 2 Food Hygiene" value="4 of 4" />
          <Row label="Allergen awareness" value="3 of 4" tone="warn" />
          <Row label="Fitness to work" value="Signed" />
          <Row label="Renewal due" value="Mar 2027" tone="muted" />
        </PreviewFrame>
      ),
    },
    {
      title: "Inspection Pack",
      caption: "Generate everything your Environmental Health Officer needs in seconds.",
      preview: (
        <PreviewFrame>
          <Row label="Readiness score" value="92 / 100" />
          <Row label="Temperature records" value="Included" />
          <Row label="Cleaning & SFBB" value="Included" />
          <Row label="Export" value="PDF + Excel" tone="muted" />
        </PreviewFrame>
      ),
    },
  ];
  return (
    <Section id="in-action" className="bg-slate-50">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">See MiseOS in action</h2>
        <p className="mt-3 text-slate-600">A quick look at the tools food businesses use every day.</p>
      </div>

      {/* Mobile: swipeable. Desktop: grid. */}
      <div className="md:hidden -mx-4 px-4 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cards.map((c) => (
          <Card key={c.title} className="p-4 shrink-0 w-[80vw] max-w-[320px] snap-center">
            {c.preview}
            <h3 className="mt-4 font-semibold text-slate-900">{c.title}</h3>
            <p className="text-sm text-slate-600 mt-1">{c.caption}</p>
          </Card>
        ))}
      </div>
      <p className="md:hidden text-center text-xs text-slate-500 mt-1">Swipe to see more →</p>

      <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.title} className="p-4 hover:shadow-md transition-shadow">
            {c.preview}
            <h3 className="mt-4 font-semibold text-slate-900">{c.title}</h3>
            <p className="text-sm text-slate-600 mt-1">{c.caption}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function TypicalDay() {
  const flow = [
    { label: "Open MiseOS", desc: "Your day starts with what needs attention." },
    { label: "Complete opening checks or start a production day", desc: "One tap for on-demand and home kitchens." },
    { label: "Log temperatures", desc: "Fridges, freezers, hot-holding and probes." },
    { label: "Record cleaning tasks", desc: "Tick off and sign as you go." },
    { label: "Log production batches", desc: "Traceable from ingredient to sale." },
    { label: "Complete end-of-day records", desc: "Closing checks, waste and incidents." },
    { label: "Stay inspection ready", desc: "Records are filed and exportable instantly." },
  ];
  return (
    <Section id="typical-day">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">A typical day with MiseOS</h2>
        <p className="mt-3 text-slate-600">Around five minutes of logging, spread across the day.</p>
      </div>
      <ol className="max-w-2xl mx-auto relative">
        <span aria-hidden className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200" />
        {flow.map((f, i) => (
          <li key={f.label} className="relative pl-11 pb-6 last:pb-0">
            <span
              className="absolute left-0 top-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: i === flow.length - 1 ? BRAND_SAGE : BRAND_LIGHT }}
            >
              {i + 1}
            </span>
            <p className="font-semibold text-slate-900">{f.label}</p>
            <p className="text-sm text-slate-600">{f.desc}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function EveryStage() {
  const cards = [
    {
      icon: Home,
      title: "Home bakers",
      desc: "Run a compliant home food business with production-day logging and simple food safety records.",
    },
    {
      icon: Store,
      title: "Independent shops & cafés",
      desc: "Manage temperatures, cleaning, training and inspections from one place.",
    },
    {
      icon: Building2,
      title: "Multi-site businesses",
      desc: "Track compliance across multiple locations while keeping records separate for each site.",
    },
  ];
  return (
    <Section id="stages" className="bg-slate-50">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Built for businesses at every stage</h2>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.title} className="p-5">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${BRAND_SAGE}1a` }}>
              <c.icon className="h-5 w-5" style={{ color: BRAND_SAGE }} />
            </div>
            <h3 className="font-semibold text-slate-900 mb-1">{c.title}</h3>
            <p className="text-sm text-slate-600">{c.desc}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function Trust() {
  const points = [
    "Supports SFBB-style food safety management",
    "Inspection Pack exports",
    "Temperature records",
    "Cleaning records",
    "Staff training records",
    "Batch traceability",
    "Multi-site support",
    "Home kitchen support",
  ];
  return (
    <Section id="trust">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Built around UK food safety requirements</h2>
      </div>
      <div className="max-w-3xl mx-auto">
        <ul className="grid sm:grid-cols-2 gap-3">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-slate-700">
              <Check className="h-4 w-4 mt-1 shrink-0" style={{ color: BRAND_SAGE }} />
              <span>{p}</span>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-xs text-slate-500 text-center leading-relaxed">
          MiseOS helps food businesses maintain digital food safety records. Businesses remain responsible for meeting all legal food safety requirements.
        </p>
      </div>
    </Section>
  );
}


function Pricing() {
  return (
    <Section id="pricing" className="bg-slate-50">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Simple pricing</h2>
        <p className="mt-3 text-slate-600">One plan. No tiers. No hidden fees. Cancel anytime.</p>
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
            Pay annually and get 2 months free (equivalent to £49.90/year).
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-700">
            {[
              "All HACCP & food safety modules",
              "Inspection Pack (PDF + Excel)",
              "Unlimited records & 7-year retention",
              "Offline logging on mobile",
              "Customer Feedback log",
              "14-day free trial",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="h-4 w-4 mt-0.5 shrink-0" style={{ color: BRAND_SAGE }} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <a href={SIGNUP_URL} className="block mt-6">
            <Button size="lg" className="w-full text-white" style={{ backgroundColor: BRAND_SAGE }}>
              Start 14-day free trial
            </Button>
          </a>
          <p className="text-xs text-slate-500 text-center mt-3">Card required. No charge until trial ends. Cancel anytime.</p>
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
    { q: "Is MiseOS suitable for my small business?", a: "Yes. MiseOS is built for UK bakeries, cafés, home kitchens, food trucks and small restaurants — typically 1–5 sites. Whether you bake from home or run a small commercial kitchen, the app adapts to your premises type." },
    { q: "I'm a home baker. Can I use MiseOS?", a: "Absolutely. Home kitchens and mobile food businesses are first-class premises types in MiseOS. You get a kitchen setup checklist, markets & events log, and simplified supplier records alongside all the standard food safety logs." },
    { q: "Do I need a card to start the trial?", a: "Yes, a card is required to start the trial, but you won't be charged until the 14-day trial ends. Cancel anytime before then and nothing is billed." },
    { q: "Does it work on mobile?", a: "Yes. MiseOS is designed for phones and tablets first. Your team can log temperatures, cleaning and checks while moving around the kitchen, and it works offline when your signal drops." },
    { q: "Will my Environmental Health Officer accept digital records?", a: "Yes. UK EHOs accept digital food safety records. MiseOS exports an Inspection Pack in PDF and Excel with all the records they look for, laid out clearly so they can find what they need quickly." },
    { q: "Does it replace Safer Food Better Business (SFBB)?", a: "MiseOS digitises the diary records SFBB asks you to keep — temperatures, cleaning, opening/closing checks, supplier records, incidents, training and more — and lets you export them as an Inspection Pack." },
    { q: "How much do extra users cost?", a: "Each additional active user is £1 per month. The first user is included in the £4.99/site/month price. You can add or deactivate users as your team changes." },
    { q: "Can I use MiseOS for multiple sites?", a: "Yes. Each site is £4.99/month with its own records, fridges, team and Inspection Pack. If you move to a new site, you can run a 14-day transfer window with both sites active while only paying for one." },
    { q: "What happens if I cancel?", a: "You keep full access until the end of your billing period. Your records are retained for 7 years so you can re-export them whenever needed." },
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
        Start your 14-day free trial today. Card required; no charge until the trial ends. Cancel anytime.
      </p>
      <div className="mt-8">
        <a href={SIGNUP_URL}>
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
          <img src={miseosLogo} alt="MiseOS — Digital HACCP software for UK food businesses" className="h-8 w-auto" />
          <span>© {new Date().getFullYear()} MiseOS · Built for UK food businesses</span>
        </div>
        <div className="flex items-center gap-5 text-sm text-slate-500">
          <a href="/guides/bakery-haccp-compliance" className="hover:text-slate-900">HACCP guide for bakeries</a>
          <a href="/guides/sfbb-caterers-compliance" className="hover:text-slate-900">SFBB for caterers</a>
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
        description="Digital HACCP, temperature logs and cleaning schedules for UK bakeries, cafés and small restaurants. 14-day trial."
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
