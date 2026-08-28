import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import miseosLogo from "@/assets/miseos-logo.png";

export const BRAND_SAGE = "#3d8a6a";

/** Shared chrome for the public Food Safety Hub pages (guides + FAQ). */
export function GuideHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link to="/landing" className="flex items-center gap-2.5">
          <img
            src={miseosLogo}
            alt="MiseOS — digital HACCP software for UK food businesses"
            className="h-8 w-auto"
          />
          <span className="text-lg font-bold text-slate-900 tracking-tight">MiseOS</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/guides" className="hidden sm:inline text-sm text-slate-600 hover:text-slate-900">
            Guides
          </Link>
          <Link to="/faq" className="hidden sm:inline text-sm text-slate-600 hover:text-slate-900">
            FAQ
          </Link>
          <a href="/auth?mode=signup">
            <Button size="sm" style={{ backgroundColor: BRAND_SAGE }} className="text-white hover:opacity-90">
              Start free trial
            </Button>
          </a>
        </div>
      </div>
    </header>
  );
}

export function GuideBreadcrumb({ label }: { label?: string }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-slate-500 mb-4">
      <Link to="/landing" className="hover:text-slate-900">Home</Link>
      <span className="mx-1.5">/</span>
      <Link to="/guides" className="hover:text-slate-900">Food Safety Hub</Link>
      {label ? (
        <>
          <span className="mx-1.5">/</span>
          <span className="text-slate-600">{label}</span>
        </>
      ) : null}
    </nav>
  );
}

export function GuideCta({
  heading = "See how MiseOS keeps this simple",
  body = "MiseOS turns your daily checks into a tidy, searchable record you can hand to an inspector. £4.99 per site per month, 14-day free trial, no card needed to look around.",
}: {
  heading?: string;
  body?: string;
}) {
  return (
    <Card className="mt-12 p-6 bg-slate-50 border-slate-200">
      <h2 className="font-heading text-xl font-bold text-slate-900">{heading}</h2>
      <p className="mt-2 text-slate-600 leading-relaxed">{body}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a href="/auth?mode=signup">
          <Button style={{ backgroundColor: BRAND_SAGE }} className="text-white hover:opacity-90">
            Start your 14-day free trial
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </a>
        <a href="/landing#features">
          <Button variant="outline">See what it does</Button>
        </a>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        MiseOS helps you keep clear, consistent records. Your business stays legally responsible for
        food safety and for what those records say.
      </p>
    </Card>
  );
}

export function GuideFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-16">
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <img src={miseosLogo} alt="MiseOS" className="h-8 w-auto" />
          <span>© {new Date().getFullYear()} MiseOS · Built for UK food businesses</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-500">
          <Link to="/guides" className="hover:text-slate-900">Guides</Link>
          <Link to="/faq" className="hover:text-slate-900">FAQ</Link>
          <a href="/haccp" className="hover:text-slate-900">What is HACCP?</a>
          <a href="/landing#pricing" className="hover:text-slate-900">Pricing</a>
          <a href="/auth" className="hover:text-slate-900">Log in</a>
        </div>
      </div>
    </footer>
  );
}

export function GuideDisclaimer() {
  return (
    <p className="mt-3 text-xs text-slate-500">
      General guidance for UK food businesses, written in plain English — not legal advice. Rules and
      wording change, so check current FSA guidance and talk to your local council's environmental
      health team about your own setup.
    </p>
  );
}
