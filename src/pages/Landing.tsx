import { useState } from "react";
import { motion } from "framer-motion";
import {
  Menu, X, Check, ArrowRight, ShieldCheck, Smartphone, Archive, Scale,
  LayoutDashboard, CalendarDays, Repeat, Clock, MessageSquare, ClipboardCheck,
  Thermometer, Sparkles, Trash2, Star, Tag, Truck, Bug, Wrench,
  AlertTriangle, Boxes, GraduationCap, FileText, PoundSterling, Coins,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import miseosLogo from "@/assets/miseos-logo.png";

const AUTH_URL = "https://mise-os.lovable.app/auth";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: "easeOut" },
};

const Section = ({ id, className = "", children }: { id?: string; className?: string; children: React.ReactNode }) => (
  <section id={id} className={`py-20 md:py-28 px-4 ${className}`}>
    <motion.div {...fadeUp} className="max-w-6xl mx-auto">{children}</motion.div>
  </section>
);

// ───── Nav ─────
function Nav() {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "#features", label: "Features" },
    { href: "#pricing", label: "Pricing" },
    { href: "#compliance", label: "Compliance" },
    { href: "#faq", label: "FAQ" },
  ];
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
        <a href="#top" className="flex items-center">
          <img src={miseosLogo} alt="MiseOS" className="h-12 md:h-14 w-auto" />
        </a>
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              {l.label}
            </a>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-2">
          <a href={AUTH_URL}>
            <Button variant="outline" size="sm">Log In</Button>
          </a>
          <a href={AUTH_URL}>
            <Button size="sm" className="bg-[#3d8a6a] hover:bg-[#2f6d54]">Start Free Trial</Button>
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
            <a href={AUTH_URL}><Button className="w-full bg-[#3d8a6a] hover:bg-[#2f6d54]">Start Free Trial</Button></a>
          </div>
        </div>
      )}
    </nav>
  );
}

