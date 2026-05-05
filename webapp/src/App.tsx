import { useBluetooth } from './hooks/useBluetooth'
import Tile from './components/Tile'
import FixIndicator from './components/FixIndicator'

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
    <>
      <h1>MOPED SPEEDO</h1>

      <div className="speed-display">{speed}</div>
      <div className="speed-unit">km/h</div>

      <div className="grid">
        <Tile label="Heading" value={heading} unit="degrees" />
        <Tile label="Altitude" value={altitude} unit="metres" />
        <Tile label="Satellites" value={satellites} />
        <Tile label="GPS Fix" value="">
          <FixIndicator fix={fix} />
        </Tile>
        <Tile label="Wheel Circ." value={wheelCirc} unit="metres" />
        <Tile label="Pulses / Rev" value={pulsesPerRev} />
        <Tile label="WiFi IP" value={ipAddress} wide smallValue />
      </div>

      <div className="aux-row">
        <label htmlFor="aux-toggle">Aux Output</label>
        <label className="toggle">
          <input
            type="checkbox"
            id="aux-toggle"
            checked={aux}
            disabled={auxDisabled}
            onChange={e => setAux(e.target.checked)}
          />
          <span className="slider" />
        </label>
      </div>

      <button className="connect-btn" disabled={btnDisabled} onClick={connect}>
        {btnLabel}
      </button>
      <div className="status">{status}</div>
    </>
  )
}
