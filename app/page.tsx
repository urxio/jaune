import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowRight,
  Sparkles,
  Compass,
  Flame,
  Moon,
  BookOpen,
} from "lucide-react";

export const metadata: Metadata = {
  title: "LocusAI — Your life, in focus.",
  description:
    "LocusAI is the AI operating system for ambitious people — learns your rhythm, tells you what matters today, and turns intention into compounding progress.",
  openGraph: {
    title: "LocusAI — Your life, in focus.",
    description: "An AI that learns your rhythm and tells you what matters today.",
  },
};

function LocusLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <g fill="oklch(0.82 0.15 75)" opacity="0.65">
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(45,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(135,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(225,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(315,50,50)" />
      </g>
      <g fill="oklch(0.96 0.005 250)">
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(90,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(180,50,50)" />
        <path d="M50,50 C36,46 34,19 50,7 C66,19 64,46 50,50" transform="rotate(270,50,50)" />
      </g>
    </svg>
  );
}

function Nav() {
  return (
    <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,720px)]">
      <nav className="lp-glass-pill flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2 pl-2">
          <LocusLogo size={20} />
          <span className="text-sm font-medium tracking-tight text-foreground">
            Locus<span className="italic-display" style={{ color: "oklch(0.82 0.15 75)" }}>AI</span>
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#how" className="hover:text-foreground transition">How it works</a>
          <a href="#system" className="hover:text-foreground transition">The system</a>
          <a href="#voice" className="hover:text-foreground transition">Voice</a>
        </div>
        <a
          href="/login"
          className="text-xs font-medium rounded-full px-4 py-2 hover:opacity-90 transition"
          style={{ background: "oklch(0.78 0.13 70)", color: "oklch(0.18 0.02 60)" }}
        >
          Begin brief
        </a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative pt-40 pb-28 px-6">
      <div className="silk-streak" />
      <div className="max-w-5xl mx-auto relative">
        <p className="label-eyebrow animate-float-up">Saturday, May 16 · 06:42</p>
        <h1
          className="mt-6 text-6xl md:text-8xl leading-[0.95] animate-float-up"
          style={{ animationDelay: "0.1s", fontFamily: "var(--font-serif)", fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          Your life,
          <br />
          <span className="italic-display">in focus.</span>
        </h1>
        <p
          className="mt-8 max-w-xl text-lg text-muted-foreground leading-relaxed animate-float-up"
          style={{ animationDelay: "0.2s" }}
        >
          LocusAI is a quiet intelligence that learns your rhythm, holds the
          shape of your life, and tells you — each morning — what actually
          matters today.
        </p>

        <div
          className="mt-10 flex flex-wrap items-center gap-4 animate-float-up"
          style={{ animationDelay: "0.3s" }}
        >
          <a
            href="/login"
            className="group inline-flex items-center gap-2 font-medium rounded-full px-7 py-4 hover:opacity-90 transition"
            style={{
              background: "oklch(0.78 0.13 70)",
              color: "oklch(0.18 0.02 60)",
              boxShadow: "0 10px 40px -10px oklch(0.78 0.13 70 / 0.6)",
            }}
          >
            Begin your brief
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </a>
          <span className="text-sm text-muted-foreground">No setup. Speak once. Locus listens.</span>
        </div>

        {/* Floating brief preview */}
        <div
          className="mt-20 grid md:grid-cols-[1.6fr_1fr] gap-5 animate-float-up"
          style={{ animationDelay: "0.45s" }}
        >
          <div className="glass p-8 md:p-10">
            <p className="label-eyebrow">From Locus</p>
            <p
              className="relative mt-4 text-xl md:text-2xl leading-relaxed"
              style={{
                fontFamily: "var(--font-serif)",
                color: "oklch(0.96 0.005 250 / 0.9)",
              }}
            >
              You&apos;re three days into the deep-work block and the signal is
              steady — focus held until 2pm yesterday, sleep above seven.
              Today&apos;s leverage is the proposal draft. Protect the morning,
              skip the gym, take a real walk after lunch.
            </p>
          </div>
          <div className="flex flex-col gap-5">
            <div className="glass p-6">
              <p className="label-eyebrow">Energy</p>
              <p className="relative mt-3 text-xl" style={{ color: "oklch(0.96 0.005 250 / 0.9)" }}>
                Clear, ascending
              </p>
              <div className="relative mt-3 flex gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 flex-1 rounded-full"
                    style={{
                      background: i <= 5 ? "oklch(0.78 0.13 70)" : "oklch(0.96 0.005 250 / 0.1)",
                    }}
                  />
                ))}
              </div>
              <p className="relative mt-3 text-xs text-muted-foreground">7/10 · best in 14 days</p>
            </div>
            <div className="glass p-6">
              <p className="label-eyebrow">Today</p>
              <ul className="relative mt-3 space-y-3 text-sm">
                {[
                  "Draft the Hartwell proposal — 90 min, no Slack",
                  "Walk 30 minutes after lunch",
                  "Call Mom before 6pm",
                ].map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <span
                      className="text-xs pt-0.5"
                      style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "oklch(0.82 0.15 75)" }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ color: "oklch(0.96 0.005 250 / 0.85)" }} className="leading-snug">
                      {t}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Sparkles,
      eyebrow: "Step one",
      title: "Check in",
      body: "Two minutes. Voice or tap. Energy, mood, what's on your mind. No forms, no friction.",
    },
    {
      icon: Compass,
      eyebrow: "Step two",
      title: "Locus understands",
      body: "It connects today to last week, your goals, your patterns. It sees the shape you can't.",
    },
    {
      icon: ArrowRight,
      eyebrow: "Step three",
      title: "Act with clarity",
      body: "A short, honest brief. Three priorities. One nudge. The right thing, named plainly.",
    },
  ];
  return (
    <section id="how" className="relative px-6 py-32">
      <div className="silk-streak opacity-60" />
      <div className="max-w-6xl mx-auto relative">
        <p className="label-eyebrow">The loop</p>
        <h2
          className="mt-4 text-4xl md:text-5xl max-w-2xl"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          A small daily ritual that <span className="italic-display">compounds</span>.
        </h2>

        <div className="mt-16 grid md:grid-cols-3 gap-5">
          {steps.map((s, i) => (
            <div key={i} className="glass p-8 group hover:-translate-y-0.5 transition duration-500">
              <div className="relative flex items-center justify-between">
                <p className="label-eyebrow">{s.eyebrow}</p>
                <s.icon className="h-4 w-4 opacity-70" style={{ color: "oklch(0.78 0.13 70)" }} />
              </div>
              <h3
                className="relative mt-6 text-3xl"
                style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
              >
                {s.title}
              </h3>
              <p className="relative mt-4 text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function System() {
  return (
    <section id="system" className="relative px-6 py-32">
      <div className="max-w-6xl mx-auto relative">
        <p className="label-eyebrow">Your system</p>
        <h2
          className="mt-4 text-4xl md:text-5xl max-w-2xl"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          Built for the things that <span className="italic-display">compound</span>.
        </h2>
        <p className="mt-5 max-w-xl text-muted-foreground">
          Habits, goals, journaling and reflection — held in one quiet place,
          read by an intelligence that actually remembers.
        </p>

        <div className="mt-16 grid md:grid-cols-6 gap-5 auto-rows-[minmax(180px,auto)]">
          {/* Habits */}
          <div className="glass p-7 md:col-span-3">
            <div className="relative flex items-center justify-between">
              <p className="label-eyebrow">Habits</p>
              <span className="text-xs text-muted-foreground">4 of 6 today</span>
            </div>
            <div className="relative mt-5 space-y-3">
              {[
                { name: "Deep work block", streak: 11, done: true },
                { name: "Read 20 pages", streak: 6, done: true },
                { name: "Move 30 min", streak: 3, done: false },
                { name: "No phone before 9am", streak: 9, done: true },
              ].map((h) => (
                <div key={h.name} className="flex items-center justify-between text-sm">
                  <span style={{ color: "oklch(0.96 0.005 250 / 0.85)" }}>{h.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Flame className="h-3 w-3" style={{ color: "oklch(0.78 0.13 70)" }} /> {h.streak}
                    </span>
                    <span
                      className="h-4 w-4 rounded-full border"
                      style={{
                        background: h.done ? "oklch(0.78 0.13 70)" : "transparent",
                        borderColor: h.done ? "oklch(0.78 0.13 70)" : "oklch(0.96 0.005 250 / 0.2)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Goal ring */}
          <div className="glass p-7 md:col-span-3 flex gap-6">
            <div className="relative shrink-0">
              <svg className="w-28 h-28 -rotate-90">
                <circle cx="56" cy="56" r="48" stroke="oklch(1 0 0 / 0.08)" strokeWidth="6" fill="none" />
                <circle
                  cx="56"
                  cy="56"
                  r="48"
                  stroke="oklch(0.82 0.15 75)"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 48 * 0.68} ${2 * Math.PI * 48}`}
                  strokeLinecap="round"
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-xl"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                68%
              </span>
            </div>
            <div className="relative flex-1">
              <p className="label-eyebrow">Quarter goal</p>
              <h3
                className="mt-2 text-2xl leading-tight"
                style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
              >
                Ship Hartwell v1
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">Q2 2026 · 14 of 21 steps · on pace</p>
              <div
                className="mt-4 h-1 rounded-full overflow-hidden"
                style={{ background: "oklch(0.96 0.005 250 / 0.1)" }}
              >
                <div className="h-full" style={{ width: "68%", background: "oklch(0.78 0.13 70)" }} />
              </div>
            </div>
          </div>

          {/* Energy chart */}
          <div className="glass p-7 md:col-span-4">
            <div className="relative flex items-center justify-between">
              <p className="label-eyebrow">Energy this week</p>
              <span className="text-xs text-muted-foreground">avg 6.4 · trending up</span>
            </div>
            <div className="relative mt-6">
              <svg viewBox="0 0 320 110" className="w-full h-28">
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.82 0.15 75)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="oklch(0.82 0.15 75)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,70 L45,60 L90,72 L135,50 L180,55 L225,38 L270,30 L320,22 L320,110 L0,110 Z"
                  fill="url(#g)"
                />
                <path
                  d="M0,70 L45,60 L90,72 L135,50 L180,55 L225,38 L270,30 L320,22"
                  fill="none"
                  stroke="oklch(0.82 0.15 75)"
                  strokeWidth="1.5"
                />
                {([0, 45, 90, 135, 180, 225, 270, 320] as number[]).map((x, i) => (
                  <circle
                    key={i}
                    cx={x}
                    cy={[70, 60, 72, 50, 55, 38, 30, 22][i]}
                    r="2"
                    fill="oklch(0.82 0.15 75)"
                  />
                ))}
              </svg>
              <div className="flex justify-between mt-2 text-muted-foreground" style={{ fontSize: "0.625rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Journal */}
          <div className="glass p-7 md:col-span-2">
            <div className="relative flex items-center justify-between">
              <p className="label-eyebrow">Journal</p>
              <BookOpen className="h-4 w-4 opacity-70" style={{ color: "oklch(0.78 0.13 70)" }} />
            </div>
            <p
              className="relative mt-5 leading-relaxed"
              style={{
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                color: "oklch(0.96 0.005 250 / 0.8)",
              }}
            >
              &ldquo;Finally felt the proposal click. Tired but right kind of tired.&rdquo;
            </p>
            <p className="relative mt-4 text-xs text-muted-foreground">Thu · 3 min entry</p>
          </div>

          {/* Tonight */}
          <div className="glass p-7 md:col-span-3">
            <p className="label-eyebrow">Tonight</p>
            <div className="relative mt-5 flex items-start gap-4">
              <Moon className="h-5 w-5 mt-1 shrink-0" style={{ color: "oklch(0.78 0.13 70)" }} />
              <p style={{ color: "oklch(0.96 0.005 250 / 0.85)" }} className="leading-relaxed">
                Wind down by 10:30. Two evenings of late screens is enough — your
                Thursday energy was the cost. Paper book, not the phone.
              </p>
            </div>
          </div>

          {/* Streak */}
          <div className="glass p-7 md:col-span-3">
            <div className="relative flex items-center justify-between">
              <p className="label-eyebrow">Self-control</p>
              <span
                className="text-sm"
                style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "oklch(0.82 0.15 75)" }}
              >
                × 21
              </span>
            </div>
            <p
              className="relative mt-4 text-3xl"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
            >
              21 days
            </p>
            <p className="relative mt-1 text-sm text-muted-foreground">
              Longest streak this year. Locus noticed.
            </p>
            <div
              className="relative mt-5 h-1 rounded-full overflow-hidden"
              style={{ background: "oklch(0.96 0.005 250 / 0.1)" }}
            >
              <div className="h-full w-full" style={{ background: "oklch(0.78 0.13 70)" }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Voice() {
  return (
    <section id="voice" className="relative px-6 py-36">
      <div className="silk-streak opacity-50" />
      <div className="max-w-3xl mx-auto relative text-center">
        <p className="label-eyebrow">A quiet voice</p>
        <p
          className="mt-8 text-3xl md:text-5xl leading-tight"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}
        >
          &ldquo;It&apos;s the first thing I&apos;ve used that felt like it was
          <span className="italic-display"> actually paying attention</span> —
          not nudging me, just naming what I already half-knew.&rdquo;
        </p>
        <p className="mt-8 text-sm text-muted-foreground tracking-wide">
          Maren K. · designer, two months in
        </p>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="relative px-6 py-36">
      <div className="max-w-3xl mx-auto relative text-center">
        <h2
          className="text-5xl md:text-7xl"
          style={{ fontFamily: "var(--font-serif)", fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          Find your <span className="italic-display">locus</span>.
        </h2>
        <p className="mt-6 text-muted-foreground max-w-md mx-auto">
          The mornings get clearer. The weeks start to mean something. Begin
          with a single check-in.
        </p>
        <div className="mt-10 flex justify-center">
          <a
            href="/login"
            className="group inline-flex items-center gap-2 font-medium rounded-full px-8 py-4 hover:opacity-90 transition"
            style={{
              background: "oklch(0.78 0.13 70)",
              color: "oklch(0.18 0.02 60)",
              boxShadow: "0 10px 40px -10px oklch(0.78 0.13 70 / 0.6)",
            }}
          >
            Begin your brief
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </a>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Free during early access · iOS &amp; web</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      className="relative px-6 py-10"
      style={{ borderTop: "1px solid oklch(0.96 0.005 250 / 0.08)" }}
    >
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <LocusLogo size={16} />
          <span>
            Locus<span className="italic-display" style={{ color: "oklch(0.82 0.15 75)", fontSize: "inherit" }}>AI</span>
          </span>
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-foreground transition">Manifesto</a>
          <a href="/privacy" className="hover:text-foreground transition">Privacy</a>
          <a href="#" className="hover:text-foreground transition">Contact</a>
        </div>
        <span className="text-xs">© 2026 LocusAI</span>
      </div>
    </footer>
  );
}

export default async function Landing() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/home");
  return (
    <main
      className="silk-bg min-h-screen relative overflow-hidden"
      style={{ color: "oklch(0.96 0.005 250)", fontFamily: "var(--font-sans)" }}
    >
      <Nav />
      <Hero />
      <HowItWorks />
      <System />
      <Voice />
      <FinalCTA />
      <Footer />
    </main>
  );
}
