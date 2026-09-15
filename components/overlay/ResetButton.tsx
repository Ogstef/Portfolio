type Props = {
  onReset: () => void
}

export default function ResetButton({ onReset }: Props) {
  return (
    <button
      type="button"
      onClick={onReset}
      className="fixed bottom-20 right-4 z-50 rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
    >
      Reset car
    </button>
  )
}
