import { useCallback, useRef, useState } from 'react'
import { BleManager, Device, Characteristic, BleError } from 'react-native-ble-plx'
import { Buffer } from 'buffer'
import { PermissionsAndroid, Platform } from 'react-native'

// ── BLE UUIDs ────────────────────────────────────────────────────────────────
const SERVICE_UUID   = '4fafc201-1fb5-459e-8fcc-c5c9c331914b'
const CHR_SPEED      = 'beb5483e-36e1-4688-b7f5-ea07361b26a8'
const CHR_HEADING    = 'beb5483f-36e1-4688-b7f5-ea07361b26a8'
const CHR_ALTITUDE   = 'beb54840-36e1-4688-b7f5-ea07361b26a8'
const CHR_SATELLITES = 'beb54841-36e1-4688-b7f5-ea07361b26a8'
const CHR_FIX_STATUS = 'beb54842-36e1-4688-b7f5-ea07361b26a8'
const CHR_AUX_OUTPUT = 'beb54843-36e1-4688-b7f5-ea07361b26a8'
const CHR_IP_ADDRESS = 'beb54844-36e1-4688-b7f5-ea07361b26a8'
const CHR_WHEEL_CIRC = 'beb54845-36e1-4688-b7f5-ea07361b26a8'
const CHR_PULSES     = 'beb54846-36e1-4688-b7f5-ea07361b26a8'

// ── Types (same interface as webapp) ─────────────────────────────────────────
export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected'

export interface BluetoothState {
  connectionState: ConnectionState
  status: string
  speed: string
  heading: string
  altitude: string
  satellites: string
  fix: boolean | null
  ipAddress: string
  wheelCirc: string
  pulsesPerRev: string
  aux: boolean
  auxDisabled: boolean
}

export interface BluetoothActions {
  connect: () => Promise<void>
  setAux: (value: boolean) => Promise<void>
}

// ── Decode helpers ────────────────────────────────────────────────────────────
const decodeFloat32LE = (b64: string): number =>
  new DataView(Buffer.from(b64, 'base64').buffer).getFloat32(0, true)

const decodeUint8 = (b64: string): number =>
  Buffer.from(b64, 'base64')[0] ?? 0

const encodeUint8 = (value: number): string =>
  Buffer.from([value]).toString('base64')

