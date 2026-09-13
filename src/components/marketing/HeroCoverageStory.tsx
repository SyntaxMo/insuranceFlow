"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonClassName } from "@/components/ui/Forms";
import styles from "./HeroCoverageStory.module.css";

type CoverageMode = "compare" | "comprehensive" | "third-party";
type ProtectionView = "vehicle" | "liability";

const hotspots = [
  {
    id: "windshield",
    label: "Windshield",
    position: { left: "59%", top: "35%" },
    tooltipPlacement: "below",
    copy: {
      comprehensive: "Example protection under Comprehensive coverage, subject to policy terms.",
      "third-party": "Own-windshield damage is not included in this simplified Third Party example.",
    },
  },
  {
    id: "front-bumper",
    label: "Front bumper",
    position: { left: "84%", top: "64%" },
    tooltipPlacement: "upper-right",
    copy: {
      comprehensive: "Example own-vehicle impact protection under Comprehensive coverage, subject to policy terms.",
      "third-party": "Own-bumper damage is not included in this simplified Third Party example.",
    },
  },
  {
    id: "doors-body",
    label: "Doors & body",
    position: { left: "48%", top: "57%" },
    tooltipPlacement: "upper-center",
    copy: {
      comprehensive: "Example protection for visible body damage under Comprehensive coverage, subject to policy terms.",
      "third-party": "Damage to your own doors and body is not included in this simplified Third Party example.",
    },
  },
  {
    id: "rear-body",
    label: "Rear body",
    position: { left: "25%", top: "55%" },
    tooltipPlacement: "upper-left",
    copy: {
      comprehensive: "Example rear-body damage protection under Comprehensive coverage, subject to policy terms.",
      "third-party": "Own rear-body damage is not included in this simplified Third Party example.",
    },
  },
] as const;

