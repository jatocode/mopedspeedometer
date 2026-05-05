import { View, Text, StyleSheet } from 'react-native'

interface FixIndicatorProps {
  fix: boolean | null
}

export default function FixIndicator({ fix }: FixIndicatorProps) {
  const dotStyle =
    fix === null
      ? styles.dotUnknown
      : fix
      ? styles.dotFix
      : styles.dotNoFix
  const text = fix === null ? '--' : fix ? 'Fix' : 'No fix'

  return (
    <View style={styles.row}>
      <View style={[styles.dot, dotStyle]} />
      <Text style={styles.text}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  dotUnknown: { backgroundColor: '#555' },
  dotFix:     { backgroundColor: '#4caf50' },
  dotNoFix:   { backgroundColor: '#f44336' },
  text: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
  },
})