// Single BleManager instance shared across renders
const manager = new BleManager()

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useBluetooth(): BluetoothState & BluetoothActions {
  const [state, setState] = useState<BluetoothState>({
    connectionState: 'idle',
    status: 'Press the button to scan for the device.',
    speed: '--',
    heading: '--',
    altitude: '--',
    satellites: '--',
    fix: null,
    ipAddress: '--',
    wheelCirc: '--',
    pulsesPerRev: '--',
    aux: false,
    auxDisabled: true,
  })

  const deviceRef = useRef<Device | null>(null)
  const ignoreAuxNotifyRef = useRef(false)

  const connect = useCallback(async () => {
    // Android: request permissions at runtime
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ])
      const allGranted = Object.values(granted).every(
        v => v === PermissionsAndroid.RESULTS.GRANTED,
      )
      if (!allGranted) {
        setState(s => ({ ...s, status: 'Bluetooth permissions denied.' }))
        return
      }
    }

    setState(s => ({ ...s, connectionState: 'connecting', status: 'Scanning…' }))

    try {
      const device = await new Promise<Device>((resolve, reject) => {
        const timeout = setTimeout(() => {
          manager.stopDeviceScan()
          reject(new Error('Scan timeout — device not found.'))
        }, 10_000)

        manager.startDeviceScan([SERVICE_UUID], null, (error, scannedDevice) => {
          if (error) {
            clearTimeout(timeout)
            reject(error)
            return
          }
          if (scannedDevice) {
            clearTimeout(timeout)
            manager.stopDeviceScan()
            resolve(scannedDevice)
          }
        })
      })

      setState(s => ({ ...s, status: `Found ${device.name ?? device.id}. Connecting…` }))

      let connected: Device | null = null
      for (let attempt = 1; attempt <= 3; attempt++) {
        setState(s => ({
          ...s,
          status: attempt === 1 ? 'Connecting…' : `Connecting… (attempt ${attempt})`,
        }))
        try {
          connected = await device.connect({ timeout: 6000 })
          break
        } catch (err) {
          if (attempt === 3) throw new Error(`Could not connect after 3 attempts: ${(err as Error).message}`)
          await new Promise(r => setTimeout(r, 1500))
        }
      }

      if (!connected) throw new Error('Connection failed.')

      device.onDisconnected(() => {
        setState(s => ({
          ...s,
          connectionState: 'disconnected',
          status: 'Disconnected.',
          auxDisabled: true,
        }))
        deviceRef.current = null
      })

      setState(s => ({ ...s, status: 'Discovering services…' }))
      await connected.discoverAllServicesAndCharacteristics()
      deviceRef.current = connected

      // ── Monitor (notify) characteristics ──────────────────────────────────
      const monitor = (
        chrUUID: string,
        handler: (chr: Characteristic) => void,
      ) => {
        connected!.monitorCharacteristicForService(
          SERVICE_UUID,
          chrUUID,
          (err: BleError | null, chr: Characteristic | null) => {
            if (err || !chr?.value) return
            handler(chr)
          },
        )
      }

      monitor(CHR_SPEED, chr =>
        setState(s => ({ ...s, speed: decodeFloat32LE(chr.value!).toFixed(1) })),
      )
      monitor(CHR_HEADING, chr =>
        setState(s => ({ ...s, heading: decodeFloat32LE(chr.value!).toFixed(0) + '°' })),
      )
      monitor(CHR_ALTITUDE, chr =>
        setState(s => ({ ...s, altitude: decodeFloat32LE(chr.value!).toFixed(0) })),
      )
      monitor(CHR_SATELLITES, chr =>
        setState(s => ({ ...s, satellites: String(decodeUint8(chr.value!)) })),
      )
      monitor(CHR_FIX_STATUS, chr =>
        setState(s => ({ ...s, fix: decodeUint8(chr.value!) === 1 })),
      )
      monitor(CHR_IP_ADDRESS, chr => {
        setState(s => ({
          ...s,
          ipAddress: Buffer.from(chr.value!, 'base64').toString('utf8'),
        }))
      })
      monitor(CHR_AUX_OUTPUT, chr => {
        if (ignoreAuxNotifyRef.current) { ignoreAuxNotifyRef.current = false; return }
        setState(s => ({ ...s, aux: decodeUint8(chr.value!) === 1 }))
      })

      // ── Read-once characteristics ──────────────────────────────────────────
      const ipChr = await connected.readCharacteristicForService(SERVICE_UUID, CHR_IP_ADDRESS)
      if (ipChr.value) {
        setState(s => ({
          ...s,
          ipAddress: Buffer.from(ipChr.value!, 'base64').toString('utf8'),
        }))
      }

      const auxChr = await connected.readCharacteristicForService(SERVICE_UUID, CHR_AUX_OUTPUT)
      if (auxChr.value) {
        setState(s => ({ ...s, aux: decodeUint8(auxChr.value!) === 1, auxDisabled: false }))
      }

      const wheelChr = await connected.readCharacteristicForService(SERVICE_UUID, CHR_WHEEL_CIRC)
      if (wheelChr.value) {
        setState(s => ({ ...s, wheelCirc: decodeFloat32LE(wheelChr.value!).toFixed(3) }))
      }

      const pulsesChr = await connected.readCharacteristicForService(SERVICE_UUID, CHR_PULSES)
      if (pulsesChr.value) {
        setState(s => ({ ...s, pulsesPerRev: String(decodeUint8(pulsesChr.value!)) }))
      }

      setState(s => ({
        ...s,
        connectionState: 'connected',
        status: `Connected to ${device.name ?? device.id}`,
      }))
    } catch (err) {
      setState(s => ({
        ...s,
        connectionState: 'idle',
        status: `Error: ${(err as Error).message}`,
      }))
    }
  }, [])

  const setAux = useCallback(async (value: boolean) => {
    const device = deviceRef.current
    if (!device) return
    ignoreAuxNotifyRef.current = true
    try {
      await device.writeCharacteristicWithResponseForService(
        SERVICE_UUID,
        CHR_AUX_OUTPUT,
        encodeUint8(value ? 1 : 0),
      )
      setState(s => ({ ...s, aux: value }))
    } catch (err) {
      ignoreAuxNotifyRef.current = false
      setState(s => ({ ...s, status: `AUX write error: ${(err as Error).message}` }))
    }
  }, [])

  return { ...state, connect, setAux }
}
