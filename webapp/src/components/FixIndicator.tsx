interface FixIndicatorProps {
  fix: boolean | null
}

export default function FixIndicator({ fix }: FixIndicatorProps) {
  const cls =
    fix === null ? 'fix-indicator' : fix ? 'fix-indicator fix' : 'fix-indicator no-fix'
  const text = fix === null ? '--' : fix ? 'Fix' : 'No fix'
  return (
    <>
      <span className={cls} />
      <span>{text}</span>
    </>
  )
}
