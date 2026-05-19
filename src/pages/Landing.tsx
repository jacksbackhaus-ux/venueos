import { useState } from "react";
import { motion } from "framer-motion";
import {
  Menu, X, Check, ArrowRight, AlertTriangle, Cookie, Thermometer,
  PoundSterling, CalendarDays, ClipboardCheck, MessageSquare, LayoutDashboard,
  Sparkles, FileText, Coins, Scale, Trash2, Boxes, Brain, Zap, LineChart, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import miseosLogo from "@/assets/miseos-logo.png";
import { SEO } from "@/components/SEO";

const AUTH_URL = "/auth";

// Brand palette
const BRAND_DEEP = "#1f3a32";
const BRAND_SAGE = "#3d8a6a";
const BRAND_LIGHT = "#6BAE8E";
const BRAND_CREAM = "#FAF7F2";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, ease: "easeOut" as const },
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
    { href: "#how", label: "How it works" },
    { href: "#examples", label: "Examples" },
    { href: "#pricing", label: "Pricing" },
  ];
  return (
    <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5">
          <img src={miseosLogo} alt="MiseOS" className="h-10 md:h-12 w-auto" />
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

// ───── Hero ─────
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
      <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        <motion.div {...fadeUp} className="lg:col-span-6">
          <Badge variant="outline" className="mb-6 border-slate-300 text-slate-700 font-medium">
            For bakeries, cafés & independent kitchens
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 leading-[1.05]">
            Run your bakery, café, or kitchen from{" "}
            <span style={{ color: BRAND_SAGE }}>one system</span>.
          </h1>
          <p className="mt-6 text-lg md:text-xl text-slate-600 leading-relaxed max-w-xl">
            Operations, food safety, and profit — simplified into one daily workflow.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a href={AUTH_URL}>
              <Button size="lg" style={{ backgroundColor: BRAND_SAGE }} className="hover:opacity-90 text-white h-12 px-7 text-base font-semibold">
                Start Free Trial <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </a>
            <a href="#how">
              <Button size="lg" variant="outline" className="h-12 px-7 text-base">
                See How It Works
              </Button>
            </a>
          </div>
          <p className="mt-5 text-sm text-slate-500">No card required · Up and running in minutes</p>
        </motion.div>

        {/* Right: mixed dashboard mock */}
        <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }} className="lg:col-span-6">
          <HeroDashboard />
        </motion.div>
      </div>
    </section>
  );
}

