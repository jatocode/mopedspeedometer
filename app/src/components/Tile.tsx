import { View, Text, StyleSheet } from 'react-native'

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
    <View style={[styles.tile, wide && styles.wide]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, smallValue && styles.valueSmall]}>
        {children ?? value}
      </Text>
      {unit ? <Text style={styles.unit}>{unit}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center' as const,
  },
  wide: {
    // width fills the wideRow container — no native grid needed
  },
  label: {
    fontSize: 11,
    letterSpacing: 1,
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  value: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
  },
  valueSmall: {
    fontSize: 18,
  },
  unit: {
    fontSize: 12,
    color: '#666',
  },
})
