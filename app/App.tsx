import {
  ScrollView,
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useBluetooth } from './src/hooks/useBluetooth'
import Tile from './src/components/Tile'
import FixIndicator from './src/components/FixIndicator'

export default function App() {
  const {
    connectionState,
    status,
    speed,
    heading,
    altitude,
    satellites,
    fix,
    ipAddress,
    wheelCirc,
    pulsesPerRev,
    aux,
    auxDisabled,
    connect,
    setAux,
  } = useBluetooth()

  const btnDisabled = connectionState === 'connecting' || connectionState === 'connected'
  const btnLabel =
    connectionState === 'connecting'
      ? 'Connecting…'
      : connectionState === 'connected'
      ? 'Connected'
      : connectionState === 'disconnected'
      ? 'Reconnect'
      : 'Connect via Bluetooth'

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>

        <Text style={styles.title}>MOPED SPEEDO</Text>

        <Text style={styles.speedDisplay}>{speed}</Text>
        <Text style={styles.speedUnit}>km/h</Text>

        {/* 2-column tile grid */}
        <View style={styles.grid}>
          <View style={styles.row}>
            <View style={styles.col}><Tile label="Heading"      value={heading}      unit="degrees" /></View>
            <View style={styles.col}><Tile label="Altitude"     value={altitude}     unit="metres"  /></View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}><Tile label="Satellites"   value={satellites} /></View>
            <View style={styles.col}>
              <Tile label="GPS Fix" value="">
                <FixIndicator fix={fix} />
              </Tile>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.col}><Tile label="Wheel Circ."  value={wheelCirc}    unit="metres" /></View>
            <View style={styles.col}><Tile label="Pulses / Rev" value={pulsesPerRev} /></View>
          </View>
          <View style={styles.wideRow}>
            <Tile label="WiFi IP" value={ipAddress} smallValue />
          </View>
        </View>

        {/* Aux toggle row */}
        <View style={styles.auxRow}>
          <Text style={styles.auxLabel}>Aux Output</Text>
          <Switch
            value={aux}
            disabled={auxDisabled}
            onValueChange={setAux}
            trackColor={{ false: '#333', true: '#4caf50' }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity
          style={[styles.btn, btnDisabled && styles.btnDisabled]}
          onPress={connect}
          disabled={btnDisabled}
          activeOpacity={0.75}
        >
          <Text style={styles.btnText}>{btnLabel}</Text>
        </TouchableOpacity>

        <Text style={styles.status}>{status}</Text>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#111',
  },
  container: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 14,
    letterSpacing: 3,
    color: '#888',
    marginBottom: 24,
    fontWeight: '600',
  },
  speedDisplay: {
    fontSize: 96,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 96,
    letterSpacing: -4,
  },
  speedUnit: {
    fontSize: 20,
    color: '#888',
    marginBottom: 32,
    marginTop: 4,
  },
  grid: {
    width: '100%',
    maxWidth: 380,
    marginBottom: 32,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  wideRow: {
    width: '100%',
  },
  auxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  auxLabel: {
    fontSize: 14,
    color: '#888',
  },
  btn: {
    backgroundColor: '#2196f3',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 8,
    minWidth: 220,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    marginTop: 16,
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
  },
})

