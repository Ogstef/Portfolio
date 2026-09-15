type Props = {
  enabled: boolean
  onToggle: () => void
}

export default function CinematicToggle({ enabled, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
    >
      <span
        className={`h-2 w-2 rounded-full ${enabled ? 'bg-cyan-400' : 'bg-white/30'}`}
        aria-hidden="true"
      />
      Cutscenes: {enabled ? 'On' : 'Off'}
    </button>
  )
}