export function HeroCoverageStory() {
  const coverageRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const [coverageVisible, setCoverageVisible] = useState(false);
  const [mode, setMode] = useState<CoverageMode>("compare");
  const [protectionView, setProtectionView] = useState<ProtectionView>("vehicle");
  const [activeId, setActiveId] = useState<(typeof hotspots)[number]["id"] | null>(null);

  useEffect(() => {
    const node = coverageRef.current;
    if (!node || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setCoverageVisible(entry.isIntersecting), {
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.05,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!visualRef.current?.contains(event.target as Node)) setActiveId(null);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [activeId]);

  const selectMode = (nextMode: CoverageMode) => {
    setMode(nextMode);
    setActiveId(null);
  };

  const selectProtectionView = (nextView: ProtectionView) => {
    setProtectionView(nextView);
    setActiveId(null);
  };

  const modeLabel = mode === "compare" ? "Compare both" : mode === "comprehensive" ? "Comprehensive" : "Third Party";
  const liabilityCopy = mode === "comprehensive"
    ? "Comprehensive includes third-party liability in this simplified comparison."
    : mode === "third-party"
      ? "Third Party focuses on liability involving other people and property."
      : "Both options include third-party liability here; it is the primary focus of Third Party coverage.";

  return (
    <section className={styles.story}>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_12%,rgba(153,230,218,0.24),transparent_28%),radial-gradient(circle_at_88%_28%,rgba(186,220,239,0.38),transparent_30%),linear-gradient(180deg,#faffff_0%,#f3f8f8_52%,#f7fafb_100%)]" />
      <div className={`${styles.storyGrid} mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8`} data-coverage={coverageVisible || undefined}>
        <div className={`${styles.heroStage} flex items-center py-14 sm:py-20 lg:pr-10`}>
          <div className={`${styles.heroCopy} max-w-2xl`}>
            <p className="inline-flex rounded-full border border-teal-200 bg-white/75 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-teal)] shadow-sm">Motor insurance, simplified</p>
            <h1 className="mt-6 text-[clamp(2.75rem,7vw,5.5rem)] font-bold leading-[0.98] tracking-[-0.055em] text-[var(--brand-navy)]">Drive with confidence.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">Explore a clearer way to get and manage demo motor policies, file claims, upload documents, and follow progress—with AI-assisted review supporting human decisions.</p>
            <div className="mt-8 flex flex-col gap-3 min-[430px]:flex-row"><Link href="/signup" className={buttonClassName("primary", "px-6 py-3.5 text-base")}>Create account</Link><Link href="#how-it-works" className={buttonClassName("secondary", "bg-white/80 px-6 py-3.5 text-base")}>Explore how it works</Link></div>
            <ul aria-label="InsureFlow benefits" className="mt-8 grid gap-4 min-[520px]:grid-cols-3 lg:gap-5">
              <li className="border-l-2 border-teal-200 pl-3">
                <p className="text-sm font-semibold text-[var(--brand-navy)]">Fast &amp; easy</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Move from vehicle details to a demo quote in minutes.</p>
              </li>
              <li className="border-l-2 border-teal-200 pl-3">
                <p className="text-sm font-semibold text-[var(--brand-navy)]">Transparent</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">See clear policy and claim information.</p>
              </li>
              <li className="border-l-2 border-teal-200 pl-3">
                <p className="text-sm font-semibold text-[var(--brand-navy)]">AI-assisted</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Structured insights support human decisions.</p>
              </li>
            </ul>
            <p className="mt-5 text-xs leading-5 text-slate-500">A portfolio demonstration. Quotes, payments, and policies are simulated.</p>
          </div>
        </div>

        <div ref={coverageRef} id="coverage" className={`${styles.coverageStage} scroll-mt-24 flex items-center py-12 sm:py-20 lg:pr-12`}>
          <div className="w-full max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-teal)]">Coverage examples</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.035em] text-[var(--brand-navy)] sm:text-4xl">See how coverage can differ.</h2>
            <p className="mt-4 max-w-lg leading-7 text-slate-600">Explore simplified examples around the vehicle. Actual coverage is subject to policy terms and conditions.</p>

            <div role="group" aria-label="Coverage comparison mode" className="mt-7 grid grid-cols-3 rounded-xl bg-slate-200/65 p-1">
              <button type="button" aria-pressed={mode === "compare"} onClick={() => selectMode("compare")} className={`min-h-11 rounded-lg px-2 text-xs font-semibold transition sm:text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] ${mode === "compare" ? "bg-white text-[var(--brand-navy)] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Compare both</button>
              <button type="button" aria-pressed={mode === "comprehensive"} onClick={() => selectMode("comprehensive")} className={`min-h-11 rounded-lg px-2 text-xs font-semibold transition sm:text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] ${mode === "comprehensive" ? "bg-white text-[var(--brand-navy)] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Comprehensive</button>
              <button type="button" aria-pressed={mode === "third-party"} onClick={() => selectMode("third-party")} className={`min-h-11 rounded-lg px-2 text-xs font-semibold transition sm:text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] ${mode === "third-party" ? "bg-white text-[var(--brand-navy)] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Third Party</button>
            </div>

            <div className="mt-5">
              <p id="protection-view-label" className="text-xs font-medium text-slate-500">What are you protecting?</p>
              <div role="group" aria-labelledby="protection-view-label" className="mt-2 grid grid-cols-[0.82fr_1.18fr] rounded-lg border border-slate-200/80 bg-white/55 p-0.5">
                <button type="button" aria-pressed={protectionView === "vehicle"} onClick={() => selectProtectionView("vehicle")} className={`min-h-9 rounded-md px-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] ${protectionView === "vehicle" ? "bg-white text-[var(--brand-navy)] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Your vehicle</button>
                <button type="button" aria-pressed={protectionView === "liability"} onClick={() => selectProtectionView("liability")} className={`min-h-9 rounded-md px-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-teal)] ${protectionView === "liability" ? "bg-white text-[var(--brand-navy)] shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>Other people &amp; property</button>
              </div>
            </div>

            {protectionView === "vehicle" ? (
              <>
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  <span className={styles.pointerHelper}>Hover over or focus a highlighted area to {mode === "compare" ? "compare both options" : `explore ${modeLabel}`}.</span>
                  <span className={styles.touchHelper}>Tap a highlighted area to {mode === "compare" ? "compare both options" : `explore ${modeLabel}`}.</span>
                </p>
                {mode === "third-party" ? <p className="mt-3 text-sm leading-6 text-slate-600">Third Party focuses on liability involving other people and property rather than damage to your own vehicle.</p> : null}
              </>
            ) : null}
          </div>
        </div>

        <div className={`${styles.visualColumn} min-h-[19rem] sm:min-h-[30rem]`} data-coverage={coverageVisible || undefined}>
          <div ref={visualRef} className={`${styles.visualInner} relative flex w-full items-center justify-center py-4 lg:pl-4`}>
            <div className="absolute left-[8%] top-[18%] size-36 rounded-full bg-teal-200/35 blur-3xl sm:size-48" />
            <div className="absolute bottom-[18%] right-[5%] size-40 rounded-full bg-sky-200/45 blur-3xl sm:size-56" />
            <div className="absolute inset-x-[16%] bottom-[22%] h-8 rounded-full bg-slate-900/10 blur-2xl" />
            <div className={`${styles.car} relative z-10 w-full max-w-[45rem]`}>
              <div className="relative aspect-[3/2]">
                <Image src="/brand/hero-car.webp" alt="Modern dark blue crossover illustrating digital motor insurance coverage" fill loading="eager" sizes="(max-width: 1023px) 94vw, 54vw" className="object-contain drop-shadow-[0_26px_25px_rgba(15,23,42,0.2)]" />
                {protectionView === "vehicle" ? hotspots.map((hotspot) => {
                  const selected = activeId === hotspot.id;
                  const tooltipId = `coverage-tooltip-${hotspot.id}`;
                  return (
                    <div key={hotspot.id}>
                      <button
                        type="button"
                        aria-label={`${mode === "compare" ? "Compare" : "Show"} ${hotspot.label} ${modeLabel} coverage example`}
                        aria-describedby={selected ? tooltipId : undefined}
                        aria-expanded={selected}
                        onFocus={() => setActiveId(hotspot.id)}
                        onBlur={() => setActiveId(null)}
                        onMouseEnter={() => setActiveId(hotspot.id)}
                        onMouseLeave={() => setActiveId(null)}
                        onPointerDown={(event) => {
                          if (event.pointerType === "touch" || event.pointerType === "pen") {
                            setActiveId((current) => current === hotspot.id ? null : hotspot.id);
                          } else {
                            event.preventDefault();
                          }
                        }}
                        style={hotspot.position}
                        className={`${styles.marker} absolute z-20 flex size-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-navy)]`}
                      >
                        <span className={`flex size-5 items-center justify-center rounded-full border bg-white/95 shadow-md ${selected ? `${styles.activeRing} border-teal-500` : mode === "third-party" ? "border-slate-300 opacity-55" : "border-teal-300"}`}><span className={`size-2 rounded-full ${mode === "third-party" && !selected ? "bg-slate-400" : "bg-[var(--brand-teal)]"}`} /></span>
                      </button>
                      {selected ? (
                        <div id={tooltipId} role="tooltip" style={hotspot.position} className={`${styles.tooltip} ${mode === "compare" ? styles.compareTooltip : ""} ${styles[hotspot.tooltipPlacement]}`}>
                          <p className="text-sm font-semibold text-[var(--brand-navy)]">{hotspot.label}</p>
                          {mode === "compare" ? (
                            <div className={styles.compareGrid}>
                              <div>
                                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--brand-teal)]">Comprehensive</p>
                                <p className="mt-1 text-xs leading-5 text-slate-600"><span aria-hidden="true" className="mr-1 font-bold text-[var(--brand-teal)]">✓</span>{hotspot.copy.comprehensive}</p>
                              </div>
                              <div>
                                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-500">Third Party</p>
                                <p className="mt-1 text-xs leading-5 text-slate-600"><span aria-hidden="true" className="mr-1 font-bold text-slate-400">—</span>{hotspot.copy["third-party"]}</p>
                              </div>
                            </div>
                          ) : <p className="mt-1 text-xs leading-5 text-slate-600">{hotspot.copy[mode]}</p>}
                          <p className="mt-2 border-t border-slate-100 pt-2 text-[0.68rem] text-slate-400">Illustrative comparison only. Subject to policy terms.</p>
                        </div>
                      ) : null}
                    </div>
                  );
                }) : (
                  <div aria-live="polite" className={styles.liabilityNote}>
                    <p className="text-xs font-semibold text-[var(--brand-navy)]">Other people &amp; property</p>
                    <p className="mt-1 text-[0.7rem] leading-5 text-slate-500">{liabilityCopy}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
