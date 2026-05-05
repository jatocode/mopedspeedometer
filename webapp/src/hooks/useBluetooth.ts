import { useCallback, useRef, useState } from 'react'

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

// ── Types ────────────────────────────────────────────────────────────────────
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

// ── Helpers ──────────────────────────────────────────────────────────────────
const readFloat32LE = (e: Event): number => {
  const chr = e.target as BluetoothRemoteGATTCharacteristic
  return new DataView(chr.value!.buffer).getFloat32(0, true)
}

const readUint8 = (e: Event): number => {
  const chr = e.target as BluetoothRemoteGATTCharacteristic
  return new DataView(chr.value!.buffer).getUint8(0)
}

const connectWithTimeout = (device: BluetoothDevice): Promise<BluetoothRemoteGATTServer> =>
  Promise.race([
    device.gatt!.connect(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('connect timeout')), 6000),
    ),
  ])

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useBluetooth(): BluetoothState & BluetoothActions {
  const [state, setState] = useState<BluetoothState>({
    connectionState: 'idle',
    status: 'Web Bluetooth requires Chrome on Android/desktop.',
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

  // Ref so the aux-write callback always has the latest characteristic
  const chrAuxRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  // Guard to avoid echoing our own write back to state
  const ignoreAuxNotifyRef = useRef(false)

  const connect = useCallback(async () => {
    if (!navigator.bluetooth) {
      setState(s => ({ ...s, status: 'Web Bluetooth not supported in this browser.' }))
      return
    }

    setState(s => ({ ...s, connectionState: 'connecting', status: 'Scanning…' }))

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [SERVICE_UUID],
      })

      device.addEventListener('gattserverdisconnected', () => {
        setState(s => ({
          ...s,
          connectionState: 'disconnected',
          status: 'Disconnected.',
          auxDisabled: true,
        }))
        chrAuxRef.current = null
      })

      // Connect with retry
      let server!: BluetoothRemoteGATTServer
      for (let attempt = 1; attempt <= 3; attempt++) {
        setState(s => ({
          ...s,
          status: attempt === 1 ? 'Connecting…' : `Connecting… (attempt ${attempt})`,
        }))
        try {
          server = await connectWithTimeout(device)
          break
        } catch (err) {
          if (attempt === 3) throw new Error(`Could not connect after 3 attempts: ${(err as Error).message}`)
          await new Promise(r => setTimeout(r, 1500))
        }
      }

      setState(s => ({ ...s, status: 'Discovering services…' }))
      const allServices = await Promise.race([
        server.getPrimaryServices(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('discovery timeout')), 10_000),
        ),
      ])
      const service = allServices.find(s => s.uuid === SERVICE_UUID)
      if (!service) {
        throw new Error(
          `Service ${SERVICE_UUID} not found. Found: ${allServices.map(s => s.uuid).join(', ')}`,
        )
      }

      setState(s => ({ ...s, status: 'Reading characteristics…' }))
      const allChars = await service.getCharacteristics()
      const chars = new Map(allChars.map(c => [c.uuid, c]))

      // ── Subscribe to notify characteristics ────────────────────────────────
      const sub = async (uuid: string, handler: (e: Event) => void) => {
        const chr = chars.get(uuid)
        if (!chr) throw new Error(`Characteristic ${uuid} not found`)
        chr.addEventListener('characteristicvaluechanged', handler)
        await chr.startNotifications()
        return chr
      }

      await sub(CHR_SPEED, e =>
        setState(s => ({ ...s, speed: readFloat32LE(e).toFixed(1) })),
      )
      await sub(CHR_HEADING, e =>
        setState(s => ({ ...s, heading: readFloat32LE(e).toFixed(0) + '°' })),
      )
      await sub(CHR_ALTITUDE, e =>
        setState(s => ({ ...s, altitude: readFloat32LE(e).toFixed(0) })),
      )
      await sub(CHR_SATELLITES, e =>
        setState(s => ({ ...s, satellites: String(readUint8(e)) })),
      )
      await sub(CHR_FIX_STATUS, e =>
        setState(s => ({ ...s, fix: readUint8(e) === 1 })),
      )

      // ── IP address (read + notify) ─────────────────────────────────────────
      const chrIp = chars.get(CHR_IP_ADDRESS)
      if (chrIp) {
        const initIp = await chrIp.readValue()
        setState(s => ({ ...s, ipAddress: new TextDecoder().decode(initIp) }))
        chrIp.addEventListener('characteristicvaluechanged', e => {
          const chr = e.target as BluetoothRemoteGATTCharacteristic
          setState(s => ({
            ...s,
            ipAddress: new TextDecoder().decode(chr.value!),
          }))
        })
        await chrIp.startNotifications()
      }

      // ── Aux output (read + notify + write) ────────────────────────────────
      const chrAux = chars.get(CHR_AUX_OUTPUT)
      if (!chrAux) throw new Error(`AUX characteristic ${CHR_AUX_OUTPUT} not found`)
      const initAux = await chrAux.readValue()
      const initAuxVal = new DataView(initAux.buffer).getUint8(0) === 1
      chrAux.addEventListener('characteristicvaluechanged', e => {
        if (ignoreAuxNotifyRef.current) { ignoreAuxNotifyRef.current = false; return }
        setState(s => ({ ...s, aux: readUint8(e) === 1 }))
      })
      await chrAux.startNotifications()
      chrAuxRef.current = chrAux
      setState(s => ({ ...s, aux: initAuxVal, auxDisabled: false }))

      // ── Read-once characteristics ──────────────────────────────────────────
      const chrWheelCirc = chars.get(CHR_WHEEL_CIRC)
      if (chrWheelCirc) {
        const v = await chrWheelCirc.readValue()
        setState(s => ({
          ...s,
          wheelCirc: new DataView(v.buffer).getFloat32(0, true).toFixed(3),
        }))
      }
      const chrPulses = chars.get(CHR_PULSES)
      if (chrPulses) {
        const v = await chrPulses.readValue()
        setState(s => ({
          ...s,
          pulsesPerRev: String(new DataView(v.buffer).getUint8(0)),
        }))
      }

      setState(s => ({
        ...s,
        connectionState: 'connected',
        status: `Connected to ${device.name ?? 'device'}`,
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
    if (!chrAuxRef.current) return
    ignoreAuxNotifyRef.current = true
    try {
      await chrAuxRef.current.writeValue(new Uint8Array([value ? 1 : 0]))
      setState(s => ({ ...s, aux: value }))
    } catch (err) {
      ignoreAuxNotifyRef.current = false
      setState(s => ({ ...s, status: `AUX write error: ${(err as Error).message}` }))
    }
  }, [])

  return { ...state, connect, setAux }
}