function HeroDashboard() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[2.5rem] opacity-40 blur-2xl"
        style={{ background: `linear-gradient(135deg, ${BRAND_LIGHT}, ${BRAND_SAGE})` }}
      />
      <div className="relative rounded-3xl bg-white border border-slate-200 shadow-2xl shadow-slate-900/10 p-5 md:p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs text-slate-500 font-medium">Tuesday, 19 May</p>
            <p className="text-sm font-semibold text-slate-900">Morning at Maison Rue</p>
          </div>
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND_SAGE }} />
          </div>
        </div>

        {/* Safe to trade */}
        <div className="rounded-2xl p-5 mb-3" style={{ background: `linear-gradient(135deg, ${BRAND_DEEP}, ${BRAND_SAGE})` }}>
          <p className="text-xs text-white/70 font-medium uppercase tracking-wide">Safe to trade</p>
          <div className="flex items-end justify-between mt-1">
            <p className="text-4xl font-bold text-white">92%</p>
            <span className="text-2xl">✅</span>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full rounded-full bg-white" style={{ width: "92%" }} />
          </div>
        </div>

        {/* Two stat cards */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <Cookie className="w-4 h-4 text-amber-600" />
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+12%</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">120</p>
            <p className="text-xs text-slate-500">cookies produced</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <PoundSterling className="w-4 h-4" style={{ color: BRAND_SAGE }} />
              <span className="text-[10px] font-semibold text-slate-500">per unit</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">£2.10</p>
            <p className="text-xs text-slate-500">profit margin 💰</p>
          </div>
        </div>

        {/* Alert row */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <Thermometer className="w-4 h-4 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Fridge 2 alert ⚠️</p>
            <p className="text-xs text-amber-800 mt-0.5">Reading 7.2°C — above 5°C threshold for 14 min</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───── Hook ─────
function Hook() {
  const left = ["Paper logs", "4 different apps", "No visibility", "EHO stress"];
  const right = ["One system", "Clear priorities", "Always inspection ready", "Profit visibility"];
  return (
    <Section className="bg-slate-50">
      <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-center text-slate-900 max-w-3xl mx-auto leading-tight">
        Most systems track your business.
        <br />
        <span style={{ color: BRAND_SAGE }}>MiseOS runs it.</span>
      </h2>

      <div className="grid md:grid-cols-2 gap-5 mt-14 max-w-4xl mx-auto">
        <Card className="p-7 border-slate-200 bg-white">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-400 mb-5">Before</p>
          <ul className="space-y-4">
            {left.map((t) => (
              <li key={t} className="flex items-center gap-3 text-slate-500">
                <X className="w-5 h-5 shrink-0" />
                <span className="text-base line-through decoration-slate-300">{t}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-7 border-0 text-white" style={{ background: `linear-gradient(160deg, ${BRAND_DEEP}, ${BRAND_SAGE})` }}>
          <p className="text-xs uppercase tracking-wider font-semibold text-white/60 mb-5">With MiseOS</p>
          <ul className="space-y-4">
            {right.map((t) => (
              <li key={t} className="flex items-center gap-3">
                <Check className="w-5 h-5 shrink-0" />
                <span className="text-base font-medium">{t}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Section>
  );
}

// ───── Pillars ─────
const PILLARS = [
  {
    emoji: "🟢",
    title: "Run your day",
    items: ["Shifts", "Tasks", "Messaging", "Daily dashboard"],
    icon: LayoutDashboard,
    tint: "#3d8a6a",
  },
  {
    emoji: "🟡",
    title: "Stay compliant",
    items: ["Temperature logs", "Cleaning", "HACCP", "EHO-ready reports"],
    icon: ClipboardCheck,
    tint: "#c79545",
  },
  {
    emoji: "🔵",
    title: "Know your numbers",
    items: ["Cost per item", "Margin tracking", "Waste tracking", "Batch output"],
    icon: LineChart,
    tint: "#3b6ea8",
  },
  {
    emoji: "🧠",
    title: "Get smarter automatically",
    items: ["Daily briefing", "Margin alerts", "Waste insights", "Equipment warnings"],
    icon: Brain,
    tint: "#7a5cc4",
  },
];

function Pillars() {
  return (
    <Section id="how">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: BRAND_SAGE }}>
          What it actually does
        </p>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900">
          Four jobs. One quiet system.
        </h2>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
        {PILLARS.map((p) => {
          const Icon = p.icon;
          return (
            <Card key={p.title} className="p-6 border-slate-200 bg-white hover:shadow-lg transition-shadow">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ backgroundColor: `${p.tint}18`, color: p.tint }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span>{p.emoji}</span> {p.title}
              </h3>
              <ul className="space-y-2">
                {p.items.map((i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-slate-400" />
                    {i}
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}

// ───── Difference ─────
function Difference() {
  const rows = [
    ["Built for audits", "Built for real kitchens"],
    ["Complex setups", "Instant clarity"],
    ["Static data", "Live decisions"],
    ["Admin heavy", "Action focused"],
  ];
  return (
    <Section className="bg-slate-50">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: BRAND_SAGE }}>
          The difference
        </p>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900">
          Built for operators, not consultants.
        </h2>
      </div>
      <div className="max-w-3xl mx-auto rounded-3xl overflow-hidden border border-slate-200 bg-white">
        <div className="grid grid-cols-2 px-6 py-4 border-b border-slate-200 bg-slate-50">
          <p className="text-sm font-semibold text-slate-500">Others</p>
          <p className="text-sm font-semibold" style={{ color: BRAND_SAGE }}>MiseOS</p>
        </div>
        {rows.map(([a, b], i) => (
          <div key={a} className={`grid grid-cols-2 px-6 py-5 items-center ${i < rows.length - 1 ? "border-b border-slate-100" : ""}`}>
            <p className="text-slate-500">{a}</p>
            <p className="font-semibold text-slate-900">{b}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ───── Live Examples ─────
function LiveExamples() {
  return (
    <Section id="examples">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <p className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: BRAND_SAGE }}>
          Live examples
        </p>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900">
          What you'll actually see at 7am.
        </h2>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {/* Morning briefing */}
        <Card className="p-6 border-slate-200 bg-white">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">📅</span>
            <h3 className="font-bold text-slate-900">Morning Briefing</h3>
          </div>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Yesterday</p>
              <ul className="space-y-1.5">
                <li className="flex gap-2"><span>✅</span><span className="text-slate-700">All checks completed</span></li>
                <li className="flex gap-2"><span>⚠️</span><span className="text-slate-700">1 temp breach</span></li>
                <li className="flex gap-2"><span>💷</span><span className="text-slate-700">Pistachio margin dropped 8%</span></li>
              </ul>
            </div>
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Today</p>
              <ul className="space-y-1.5 text-slate-700">
                <li>– Check fridge 2</li>
                <li>– Reduce pistachio batch size</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Margin Watchdog */}
        <Card className="p-6 border-slate-200 bg-white">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">💰</span>
            <h3 className="font-bold text-slate-900">Margin Watchdog</h3>
          </div>
          <p className="font-semibold text-slate-900 mb-3">Double Chocolate</p>
          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between"><span className="text-slate-500">Current margin</span><span className="font-semibold text-slate-900">48%</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Target</span><span className="font-semibold" style={{ color: BRAND_SAGE }}>60%</span></div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
              <div className="h-full rounded-full" style={{ width: "48%", backgroundColor: BRAND_SAGE }} />
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1">
            <p className="text-slate-700">→ Raise price <span className="font-semibold">£0.40</span></p>
            <p className="text-slate-700">OR reduce chocolate by <span className="font-semibold">8%</span></p>
          </div>
        </Card>

        {/* Batch Tracking */}
        <Card className="p-6 border-slate-200 bg-white">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🍪</span>
            <h3 className="font-bold text-slate-900">Batch Tracking</h3>
          </div>
          <p className="font-semibold text-slate-900 mb-3">Double Chocolate</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Quantity</span><span className="font-semibold text-slate-900">120 cookies</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Use by</span><span className="font-semibold text-slate-900">18 May</span></div>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold" style={{ backgroundColor: `${BRAND_SAGE}18`, color: BRAND_DEEP }}>
            <Check className="w-4 h-4" /> Complete
          </div>
        </Card>
      </div>
    </Section>
  );
}

// ───── Pricing ─────
// Prices mirror src/lib/plans.ts (MISEOS_TIERS). Keep in sync.
const TIERS = [
  {
    name: "Essentials",
    price: "£14.99",
    annual: "£152.90/yr",
    desc: "Daily ops, temps and day sheets for one site.",
    features: ["Dashboard", "Temperatures", "Day Sheet", "Cleaning", "Shifts", "Unlimited users"],
  },
  {
    name: "Professional",
    price: "£25.99",
    annual: "£265.10/yr",
    desc: "Everything in Essentials + full compliance.",
    features: ["Everything in Essentials", "Allergens & labels", "HACCP & EHO reports", "Incidents", "Unlimited users"],
    popular: true,
  },
  {
    name: "Business",
    price: "£45.99",
    annual: "£469.10/yr",
    desc: "Everything in Professional + business tools.",
    features: ["Everything in Professional", "Batch tracking", "Suppliers & deliveries", "Pest & maintenance", "Cost & margin"],
  },
  {
    name: "Intelligence",
    price: "£69.99",
    annual: "£713.90/yr",
    desc: "Everything in Business + AI superpowers.",
    features: ["Everything in Business", "Daily morning briefing", "Margin & waste alerts", "Equipment health warnings", "Smart rota suggestions"],
  },
];

function Pricing() {
  return (
    <Section id="pricing">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900">
          Simple pricing. No surprises.
        </h2>
        <p className="mt-4 text-slate-600 text-lg">Per site, per month. Unlimited users. Annual saves 15%.</p>
        <p className="mt-2 text-slate-500 text-sm">Monthly is a 12-month plan billed monthly. 14-day free trial — no card required.</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
        {TIERS.map((t) => (
          <Card
            key={t.name}
            className={`p-7 relative ${t.popular ? "border-0 shadow-2xl shadow-emerald-900/20 scale-[1.02]" : "border-slate-200"}`}
            style={t.popular ? { background: `linear-gradient(170deg, ${BRAND_DEEP}, ${BRAND_SAGE})`, color: "white" } : undefined}
          >
            {t.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-white text-slate-900 hover:bg-white font-semibold shadow">Most popular</Badge>
              </div>
            )}
            <p className={`text-sm font-semibold uppercase tracking-wider mb-2 ${t.popular ? "text-white/70" : "text-slate-500"}`}>
              {t.name}
            </p>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-4xl font-bold">{t.price}</span>
              <span className={t.popular ? "text-white/70" : "text-slate-500"}>/mo</span>
            </div>
            <p className={`text-sm mb-6 ${t.popular ? "text-white/85" : "text-slate-600"}`}>{t.desc}</p>
            <ul className="space-y-2.5 mb-7">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className={`w-4 h-4 mt-0.5 shrink-0 ${t.popular ? "text-white" : ""}`} style={!t.popular ? { color: BRAND_SAGE } : undefined} />
                  <span className={t.popular ? "text-white" : "text-slate-700"}>{f}</span>
                </li>
              ))}
            </ul>
            <a href={AUTH_URL} className="block">
              <Button
                className={`w-full h-11 font-semibold ${t.popular ? "bg-white text-slate-900 hover:bg-white/90" : "text-white"}`}
                style={!t.popular ? { backgroundColor: BRAND_SAGE } : undefined}
              >
                Start Free Trial
              </Button>
            </a>
          </Card>
        ))}
      </div>
    </Section>
  );
}

// ───── Final CTA ─────
function FinalCTA() {
  return (
    <section className="px-4 pb-20">
      <motion.div
        {...fadeUp}
        className="relative max-w-6xl mx-auto rounded-[2rem] overflow-hidden text-white py-20 md:py-24 px-8 text-center"
        style={{ background: `linear-gradient(135deg, ${BRAND_DEEP} 0%, ${BRAND_SAGE} 100%)` }}
      >
        <div
          aria-hidden
          className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full opacity-30 blur-3xl"
          style={{ background: `radial-gradient(circle, ${BRAND_LIGHT} 0%, transparent 70%)` }}
        />
        <div className="relative max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold mb-5 tracking-tight">
            Stop managing your business.
            <br />Start running it.
          </h2>
          <div className="flex flex-wrap gap-3 justify-center mt-10">
            <a href={AUTH_URL}>
              <Button size="lg" className="bg-white text-slate-900 hover:bg-white/90 h-12 px-8 text-base font-semibold">
                Start Free Trial <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </a>
          </div>
          <p className="mt-5 text-sm text-white/80">No card required · Up and running in minutes</p>
        </div>
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
          <img src={miseosLogo} alt="MiseOS" className="h-7 w-auto" />
          <span className="font-semibold text-slate-900">MiseOS</span>
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
      <SEO
        title="MiseOS — Run your bakery, café or kitchen from one system"
        description="Operations, food safety, and profit — simplified into one daily workflow for independent bakeries, cafés and kitchens."
        path="/"
      />
      <Nav />
      <main>
        <Hero />
        <Hook />
        <Pillars />
        <Difference />
        <LiveExamples />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
