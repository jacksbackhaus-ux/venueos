import type { ReactNode } from "react";
import { GuideHeader, GuideFooter } from "@/components/guides/GuideShell";
import { LEGAL } from "@/config/legal";

export function LegalPage({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <GuideHeader />
      <main className="max-w-3xl mx-auto px-4 py-10 text-slate-700 leading-relaxed">
        <h1 className="font-heading text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {LEGAL.lastUpdated}</p>
        <div className="mt-4">{intro}</div>
        <div className="mt-8 space-y-10">{children}</div>
      </main>
      <GuideFooter />
    </div>
  );
}

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-20">
      <h2 className="font-heading text-xl font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-semibold text-slate-900">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2 align-top">{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WhoWeAre() {
  return (
    <ul className="list-disc pl-5 space-y-1 text-sm">
      <li>{LEGAL.legalEntityName}, trading as {LEGAL.tradingName}</li>
      <li>Company number: {LEGAL.companyNumber}</li>
      <li>Registered address: {LEGAL.registeredAddress}</li>
      <li>Contact: <a className="underline" href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a></li>
      {LEGAL.icoRegistrationNumber && <li>ICO registration number: {LEGAL.icoRegistrationNumber}</li>}
    </ul>
  );
}
