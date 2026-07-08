import { ArrowRight, Search, Sparkles } from "lucide-react";

const scannerHref = "/scanner";
const signInHref = "/auth?next=%2Fapp";
const signUpHref = "/auth?mode=sign_up&next=%2Fapp";

const navLinks = [
  { href: scannerHref, label: "Scanner" },
  { href: "#product", label: "Product" },
  { href: "#structure", label: "Structure" },
  { href: "#memory", label: "Memory" },
];

export function SimOnePublicLanding() {
  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-zinc-800 bg-[#09090b]/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="flex items-center gap-3" aria-label="SimOne home">
            <span className="grid h-8 w-8 place-items-center bg-white text-lg font-black text-zinc-950">
              S
            </span>
            <span className="text-2xl font-semibold tracking-normal">SimOne</span>
          </a>
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-sm text-zinc-400 transition hover:text-white">
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <a href={signInHref} className="text-sm font-medium text-zinc-300 transition hover:text-white">
              Sign in
            </a>
            <a
              href={signUpHref}
              className="inline-flex h-10 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100"
            >
              Sign up
            </a>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden px-6 pt-40">
        <div className="pointer-events-none absolute left-1/2 top-40 h-[620px] w-[980px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(113,112,255,0.14)_0%,transparent_70%)]" />
        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-10rem)] w-full max-w-7xl content-center pb-24">
          <div className="max-w-4xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-sm text-zinc-400">
              <Sparkles className="h-4 w-4 text-[#7170ff]" aria-hidden="true" />
              Systems Intelligence Model for AI-first companies
            </div>
            <h1 className="max-w-4xl text-balance text-5xl font-medium leading-[1.04] text-white md:text-6xl lg:text-7xl">
              A conscious operating layer for AI-first companies.
            </h1>
            <p className="mt-8 max-w-3xl text-lg leading-8 text-zinc-400 md:text-xl">
              Build your next-generation company around four value engines, four coordination drivers,
              and AI agents that know how the whole system is supposed to work.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={scannerHref}
                className="inline-flex h-12 w-fit items-center gap-2 rounded-lg bg-white px-5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-100"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                Find your bottleneck
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <span className="text-sm text-zinc-500">
                Get one useful readout before you sign in.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="product" className="border-t border-zinc-900 px-6 py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-6 md:grid-cols-3">
          {[
            ["Product", "Sharpen the promise and proof loop."],
            ["Customer", "Turn scattered signal into one trusted review path."],
            ["Cash", "Keep money decisions visible and human-approved."],
          ].map(([title, body]) => (
            <div key={title} className="border-t border-zinc-800 pt-5">
              <h2 className="text-lg font-medium text-white">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
