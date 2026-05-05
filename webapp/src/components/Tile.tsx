interface TileProps {
  label: string
  value: string
  unit?: string
  wide?: boolean
  smallValue?: boolean
  children?: React.ReactNode
}

export default function Tile({ label, value, unit, wide, smallValue, children }: TileProps) {
  return (
    <div className="tile" style={wide ? { gridColumn: 'span 2' } : undefined}>
      <div className="label">{label}</div>
      <div className="value" style={smallValue ? { fontSize: '1.2rem' } : undefined}>
        {children ?? value}
      </div>
      {unit && <div className="unit">{unit}</div>}
    </div>
  )
}
