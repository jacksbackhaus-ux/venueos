import * as React from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import shotDashboard from "@/assets/shot-dashboard.png.asset.json";
import shotTemperatures from "@/assets/shot-temperatures.png.asset.json";
import shotCleaning from "@/assets/shot-cleaning.png.asset.json";
import shotBatches from "@/assets/shot-batches.png.asset.json";
import shotTraining from "@/assets/shot-training.png.asset.json";
import shotInspection from "@/assets/shot-inspection-pack.png.asset.json";

/**
 * Screenshot Showcase — real product screenshots only.
 *
 * HOW TO ADD A REAL SCREENSHOT
 * 1. Take the screenshot on a real signed-in account, mobile width (~402px wide).
 * 2. Upload it with the assets CLI, e.g.
 *      lovable-assets create --file /tmp/dashboard.png > src/assets/shot-dashboard.png.asset.json
 * 3. Import the pointer here and set `src` on the matching screen below:
 *      import dashboardShot from "@/assets/shot-dashboard.png.asset.json";
 *      ... { id: "dashboard", src: dashboardShot.url, ... }
 *
 * Never substitute an illustration, mock-up or recreated UI. If `src` is empty the
 * card renders a clearly labelled placeholder slot instead.
 */

export interface ShowcaseCallout {
  /** Percentage position within the screenshot (0-100). */
  x: number;
  y: number;
  label: string;
}

export interface ShowcaseScreen {
  id: string;
  title: string;
  /** Why this feature matters to the operator. */
  why: string;
  /** URL of a real application screenshot. Leave undefined until one exists. */
  src?: string;
  alt?: string;
  callouts?: ShowcaseCallout[];
}

export const SHOWCASE_SCREENS: ShowcaseScreen[] = [
  {
    id: "dashboard",
    src: shotDashboard.url,
    title: "Dashboard",
    why: "Opens on what needs attention today, so nothing critical is missed before you trade.",
    alt: "MiseOS dashboard showing today's food safety status",
  },
  {
    id: "temperatures",
    src: shotTemperatures.url,
    title: "Temperature logging",
    why: "Fridge, freezer, hot-holding and probe readings logged in seconds — the records an inspector asks for first.",
    alt: "MiseOS temperature logging screen",
  },
  {
    id: "cleaning",
    src: shotCleaning.url,
    title: "Cleaning",
    why: "Your cleaning schedule with clear due, done and overdue states, signed off by whoever did the work.",
    alt: "MiseOS cleaning schedule screen",
  },
  {
    id: "batches",
    src: shotBatches.url,
    title: "Batch & traceability",
    why: "Production batches linked to ingredients and lot numbers, so a recall or complaint can be traced quickly.",
    alt: "MiseOS batch tracking and traceability screen",
  },
  {
    id: "training",
    src: shotTraining.url,
    title: "Staff training",
    why: "Training, certificates and fitness-to-work records held per person, with renewal dates visible.",
    alt: "MiseOS staff training screen",
  },
  {
    id: "inspection-pack",
    src: shotInspection.url,
    title: "Inspection Pack",
    why: "Every record your Environmental Health Officer needs, exported as one pack in seconds.",
    alt: "MiseOS Inspection Pack export screen",
  },
];

function PhoneFrame({ screen }: { screen: ShowcaseScreen }) {
  return (
    <div className="relative mx-auto w-full max-w-[240px]">
      <div className="rounded-[1.75rem] border border-slate-200 bg-slate-900/90 p-1.5 shadow-sm">
        <div className="relative overflow-hidden rounded-[1.4rem] bg-white aspect-[9/16]">
          {screen.src ? (
            <>
              <img
                src={screen.src}
                alt={screen.alt ?? `${screen.title} screen in MiseOS`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover object-top"
              />
              {screen.callouts?.map((c) => (
                <span
                  key={c.label}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200 shadow-sm"
                  style={{ left: `${c.x}%`, top: `${c.y}%` }}
                >
                  {c.label}
                </span>
              ))}
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 bg-slate-50 px-4 text-center">
              <ImageIcon className="h-5 w-5 text-slate-400" aria-hidden />
              <p className="text-[11px] font-semibold text-slate-600">
                Real screenshot required
              </p>
              <p className="text-[10px] text-slate-500">{screen.title}</p>
              <code className="text-[9px] text-slate-400">shot-{screen.id}.png</code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShowcaseCard({ screen, className }: { screen: ShowcaseScreen; className?: string }) {
  return (
    <figure
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
        className,
      )}
    >
      <PhoneFrame screen={screen} />
      <figcaption className="mt-4">
        <h3 className="font-semibold text-slate-900">{screen.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{screen.why}</p>
      </figcaption>
    </figure>
  );
}

export function ScreenshotShowcase({ screens = SHOWCASE_SCREENS }: { screens?: ShowcaseScreen[] }) {
  return (
    <>
      {/* Mobile: swipeable cards */}
      <div className="md:hidden -mx-4 px-4 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {screens.map((s) => (
          <ShowcaseCard key={s.id} screen={s} className="shrink-0 w-[80vw] max-w-[320px] snap-center" />
        ))}
      </div>
      <p className="md:hidden text-center text-xs text-slate-500 mt-1">Swipe to see more →</p>

      {/* Desktop: grid */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-4">
        {screens.map((s) => (
          <ShowcaseCard key={s.id} screen={s} className="hover:shadow-md transition-shadow" />
        ))}
      </div>
    </>
  );
}
