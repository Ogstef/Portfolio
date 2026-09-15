import { projects } from '@/data/projects'

export const metadata = {
  title: 'Projects & Resume — Stefanos Georgiou',
  description: 'Backend Java/Spring Boot engineer — project list and resume',
}

export default function ResumePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-white">
      <a
        href="/"
        className="mb-10 inline-block text-sm text-white/50 hover:text-white transition-colors"
      >
        ← Back to 3D experience
      </a>

      <h1 className="mb-2 text-3xl font-bold">Stefanos Georgiou</h1>
      <p className="mb-10 text-white/60">
        Backend Java/Spring Boot engineer · ~2 years professional experience ·
        Accenture / Eurobank CRM · targeting senior &amp; remote roles
      </p>

      <h2 className="mb-6 text-xl font-semibold">Projects</h2>
      <div className="space-y-10">
        {projects.map((p) => (
          <article key={p.id} className="border-l-2 border-white/20 pl-6">
            <h3 className="mb-1 text-lg font-semibold">{p.title}</h3>
            <p className="mb-2 text-sm text-white/50">{p.tagline}</p>
            <p className="mb-3 text-sm leading-relaxed text-white/70">{p.description}</p>

            <ul className="mb-3 space-y-1">
              {p.highlights.map((h) => (
                <li key={h} className="text-sm text-white/60 before:mr-2 before:content-['▸']">
                  {h}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2">
              {p.stack.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-white/20 px-2 py-0.5 text-xs text-white/50"
                >
                  {s}
                </span>
              ))}
            </div>

            {p.links && p.links.length > 0 && (
              <div className="mt-3 flex gap-4">
                {p.links.map((l) => (
                  <a
                    key={l.label}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
                  >
                    {l.label} ↗
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </main>
  )
}
