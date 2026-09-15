'use client'

import type { Project } from '@/data/projects'

type Props = {
  project: Project | null
}

export default function ProjectPanel({ project }: Props) {
  if (!project) return null

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-8 z-40 mx-auto max-w-2xl rounded-xl border border-white/20 bg-black/70 p-6 text-white backdrop-blur-md">
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/50">
        {project.tagline}
      </p>
      <h2 className="mb-3 text-2xl font-bold">{project.title}</h2>
      <p className="mb-4 text-sm leading-relaxed text-white/80">{project.description}</p>

      <ul className="mb-4 space-y-1">
        {project.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-sm text-white/70">
            <span className="mt-0.5 text-cyan-400">▸</span>
            {h}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        {project.stack.map((s) => (
          <span
            key={s}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70"
          >
            {s}
          </span>
        ))}
      </div>

      {project.links && project.links.length > 0 && (
        <div className="mt-4 flex gap-4">
          {project.links.map((l) => (
            <a
              key={l.label}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto text-xs text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
            >
              {l.label} ↗
            </a>
          ))}
        </div>
      )}
      <p className="mt-5 text-center text-xs text-white/30 tracking-widest uppercase">
        Press ↑ to continue driving
      </p>
    </div>
  )
}