// ───── Hero ─────
function Hero() {
  const trustBadges = [
    { icon: ShieldCheck, text: "FSA Safer Food Better Business aligned" },
    { icon: Smartphone, text: "Mobile-first — works on any device" },
    { icon: Archive, text: "7-year data retention — EHO inspection ready" },
    { icon: Scale, text: "Built for UK food safety law" },
  ];
  return (
    <section id="top" className="pt-16 md:pt-24 pb-16 px-4">
      <motion.div {...fadeUp} className="max-w-4xl mx-auto text-center">
        <Badge className="mb-6 bg-green-100 text-green-700 hover:bg-green-100 border-0 px-4 py-1.5 rounded-full font-medium">
          ✨ 14-day free trial — no card required
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 mb-6 leading-tight">
          The operating system for independent food businesses
        </h1>
        <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-3xl mx-auto leading-relaxed">
          MiseOS replaces your spreadsheets, paper logs, and fragmented apps with one interconnected
          platform — built for artisan bakeries, cafés, and small restaurants in the UK.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
          <a href={AUTH_URL}>
            <Button size="lg" className="bg-[#3d8a6a] hover:bg-[#2f6d54] text-base px-8 h-12 w-full sm:w-auto">
              Start Free Trial <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </a>
          <a href="#features">
            <Button size="lg" variant="outline" className="text-base px-8 h-12 w-full sm:w-auto">
              See how it works
            </Button>
          </a>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {trustBadges.map((b, i) => (
            <div key={i} className="flex flex-col md:flex-row items-center gap-2 text-xs md:text-sm text-slate-600 text-center md:text-left">
              <b.icon className="w-5 h-5 text-[#3d8a6a] flex-shrink-0" />
              <span>{b.text}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

// ───── Problem ─────
function Problem() {
  const cards = [
    { emoji: "📋", title: "Drowning in paper", body: "You're running temperature logs on clipboards, cleaning schedules on laminated sheets, and day sheets in a ring binder that nobody looks at until the EHO turns up." },
    { emoji: "🧩", title: "Five apps that don't talk to each other", body: "One app for rotas, another for messaging, a spreadsheet for costing, a folder for training certificates. Nothing connects. You're the glue." },
    { emoji: "💸", title: "Paying for features you'll never use", body: "Enterprise platforms like Deputy and Toast charge hundreds a month for features designed for chains with 50 locations. You have one bakery and three staff." },
  ];
  return (
    <Section id="problem" className="bg-slate-50">
      <h2 className="text-3xl md:text-5xl font-bold text-center text-slate-900 mb-14">Sound familiar?</h2>
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {cards.map((c, i) => (
          <Card key={i} className="p-6 rounded-2xl border-slate-200">
            <div className="text-4xl mb-4">{c.emoji}</div>
            <h3 className="font-semibold text-lg text-slate-900 mb-2">{c.title}</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{c.body}</p>
          </Card>
        ))}
      </div>
      <p className="text-center text-lg text-slate-700 max-w-3xl mx-auto leading-relaxed">
        MiseOS was built by a bakery owner who had exactly these problems. It does what you need,
        nothing you don't, and costs less than your Netflix subscription.
      </p>
    </Section>
  );
}

// ───── Features ─────
const FEATURES = {
  daily: [
    { icon: LayoutDashboard, title: "Dashboard", desc: "Your command centre. Today's checklist, compliance score, shift schedule, alerts, and inspection readiness — all on one screen." },
    { icon: CalendarDays, title: "Shifts & Rota", desc: "Weekly and daily rota builder with linked compliance tasks per shift and automatic Messenger notifications." },
    { icon: Repeat, title: "Shift Hive", desc: "Staff request swaps and cover. Managers approve with one tap. Late cancellations auto-log compensation under the Employment Rights Bill 2025-26." },
    { icon: Clock, title: "Timesheets", desc: "Clock in, clock out, log breaks. Export to CSV for Xero, Sage, and BrightPay." },
    { icon: MessageSquare, title: "Messenger", desc: "Built-in team chat with channels, DMs, pinned messages, tasks, acknowledgements, and shift handover notes." },
    { icon: ClipboardCheck, title: "Day Sheet", desc: "Configurable opening and closing checks based on FSA Safer Food Better Business. Lock and sign off with full audit trail." },
    { icon: Thermometer, title: "Temperature Tracking", desc: "Log fridge, freezer, and probe temps with a tap-friendly keypad. Breach detection with mandatory corrective actions." },
    { icon: Sparkles, title: "Cleaning Schedule", desc: "Daily, weekly, and monthly tasks. Full audit history including missed days." },
    { icon: Trash2, title: "Waste Log", desc: "Track food waste by category. Spot trends with weekly bar charts." },
    { icon: Star, title: "Customer Feedback", desc: "Capture, categorise, resolve, and trend customer feedback from any source." },
  ],
  compliance: [
    { icon: Tag, title: "Allergens & Labels", desc: "Build recipes from ingredients with 14 declared allergens. Auto-generate PPDS labels compliant with Natasha's Law." },
    { icon: Truck, title: "Suppliers & Deliveries", desc: "Approved supplier list. Log deliveries with temperature, packaging, and use-by checks." },
    { icon: Bug, title: "Pest & Maintenance", desc: "Report sightings and issues. Preventative check schedules with overdue alerts." },
    { icon: Wrench, title: "PPM Schedule", desc: "Planned preventative maintenance with configurable frequencies and cost tracking." },
    { icon: AlertTriangle, title: "Incidents", desc: "Three-stage workflow: Open → Action Taken → Verified. Root cause analysis and corrective actions." },
    { icon: Boxes, title: "Batch Tracking", desc: "Production traceability with batch codes, stage progression, quarantine, and cost snapshots." },
    { icon: GraduationCap, title: "Staff Training", desc: "Training records, certificate uploads, expiry tracking, and RAG compliance status per team member." },
    { icon: FileText, title: "HACCP Plan Builder", desc: "Guided 7-principle builder. Publish and print as a formatted document." },
  ],
  business: [
    { icon: PoundSterling, title: "Cost & Margin", desc: "True Margin Engine — VAT, yield, nested recipes, and labour cost derived from timesheets. Stoplight GP%." },
    { icon: Coins, title: "Tip Tracker", desc: "Log tip pools, distribute by equal/hours/manual. Compliant with the Allocation of Tips Act 2023." },
    { icon: FileSpreadsheet, title: "Reports", desc: "EHO-ready PDF and 9-worksheet Excel. Estimated food hygiene rating. Three FSA pillars scored." },
  ],
};

function FeatureGrid({ items }: { items: typeof FEATURES.daily }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
      {items.map((f, i) => (
        <Card key={i} className="p-5 rounded-2xl border-slate-200 hover:border-[#3d8a6a]/40 hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-lg bg-[#3d8a6a]/10 grid place-items-center mb-3">
            <f.icon className="w-5 h-5 text-[#3d8a6a]" />
          </div>
          <h3 className="font-semibold text-slate-900 mb-1.5">{f.title}</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
        </Card>
      ))}
    </div>
  );
}

function Features() {
  return (
    <Section id="features">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">Everything you need to run your venue</h2>
        <p className="text-lg text-slate-600 max-w-3xl mx-auto">
          Modular by design — activate only what you need. Every module syncs with every other.
          No dead screens, no feature bloat.
        </p>
      </div>
      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full max-w-xl mx-auto grid-cols-3">
          <TabsTrigger value="daily">Daily Operations</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
        </TabsList>
        <TabsContent value="daily"><FeatureGrid items={FEATURES.daily} /></TabsContent>
        <TabsContent value="compliance"><FeatureGrid items={FEATURES.compliance} /></TabsContent>
        <TabsContent value="business"><FeatureGrid items={FEATURES.business} /></TabsContent>
      </Tabs>
    </Section>
  );
}

// ───── How it works ─────
function HowItWorks() {
  const steps = [
    { n: 1, title: "Sign up & set up your site", body: "Create your account, name your venue, and configure your first site. Default checks are seeded automatically." },
    { n: 2, title: "Activate the modules you need", body: "Start with the Base platform. Add Compliance or Business when you're ready. Toggle modules on or off per site." },
    { n: 3, title: "Your team logs in with a PIN", body: "Share your unique login URL or QR code. Staff enter their Site ID and Staff ID — no email needed." },
  ];
  return (
    <Section className="bg-slate-50">
      <h2 className="text-3xl md:text-5xl font-bold text-center text-slate-900 mb-14">Up and running in 5 minutes</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {steps.map((s) => (
          <Card key={s.n} className="p-6 rounded-2xl border-slate-200">
            <div className="w-11 h-11 rounded-full bg-[#3d8a6a] text-white grid place-items-center font-bold mb-4">{s.n}</div>
            <h3 className="font-semibold text-lg text-slate-900 mb-2">{s.title}</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{s.body}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

// ───── Pricing ─────
function Pricing() {
  const [annual, setAnnual] = useState(false);
  const plans = [
    { name: "Base Platform", monthly: 7.99, yearly: 79.90, tagline: "Run your daily operations.", note: "" },
    { name: "Compliance Add-on", monthly: 3.99, yearly: 39.90, tagline: "Stay inspection-ready.", note: "Requires Base" },
    { name: "Business Add-on", monthly: 3.99, yearly: 39.90, tagline: "Track costs and profit.", note: "Requires Base" },
    { name: "Full Bundle", monthly: 12.99, yearly: 129.90, tagline: "Everything you need.", note: "", featured: true },
  ];
  const perks = [
    "14-day free trial — no card required",
    "15% multi-site discount from second site",
    "Data retained 7 years after cancellation",
    "Cancel anytime",
  ];
  return (
    <Section id="pricing">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">Simple, transparent pricing</h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Per site, per month. Annual billing saves 2 months. No hidden fees, no contracts.
        </p>
      </div>
      <div className="flex items-center justify-center gap-3 mb-10">
        <span className={`text-sm font-medium ${!annual ? "text-slate-900" : "text-slate-500"}`}>Monthly</span>
        <Switch checked={annual} onCheckedChange={setAnnual} />
        <span className={`text-sm font-medium ${annual ? "text-slate-900" : "text-slate-500"}`}>
          Annual <span className="text-green-600 text-xs">(save ~17%)</span>
        </span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((p) => (
          <Card
            key={p.name}
            className={`p-6 rounded-2xl flex flex-col relative ${
              p.featured ? "border-2 border-[#3d8a6a] shadow-lg" : "border-slate-200"
            }`}
          >
            {p.featured && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#3d8a6a] hover:bg-[#3d8a6a] text-white border-0">
                Best value
              </Badge>
            )}
            <h3 className="font-semibold text-slate-900 mb-1">{p.name}</h3>
            <p className="text-sm text-slate-600 mb-4">{p.tagline}</p>
            <div className="mb-1">
              <span className="text-3xl font-bold text-slate-900">£{annual ? p.yearly.toFixed(2) : p.monthly.toFixed(2)}</span>
              <span className="text-slate-500 text-sm">/{annual ? "yr" : "mo"}</span>
            </div>
            {p.note && <p className="text-xs text-slate-500 mb-4">{p.note}</p>}
            {!p.note && <div className="mb-4 h-4" />}
            <a href={AUTH_URL} className="mt-auto">
              <Button className={`w-full ${p.featured ? "bg-[#3d8a6a] hover:bg-[#2f6d54]" : ""}`} variant={p.featured ? "default" : "outline"}>
                Start Free Trial
              </Button>
            </a>
          </Card>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-10 max-w-4xl mx-auto">
        {perks.map((p, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
            <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span>{p}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ───── Compliance ─────
function Compliance() {
  const cards = [
    { emoji: "🌡️", title: "Temperature compliance", body: "AM and PM checks. Automatic breach detection. Mandatory corrective actions. Full audit trail." },
    { emoji: "📄", title: "PPDS & allergen labelling", body: "14 allergens tracked. Sub-ingredient composition. Auto-generated labels compliant with Natasha's Law." },
    { emoji: "📋", title: "Inspection-ready exports", body: "Generate your EHO inspection pack in seconds. Estimated food hygiene rating. Three FSA pillars scored." },
  ];
  return (
    <Section id="compliance" className="bg-slate-50">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">Built for UK food safety from day one</h2>
        <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
          MiseOS isn't a generic task manager with a food label slapped on. Every module is designed
          around FSA Safer Food Better Business principles and FIC regulations.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {cards.map((c, i) => (
          <Card key={i} className="p-6 rounded-2xl border-slate-200">
            <div className="text-4xl mb-4">{c.emoji}</div>
            <h3 className="font-semibold text-lg text-slate-900 mb-2">{c.title}</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{c.body}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

// ───── FAQ ─────
function FAQ() {
  const items = [
    ["Do I need a card to start the trial?", "No. Your 14-day trial starts when you pick a plan. No card details required until you decide to subscribe."],
    ["Can I change plans later?", "Yes. Upgrade, downgrade, or add modules at any time from Account & Billing."],
    ["How do my staff log in?", "Staff use a PIN-based kiosk login. Share your unique URL or QR code. They enter Site ID and Staff ID — no email needed."],
    ["Is my data safe?", "Yes. Encrypted in transit and at rest. Hosted on Supabase (AWS). Data retained 7 years for compliance."],
    ["Can I use it on my phone?", "Absolutely. MiseOS is mobile-first — works in any browser on any device."],
    ["What if I have multiple sites?", "Multi-site is built in. 15% discount per additional site. HQ Dashboard for cross-site compliance."],
    ["Does it replace my EPOS?", "No. MiseOS handles operations and compliance, not payments. It sits alongside your existing EPOS."],
  ];
  return (
    <Section id="faq">
      <h2 className="text-3xl md:text-5xl font-bold text-center text-slate-900 mb-12">Frequently asked questions</h2>
      <div className="max-w-3xl mx-auto">
        <Accordion type="single" collapsible className="w-full">
          {items.map(([q, a], i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left font-medium">{q}</AccordionTrigger>
              <AccordionContent className="text-slate-600 leading-relaxed">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}

// ───── Final CTA ─────
function FinalCTA() {
  return (
    <section className="bg-[#1f3a32] text-white py-20 md:py-28 px-4">
      <motion.div {...fadeUp} className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-5xl font-bold mb-5">Ready to run your venue properly?</h2>
        <p className="text-lg text-slate-300 mb-10 leading-relaxed">
          Join the bakeries and cafés replacing paper, spreadsheets, and guesswork with one
          platform that actually works.
        </p>
        <a href={AUTH_URL}>
          <Button size="lg" className="bg-[#3d8a6a] hover:bg-[#2f6d54] text-base px-8 h-12">
            Start Your Free Trial <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </a>
      </motion.div>
    </section>
  );
}

// ───── Footer ─────
function Footer() {
  return (
    <footer className="border-t border-slate-200 py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <img src={miseosLogo} alt="MiseOS" className="h-10 w-auto" />
          <span>© 2026</span>
        </div>
        <div className="flex gap-5">
          <a href="#" className="hover:text-slate-900">Privacy Policy</a>
          <a href="#" className="hover:text-slate-900">Terms of Service</a>
          <a href="#" className="hover:text-slate-900">Contact</a>
        </div>
        <p className="italic">Built for the people who make the food.</p>
      </div>
    </footer>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900 scroll-smooth font-body">
      <Nav />
      <Hero />
      <Problem />
      <Features />
      <HowItWorks />
      <Pricing />
      <Compliance />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
