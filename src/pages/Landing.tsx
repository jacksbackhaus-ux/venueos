import { useState } from "react";
import { motion } from "framer-motion";
import {
  Menu, X, Check, ArrowRight, ShieldCheck, Smartphone, Archive, Scale,
  LayoutDashboard, CalendarDays, Repeat, Clock, MessageSquare, ClipboardCheck,
  Thermometer, Sparkles, Trash2, Star, Tag, Truck, Bug, Wrench,
  AlertTriangle, Boxes, GraduationCap, FileText, PoundSterling, Coins,
  FileSpreadsheet, FileWarning, Layers, Users, Brain, Wand2, LineChart, Zap,
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

// Brand palette
const BRAND_DEEP = "#1f3a32";
const BRAND_SAGE = "#3d8a6a";
const BRAND_LIGHT = "#6BAE8E";

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
          <a href={AUTH_URL}>
            <Button variant="outline" size="sm">Log In</Button>
          </a>
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

// ───── Hero (OneHub-inspired: dark green panel, headline left, CTA card right) ─────
function Hero() {
  return (
    <section id="top" className="px-4 pt-6 md:pt-10 pb-10">
      <motion.div
        {...fadeUp}
        className="relative max-w-6xl mx-auto rounded-[2rem] overflow-hidden text-white shadow-xl"
        style={{
          background: `linear-gradient(135deg, ${BRAND_DEEP} 0%, ${BRAND_DEEP} 45%, ${BRAND_SAGE} 100%)`,
          minHeight: "560px",
        }}
      >
        {/* decorative orb */}
        <div
          aria-hidden
          className="absolute -right-32 -top-32 w-[480px] h-[480px] rounded-full opacity-40 blur-3xl"
          style={{ background: `radial-gradient(circle, ${BRAND_LIGHT} 0%, transparent 70%)` }}
        />
        <div
          aria-hidden
          className="absolute -right-20 bottom-0 w-[380px] h-[380px] rounded-full opacity-25 blur-2xl"
          style={{ background: `radial-gradient(circle, #a8d8bd 0%, transparent 70%)` }}
        />

        <div className="relative grid lg:grid-cols-5 gap-10 p-8 md:p-14 lg:p-16">
          {/* Left: copy */}
          <div className="lg:col-span-3 flex flex-col justify-center">
            <Badge className="self-start mb-6 bg-white/15 hover:bg-white/15 text-white border border-white/20 px-3.5 py-1.5 rounded-full font-medium backdrop-blur-sm">
              Built for UK food businesses
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
              Powering how independent venues deliver food safety
            </h1>
            <p className="text-base md:text-lg text-white/80 max-w-xl leading-relaxed mb-8">
              MiseOS replaces clipboards, spreadsheets and disconnected apps with one
              interconnected platform — designed for artisan bakeries, cafés and small
              restaurants who take their craft seriously.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={AUTH_URL}>
                <Button size="lg" className="bg-white text-slate-900 hover:bg-white/90 h-12 px-7 text-base font-semibold">
                  Start Free Trial <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </a>
              <a href="#features">
                <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white h-12 px-7 text-base">
                  See how it works
                </Button>
              </a>
            </div>
          </div>

          {/* Right: log in card (replacing the demo form) */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl p-7 md:p-8 text-slate-900 shadow-2xl">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-10 h-10 rounded-xl grid place-items-center"
                  style={{ backgroundColor: `${BRAND_SAGE}15` }}
                >
                  <ShieldCheck className="w-5 h-5" style={{ color: BRAND_SAGE }} />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  14-day free trial
                </span>
              </div>
              <h3 className="text-2xl font-bold mb-2 leading-tight">
                Run your venue properly
              </h3>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                No card required. Full platform access for two weeks. Cancel any time.
              </p>
              <div className="space-y-2.5 mb-6">
                {[
                  "Every module unlocked — full platform access",
                  "Mobile and desktop ready",
                  "Inspection-ready exports included",
                ].map((t) => (
                  <div key={t} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: BRAND_SAGE }} />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
              <a href={AUTH_URL}>
                <Button
                  className="w-full h-12 text-white text-base font-semibold"
                  style={{ backgroundColor: BRAND_SAGE }}
                >
                  Log In / Sign Up <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </a>
              <p className="text-xs text-slate-500 text-center mt-4">
                By signing up you agree to our terms and privacy policy.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Trust strip */}
      <div className="max-w-6xl mx-auto mt-10 grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { icon: ShieldCheck, text: "FSA Safer Food Better Business aligned" },
          { icon: Smartphone, text: "Mobile-first — works on any device" },
          { icon: Archive, text: "7-year retention — EHO inspection ready" },
          { icon: Scale, text: "Built for UK food safety law" },
        ].map((b, i) => (
          <div key={i} className="flex items-start gap-2.5 text-xs md:text-sm text-slate-600">
            <b.icon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: BRAND_SAGE }} />
            <span>{b.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ───── A connected platform statement ─────
function Statement() {
  return (
    <Section className="py-16 md:py-20">
      <p className="text-center text-2xl md:text-4xl font-bold text-slate-900 leading-tight tracking-tight max-w-4xl mx-auto">
        Create a{" "}
        <span style={{ color: BRAND_SAGE }}>consistent and connected</span>{" "}
        food safety operation across every site.
      </p>
    </Section>
  );
}

// ───── AI Capabilities ─────
function AISection() {
  const cards = [
    {
      icon: Brain,
      title: "Morning Briefing",
      body: "Each morning, AI summarises last night's checks, flags anything missed, and tells you exactly what needs attention before service.",
    },
    {
      icon: Wand2,
      title: "Smart Rota",
      body: "AI drafts next week's rota from historical patterns, availability and approved holidays — respecting Working Time Directive limits.",
    },
    {
      icon: LineChart,
      title: "Equipment Drift Detection",
      body: "AI watches your fridge and freezer trends, predicts failures before they breach, and tells you which unit needs servicing.",
    },
    {
      icon: FileText,
      title: "Compliance Narrative",
      body: "AI writes plain-English compliance summaries for your EHO inspection pack — no more stitching reports together by hand.",
    },
  ];
  return (
    <section className="px-4 py-20 md:py-28">
      <motion.div
        {...fadeUp}
        className="relative max-w-6xl mx-auto rounded-[2rem] overflow-hidden text-white p-8 md:p-14 lg:p-16"
        style={{ background: `linear-gradient(135deg, ${BRAND_DEEP} 0%, #2a5446 100%)` }}
      >
        <div
          aria-hidden
          className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full opacity-25 blur-3xl"
          style={{ background: `radial-gradient(circle, ${BRAND_LIGHT} 0%, transparent 70%)` }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-9 h-9 rounded-xl bg-white/15 grid place-items-center backdrop-blur-sm">
              <Zap className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-white/80">
              AI built in — no setup, no extra cost
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight max-w-3xl mb-4">
            AI that runs in the background, not in your way
          </h2>
          <p className="text-base md:text-lg text-white/80 max-w-2xl leading-relaxed mb-12">
            MiseOS uses AI to remove the boring parts of running a venue — drafting rotas,
            spotting equipment drift, summarising compliance — so you can focus on the food
            and your team.
          </p>
          <div className="grid sm:grid-cols-2 gap-5">
            {cards.map((c) => (
              <div
                key={c.title}
                className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-6"
              >
                <c.icon className="w-7 h-7 mb-4 opacity-90" />
                <h3 className="font-bold text-lg mb-1.5">{c.title}</h3>
                <p className="text-sm text-white/80 leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ───── Problem (no emojis, icons instead) ─────
function Problem() {
  const cards = [
    {
      icon: FileWarning,
      title: "Drowning in paper",
      body: "Temperature logs on clipboards, cleaning schedules on laminated sheets, day sheets in a ring binder no one looks at until the EHO turns up.",
    },
    {
      icon: Layers,
      title: "Five apps that don't talk to each other",
      body: "One app for rotas, another for messaging, a spreadsheet for costing, a folder for training certificates. Nothing connects. You're the glue.",
    },
    {
      icon: PoundSterling,
      title: "Paying for features you'll never use",
      body: "Enterprise platforms charge hundreds a month for tools designed for chains with fifty locations. You have one bakery and three staff.",
    },
  ];
  return (
    <Section id="problem" className="bg-[#faf6ee]">
      <h2 className="text-3xl md:text-5xl font-bold text-center text-slate-900 mb-14 tracking-tight">
        Sound familiar?
      </h2>
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {cards.map((c, i) => (
          <Card key={i} className="p-7 rounded-2xl border-slate-200 bg-white">
            <div
              className="w-12 h-12 rounded-xl grid place-items-center mb-5"
              style={{ backgroundColor: `${BRAND_SAGE}15` }}
            >
              <c.icon className="w-6 h-6" style={{ color: BRAND_SAGE }} />
            </div>
            <h3 className="font-semibold text-lg text-slate-900 mb-2">{c.title}</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{c.body}</p>
          </Card>
        ))}
      </div>
      <p className="text-center text-lg text-slate-700 max-w-3xl mx-auto leading-relaxed">
        MiseOS was built by an operator who lived these problems. It does what you need,
        nothing you don't, and costs less than your Netflix subscription.
      </p>
    </Section>
  );
}

// ───── Bento Product Grid (OneHub-inspired colored cards) ─────
function ProductBento() {
  return (
    <Section id="modules">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
          Explore the MiseOS modules
        </h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Modular by design. Activate only what you need. Every module syncs with every other.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {/* Large left card — sage */}
        <Card
          className="md:row-span-2 p-8 rounded-3xl border-0 text-white flex flex-col justify-between min-h-[340px]"
          style={{ backgroundColor: BRAND_SAGE }}
        >
          <div>
            <ClipboardCheck className="w-9 h-9 mb-6 opacity-90" />
            <h3 className="text-2xl font-bold mb-3">Daily Operations</h3>
            <p className="text-sm text-white/85 leading-relaxed mb-6">
              Day sheet, temperature tracking, cleaning schedules, waste log and customer feedback —
              the daily checks your team actually completes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Day Sheet", "Temperatures", "Cleaning", "Waste", "Feedback"].map((t) => (
              <span key={t} className="text-xs bg-white/15 px-3 py-1.5 rounded-full backdrop-blur-sm">
                {t}
              </span>
            ))}
          </div>
        </Card>

        {/* Top right — deep */}
        <Card
          className="md:col-span-2 p-8 rounded-3xl border-0 text-white min-h-[160px]"
          style={{ backgroundColor: BRAND_DEEP }}
        >
          <ShieldCheck className="w-8 h-8 mb-4 opacity-90" />
          <h3 className="text-xl font-bold mb-2">Compliance &amp; Safety</h3>
          <p className="text-sm text-white/80 leading-relaxed max-w-2xl">
            HACCP plans, allergens, suppliers, pest &amp; maintenance, incidents and batch traceability —
            audit-ready by default.
          </p>
        </Card>

        {/* Middle right — cream */}
        <Card className="p-7 rounded-3xl border-slate-200 bg-[#faf6ee] min-h-[160px]">
          <CalendarDays className="w-8 h-8 mb-4" style={{ color: BRAND_SAGE }} />
          <h3 className="font-bold text-slate-900 mb-1.5">Shifts &amp; Rota</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Weekly rota, swaps, cover and Employment Rights Bill cancellation logging.
          </p>
        </Card>

        {/* Right card — light sage */}
        <Card
          className="p-7 rounded-3xl border-0 min-h-[160px]"
          style={{ backgroundColor: `${BRAND_LIGHT}25` }}
        >
          <PoundSterling className="w-8 h-8 mb-4" style={{ color: BRAND_DEEP }} />
          <h3 className="font-bold text-slate-900 mb-1.5">Cost &amp; Margin</h3>
          <p className="text-sm text-slate-700 leading-relaxed">
            True Margin Engine with VAT, yield, nested recipes and live labour from timesheets.
          </p>
        </Card>
      </div>
    </Section>
  );
}

// ───── Alternating image / text rows (OneHub-style) ─────
function AltRows() {
  const rows = [
    {
      eyebrow: "Inspection ready",
      title: "Pass your EHO inspection with confidence",
      body: "Generate a complete inspection pack in seconds. Estimated Food Hygiene Rating, three FSA pillars scored, full audit trail across temperatures, cleaning, training and incidents.",
      bullets: ["EHO-ready PDF and Excel exports", "7-year data retention", "Estimated FHR score"],
      icon: FileSpreadsheet,
    },
    {
      eyebrow: "Built for your team",
      title: "Mobile-first tools your staff will actually use",
      body: "PIN-based kiosk login. No emails to reset, no apps to install. Staff complete checks on a tablet at the bench or on their phone. Managers see everything in real time.",
      bullets: ["PIN login — no staff emails needed", "Real-time alerts on breaches", "Works on any device"],
      icon: Users,
    },
    {
      eyebrow: "True cost visibility",
      title: "Know your margin on every plate",
      body: "Cost recipes from raw ingredients through nested sub-recipes. Layer in VAT, yield and live labour from timesheets. Stoplight GP% so you spot the dish costing you money before service.",
      bullets: ["VAT and yield-aware costing", "Live labour from timesheets", "Tip Tracker — Allocation of Tips Act 2023"],
      icon: PoundSterling,
    },
  ];

  return (
    <Section id="how" className="bg-white">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
          Improve operations and protect your reputation
        </h2>
      </div>
      <div className="space-y-20 md:space-y-28">
        {rows.map((r, i) => {
          const reverse = i % 2 === 1;
          return (
            <div
              key={i}
              className={`grid md:grid-cols-2 gap-10 md:gap-16 items-center ${reverse ? "md:[&>*:first-child]:order-2" : ""}`}
            >
              {/* Visual block */}
              <div
                className="relative aspect-[5/4] rounded-3xl overflow-hidden p-10 flex items-end"
                style={{
                  background:
                    i === 0
                      ? `linear-gradient(135deg, ${BRAND_DEEP} 0%, ${BRAND_SAGE} 100%)`
                      : i === 1
                      ? `linear-gradient(135deg, ${BRAND_SAGE} 0%, ${BRAND_LIGHT} 100%)`
                      : `linear-gradient(135deg, #faf6ee 0%, #e8ddc4 100%)`,
                }}
              >
                <div
                  aria-hidden
                  className="absolute -top-16 -right-16 w-72 h-72 rounded-full opacity-30 blur-2xl"
                  style={{ background: i === 2 ? BRAND_SAGE : "white" }}
                />
                <div className="relative">
                  <r.icon
                    className="w-16 h-16 mb-4"
                    style={{ color: i === 2 ? BRAND_DEEP : "white" }}
                  />
                  <p
                    className="text-2xl md:text-3xl font-bold leading-tight max-w-xs"
                    style={{ color: i === 2 ? BRAND_DEEP : "white" }}
                  >
                    {r.title}
                  </p>
                </div>
              </div>

              {/* Text */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: BRAND_SAGE }}>
                  {r.eyebrow}
                </p>
                <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4 leading-tight tracking-tight">
                  {r.title}
                </h3>
                <p className="text-slate-600 leading-relaxed mb-6">{r.body}</p>
                <div className="space-y-2.5">
                  {r.bullets.map((b) => (
                    <div key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <div
                        className="w-5 h-5 rounded-md grid place-items-center flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: `${BRAND_SAGE}20` }}
                      >
                        <Check className="w-3.5 h-3.5" style={{ color: BRAND_SAGE }} />
                      </div>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
                <a href={AUTH_URL} className="inline-flex items-center gap-1.5 mt-7 text-sm font-semibold" style={{ color: BRAND_SAGE }}>
                  Start free trial <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ───── Features (tabbed) ─────
const FEATURES = {
  daily: [
    { icon: LayoutDashboard, title: "Dashboard", desc: "Today's checklist, compliance score, shift schedule, alerts and inspection readiness — one screen." },
    { icon: CalendarDays, title: "Shifts & Rota", desc: "Weekly and daily rota with linked compliance tasks and automatic Messenger notifications." },
    { icon: Repeat, title: "Shift Hive", desc: "Staff request swaps and cover. Managers approve in one tap. Late cancellations auto-log compensation." },
    { icon: Clock, title: "Timesheets", desc: "Clock in, clock out, log breaks. Export to CSV for Xero, Sage and BrightPay." },
    { icon: MessageSquare, title: "Messenger", desc: "Built-in team chat with channels, DMs, pinned messages, tasks, acks and shift handover notes." },
    { icon: ClipboardCheck, title: "Day Sheet", desc: "Configurable opening and closing checks based on FSA SFBB. Lock and sign-off with full audit trail." },
    { icon: Thermometer, title: "Temperature Tracking", desc: "Log fridge, freezer and probe temps with a tap-friendly keypad. Breach detection with corrective actions." },
    { icon: Sparkles, title: "Cleaning Schedule", desc: "Daily, weekly and monthly tasks. Full audit history including missed days." },
    { icon: Trash2, title: "Waste Log", desc: "Track food waste by category. Spot trends with weekly bar charts." },
    { icon: Star, title: "Customer Feedback", desc: "Capture, categorise, resolve and trend feedback from any source." },
  ],
  compliance: [
    { icon: Tag, title: "Allergens & Labels", desc: "Build recipes from ingredients with 14 declared allergens. Auto-generate Natasha's Law PPDS labels." },
    { icon: Truck, title: "Suppliers & Deliveries", desc: "Approved supplier list. Log deliveries with temperature, packaging and use-by checks." },
    { icon: Bug, title: "Pest & Maintenance", desc: "Report sightings and issues. Preventative check schedules with overdue alerts." },
    { icon: Wrench, title: "PPM Schedule", desc: "Planned preventative maintenance with configurable frequencies and cost tracking." },
    { icon: AlertTriangle, title: "Incidents", desc: "Three-stage workflow: Open → Action Taken → Verified. Root cause and corrective actions." },
    { icon: Boxes, title: "Batch Tracking", desc: "Production traceability with batch codes, stage progression, quarantine and cost snapshots." },
    { icon: GraduationCap, title: "Staff Training", desc: "Training records, certificate uploads, expiry tracking and RAG compliance status." },
    { icon: FileText, title: "HACCP Plan Builder", desc: "Guided 7-principle builder. Publish and print as a formatted document." },
  ],
  business: [
    { icon: PoundSterling, title: "Cost & Margin", desc: "True Margin Engine — VAT, yield, nested recipes and labour from timesheets. Stoplight GP%." },
    { icon: Coins, title: "Tip Tracker", desc: "Log tip pools, distribute by equal/hours/manual. Allocation of Tips Act 2023 compliant." },
    { icon: FileSpreadsheet, title: "Reports", desc: "EHO-ready PDF and 9-worksheet Excel. Estimated FHR. Three FSA pillars scored." },
  ],
};

function FeatureGrid({ items }: { items: typeof FEATURES.daily }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
      {items.map((f, i) => (
        <Card key={i} className="p-5 rounded-2xl border-slate-200 hover:shadow-md transition-all" style={{ ['--hover' as string]: BRAND_SAGE }}>
          <div className="w-10 h-10 rounded-lg grid place-items-center mb-3" style={{ backgroundColor: `${BRAND_SAGE}15` }}>
            <f.icon className="w-5 h-5" style={{ color: BRAND_SAGE }} />
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
    <Section id="features" className="bg-[#faf6ee]">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
          Everything you need to run your venue
        </h2>
        <p className="text-lg text-slate-600 max-w-3xl mx-auto">
          Activate only what you need. No dead screens, no feature bloat.
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
        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
          Simple, transparent pricing
        </h2>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Per site, per month. Annual billing saves two months. No hidden fees, no contracts.
        </p>
      </div>
      <div className="flex items-center justify-center gap-3 mb-10">
        <span className={`text-sm font-medium ${!annual ? "text-slate-900" : "text-slate-500"}`}>Monthly</span>
        <Switch checked={annual} onCheckedChange={setAnnual} />
        <span className={`text-sm font-medium ${annual ? "text-slate-900" : "text-slate-500"}`}>
          Annual <span className="text-xs" style={{ color: BRAND_SAGE }}>(save ~17%)</span>
        </span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((p) => (
          <Card
            key={p.name}
            className={`p-6 rounded-2xl flex flex-col relative ${p.featured ? "shadow-lg" : "border-slate-200"}`}
            style={p.featured ? { borderColor: BRAND_SAGE, borderWidth: 2 } : undefined}
          >
            {p.featured && (
              <Badge
                className="absolute -top-3 left-1/2 -translate-x-1/2 text-white border-0"
                style={{ backgroundColor: BRAND_SAGE }}
              >
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
              <Button
                className={`w-full ${p.featured ? "text-white" : ""}`}
                style={p.featured ? { backgroundColor: BRAND_SAGE } : undefined}
                variant={p.featured ? "default" : "outline"}
              >
                Start Free Trial
              </Button>
            </a>
          </Card>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-10 max-w-4xl mx-auto">
        {perks.map((p, i) => (
          <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
            <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: BRAND_SAGE }} />
            <span>{p}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ───── Compliance (no emojis) ─────
function Compliance() {
  const cards = [
    {
      icon: Thermometer,
      title: "Temperature compliance",
      body: "AM and PM checks. Automatic breach detection. Mandatory corrective actions. Full audit trail.",
    },
    {
      icon: Tag,
      title: "PPDS & allergen labelling",
      body: "14 allergens tracked. Sub-ingredient composition. Auto-generated labels compliant with Natasha's Law.",
    },
    {
      icon: FileSpreadsheet,
      title: "Inspection-ready exports",
      body: "Generate your EHO inspection pack in seconds. Estimated Food Hygiene Rating. Three FSA pillars scored.",
    },
  ];
  return (
    <Section id="compliance" className="bg-[#faf6ee]">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
          Built for UK food safety from day one
        </h2>
        <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
          MiseOS isn't a generic task manager with a food label slapped on. Every module is designed
          around FSA Safer Food Better Business principles and FIC regulations.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {cards.map((c, i) => (
          <Card key={i} className="p-7 rounded-2xl border-slate-200 bg-white">
            <div
              className="w-12 h-12 rounded-xl grid place-items-center mb-5"
              style={{ backgroundColor: `${BRAND_SAGE}15` }}
            >
              <c.icon className="w-6 h-6" style={{ color: BRAND_SAGE }} />
            </div>
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
  const items: [string, string][] = [
    ["Do I need a card to start the trial?", "No. Your 14-day trial starts when you pick a plan. No card details required until you decide to subscribe."],
    ["Can I change plans later?", "Yes. Upgrade, downgrade or add modules at any time from Account & Billing."],
    ["How do my staff log in?", "Staff use a PIN-based kiosk login. Share your unique URL or QR code. They enter Site ID and Staff ID — no email needed."],
    ["Is my data safe?", "Yes. Encrypted in transit and at rest. Hosted on Supabase (AWS). Data retained 7 years for compliance."],
    ["Can I use it on my phone?", "Absolutely. MiseOS is mobile-first — works in any browser on any device."],
    ["What if I have multiple sites?", "Multi-site is built in. 15% discount per additional site. HQ Dashboard for cross-site compliance."],
    ["Does it replace my EPOS?", "No. MiseOS handles operations and compliance, not payments. It sits alongside your existing EPOS."],
  ];
  return (
    <Section id="faq">
      <h2 className="text-3xl md:text-5xl font-bold text-center text-slate-900 mb-12 tracking-tight">
        Frequently asked questions
      </h2>
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
          <h2 className="text-3xl md:text-5xl font-bold mb-5 tracking-tight">Ready to run your venue properly?</h2>
          <p className="text-lg text-white/85 mb-10 leading-relaxed">
            Join the bakeries and cafés replacing paper, spreadsheets and guesswork with one
            platform that actually works.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href={AUTH_URL}>
              <Button size="lg" className="bg-white text-slate-900 hover:bg-white/90 h-12 px-8 text-base font-semibold">
                Start Your Free Trial <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </a>
            <a href={AUTH_URL}>
              <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white h-12 px-8 text-base">
                Log In
              </Button>
            </a>
          </div>
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
      <Nav />
      <Hero />
      <Statement />
      <Problem />
      <ProductBento />
      <AltRows />
      <Features />
      <AISection />
      <Pricing />
      <Compliance />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
