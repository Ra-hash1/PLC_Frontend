// ─── VEICHI AC Drive error code map (3-digit hex key) ────────────────────────
// Mirrors plcTelemetry.ts on the mobile app — keep in sync
const VEICHI_CODE_MAP = {
  '020': 'Parameter Verification Abnormal',
  '021': 'Abnormal parameter formatting',
  '022': 'Manufacturer parameters/calibration abnormal',
  '040': 'Parameter Setting Abnormal',
  '050': 'Driver and motor capacity mismatch',
  '080': 'Abnormal distance setting corresponding to encoder unit pulse',
  '100': 'Driver overcurrent',
  '300': 'Regeneration fault',
  '320': 'Regenerative Overload',
  '400': 'Overvoltage',
  '410': 'Undervoltage',
  '42A': 'Motor/KTY temperature overtemperature',
  '510': 'Motor running speed exceeds overspeed level',
  '520': 'Vibration alarm',
  '710': 'Transient overload',
  '720': 'Overload',
  '7A0': 'Heat sink overheating',
  '7AA': 'Safety terminal input/STO',
  '7AB': 'Servo drive built-in fan stop',
  '810': 'Encoder backup alarm',
  '820': 'Encoder number check alarm',
  '830': 'Encoder battery undervoltage',
  '840': 'Encoder data abnormality',
  '850': 'Encoder overspeed',
  '860': 'Encoder overheating',
  '870': 'External Encoder Abnormal',
  '900': 'CANopen node guarding / heartbeat error',
  '910': 'CANopen PDO timeout',
  '920': 'CANopen sync loss',
}

// ─── CiA 402 Status Word — bit definitions ────────────────────────────────────
// Used by StatusWordBits component and decodeStatusWordText()
export const STATUS_WORD_BITS = [
  { key: 'RTSO',  label: 'Ready to Switch On',              mask: 0x0001, color: '#34d399' },
  { key: 'S/ON',  label: 'Switched On',                     mask: 0x0002, color: '#34d399' },
  { key: 'OP EN', label: 'Operation Enabled',               mask: 0x0004, color: '#34d399' },
  { key: 'FAULT', label: 'Fault',                           mask: 0x0008, color: '#f87171' },
  { key: 'V EN',  label: 'Voltage Enabled',                 mask: 0x0010, color: '#60a5fa' },
  { key: 'Q-STP', label: 'Quick Stop (active low — 0 = stopping)', mask: 0x0020, color: '#fbbf24' },
  { key: 'S-DSB', label: 'Switch On Disabled',              mask: 0x0040, color: '#fbbf24' },
  { key: 'WARN',  label: 'Warning',                         mask: 0x0080, color: '#fbbf24' },
]

// ─── Status Word Decoder ──────────────────────────────────────────────────────
export function decodeStatusWordText(statusWord) {
  const sw = statusWord ?? 0
  const readyToSwitchOn  = !!(sw & 0x0001)
  const switchedOn       = !!(sw & 0x0002)
  const operationEnabled = !!(sw & 0x0004)
  const fault            = !!(sw & 0x0008)
  const voltageEnabled   = !!(sw & 0x0010)
  const quickStop        = !!(sw & 0x0020)
  const switchOnDisabled = !!(sw & 0x0040)
  const warning          = !!(sw & 0x0080)

  if (fault)                          return 'Fault'
  if (operationEnabled)               return 'Operation enabled'
  if (switchedOn && voltageEnabled)   return 'Switched on'
  if (readyToSwitchOn && quickStop)   return 'Ready to switch on'
  if (switchOnDisabled)               return 'Switch on disabled'
  if (warning)                        return 'Warning active'
  return 'Unknown state'
}

// ─── Mode Display Decoder ─────────────────────────────────────────────────────
// CiA 402 operation modes — mirrors mobile app plcTelemetry.ts
export function decodeModeDisplayText(modeDisplay) {
  if (modeDisplay == null) return '—'
  const modeMap = {
    1:  'Profile Position',
    2:  'Velocity',
    3:  'Profile Velocity',
    4:  'Torque',
    6:  'Homing',
    8:  'CSP',
    9:  'CSV',
    10: 'CST',
  }
  return modeMap[modeDisplay] || (modeDisplay === 0 ? '—' : `Mode ${modeDisplay}`)
}

// ─── Error Code Decoder (VEICHI + legacy fallback) ────────────────────────────
export function decodeErrorCode(errorCode) {
  const code = errorCode ?? 0
  if (code === 0) return 'No fault'

  // VEICHI 3-digit hex lookup (primary)
  const hexKey = code.toString(16).toUpperCase().padStart(3, '0')
  if (VEICHI_CODE_MAP[hexKey]) return VEICHI_CODE_MAP[hexKey]

  // Legacy numeric fallback
  if (code === 2370) return 'Drive alarm active'

  return `Drive fault ${code} (0x${code.toString(16).toUpperCase()})`
}

// ─── Single Servo Decoder ─────────────────────────────────────────────────────
export function decodeServo(servo) {
  // statusWord / modeDisplay are kept as null when absent — this is the "no data"
  // sentinel consumed by StatusWordBits (it shows "—" instead of 8 dimmed pills).
  // But for *text* decoding we fall back to 0, which produces readable labels like
  // "Unknown state" / "—" rather than raw null.
  const statusWord       = servo.statusWord  ?? null   // null = no data (for StatusWordBits)
  const modeDisplay      = servo.modeDisplay ?? null   // null = no data
  const errorCode        = servo.errorCode   ?? 0
  const faultActive      = !!servo.faultActive
  const warningActive    = !!servo.warningActive
  const operationEnabled = !!servo.operationEnabled

  return {
    servoId:          servo.servoId          ?? 0,
    statusWord,                                                  // null when absent
    statusWordText:   decodeStatusWordText(statusWord ?? 0),    // '0x0000'→'Unknown state'
    errorCode,
    errorText:        decodeErrorCode(errorCode),
    statusFlags:      servo.statusFlags      ?? 0,
    reservedWord:     servo.reservedWord     ?? 0,
    operationEnabled,
    faultActive,
    warningActive,
    remoteActive:     !!servo.remoteActive,
    modeDisplay,                                                 // null when absent
    modeDisplayText:  decodeModeDisplayText(modeDisplay ?? 0),  // 0→'—', or real mode
    alarmStatus:      (errorCode !== 0 || faultActive) ? 'ACTIVE' : 'NONE',
    machineStatus:    faultActive ? 'STOPPED' : operationEnabled ? 'RUNNING' : 'STOPPED',
  }
}

// ─── Machine Status Decoder ───────────────────────────────────────────────────
// Accepts optional pre-decoded servos to avoid double-decoding inside decodeTelemetry().
// Priority: CAN state check → servo fault/running aggregate → top-level flags fallback.
//
// FIX: canState === '' or 'UNKNOWN' must NOT force POWER OFF.
//      Only explicitly non-operational CAN states (PRE_OPERATIONAL, STOPPED, BOOT_UP)
//      indicate the device is powered off / not yet operational on the CAN bus.
export function decodeMachineStatus(data, decodedServos = null) {
  const canState = (data.canState || '').toUpperCase().replace(/-/g, '_')

  // Explicitly non-operational → POWER OFF
  // 'UNKNOWN' and '' mean we haven't received CAN state yet — don't prematurely report POWER OFF
  if (canState && canState !== 'OPERATIONAL' && canState !== 'UNKNOWN') {
    return 'POWER OFF'
  }

  // Use pre-decoded servos (saves re-mapping inside decodeTelemetry)
  const servos = decodedServos ?? (
    Array.isArray(data.servos) ? data.servos.map(decodeServo) : []
  )

  if (servos.length > 0) {
    // Any servo faulted → machine is STOPPED (not RUNNING)
    const anyFault   = servos.some(s => s.faultActive || s.errorCode !== 0)
    const anyRunning = servos.some(s => s.operationEnabled)
    if (anyFault)   return 'STOPPED'
    if (anyRunning) return 'RUNNING'
    return 'STOPPED'
  }

  // Fallback: single-servo / legacy firmware sends top-level flags only
  if (!!data.faultActive)      return 'STOPPED'
  if (!!data.operationEnabled) return 'RUNNING'
  return 'STOPPED'
}

// ─── Alarm Status Decoder ─────────────────────────────────────────────────────
// Returns 'ACTIVE' if top-level errorCode is set OR any servo has a fault.
export function decodeAlarmStatus(data, decodedServos = null) {
  if ((data.errorCode ?? 0) !== 0) return 'ACTIVE'

  const servos = decodedServos ?? (
    Array.isArray(data.servos) ? data.servos.map(decodeServo) : []
  )
  if (servos.some(s => s.faultActive || s.errorCode !== 0)) return 'ACTIVE'

  return 'NONE'
}

// ─── Full Telemetry Decoder ───────────────────────────────────────────────────
// Mirrors decodeTelemetry() in mobile plcTelemetry.ts:
//
//  1. Decode all servos.
//  2. Select "primaryServo" using fault-priority:
//       → first servo with errorCode ≠ 0 or faultActive = true
//       → fall back to servos[0]
//     The primaryServo drives the headline status word / error / mode shown at the top.
//  3. Aggregate boolean flags (operationEnabled, faultActive, warningActive) across
//     ALL servos so alert banners fire for any drive fault, not just the selected one.
//  4. Derive machineStatus and alarmStatus from the decoded servo set.
export function decodeTelemetry(data) {
  // ── Step 1: decode all servos ─────────────────────────────────────────────
  const servos = Array.isArray(data.servos) ? data.servos.map(decodeServo) : []

  // ── Step 2: fault-priority primary servo ─────────────────────────────────
  // If a faulted servo exists, it becomes "primary" so the dashboard immediately
  // surfaces the fault — even if the user currently has a healthy drive selected.
  const primaryServo = servos.find(s => s.errorCode !== 0 || s.faultActive) ?? servos[0] ?? null

  // ── Step 3: key scalar fields — prefer primaryServo, fall back to top-level ─
  // statusWord/modeDisplay use 0 as the numeric default so that StatCards can
  // render "0x0000" / "Unknown state" when the machine hasn't sent a value yet.
  // The per-servo null sentinel is handled separately inside decodeServo().
  const statusWord  = primaryServo?.statusWord  ?? data.statusWord  ?? 0
  const errorCode   = primaryServo?.errorCode   ?? data.errorCode   ?? 0
  const modeDisplay = primaryServo?.modeDisplay ?? data.modeDisplay ?? 0

  // ── Step 4: aggregate boolean flags across all servos ─────────────────────
  // This ensures faultActive / warningActive are true if ANY drive has an issue,
  // triggering the correct banners regardless of which drive is currently selected.
  const operationEnabled = servos.length > 0
    ? servos.some(s => s.operationEnabled)
    : !!data.operationEnabled

  const faultActive = servos.length > 0
    ? servos.some(s => s.faultActive)
    : !!data.faultActive

  const warningActive = servos.length > 0
    ? servos.some(s => s.warningActive)
    : !!data.warningActive

  // remoteActive: follow primary servo (or top-level for legacy firmware)
  const remoteActive = primaryServo?.remoteActive ?? !!data.remoteActive

  // ── Step 5: machine-level status derived from the decoded servo set ───────
  const machineStatus = decodeMachineStatus(data, servos)
  const alarmStatus   = decodeAlarmStatus(data, servos)

  return {
    // Machine-level aggregates
    machineStatus,
    alarmStatus,

    // CiA 402 status word (primary servo)
    statusWord,
    statusWordText: decodeStatusWordText(statusWord),

    // Error code (primary servo)
    errorCode,
    errorText: decodeErrorCode(errorCode),

    // Status flags (primary servo / top-level)
    statusFlags: primaryServo?.statusFlags ?? data.statusFlags ?? 0,

    // Aggregated boolean flags
    operationEnabled,
    faultActive,
    warningActive,
    remoteActive,

    // Mode (primary servo)
    modeDisplay,
    modeDisplayText: decodeModeDisplayText(modeDisplay),

    // CAN bus
    canState:   data.canState  ?? 'UNKNOWN',
    canNodeId:  data.canNodeId ?? null,

    // Device counters
    deviceUptimeMs:     data.deviceUptimeMs     ?? null,
    rpdoRxCounter:      data.rpdoRxCounter      ?? null,
    telemetryTxCounter: data.telemetryTxCounter ?? null,
    // Real output cycle counter (BIGINT from PLC — null until ESP32 sends it)
    cycleCount:         data.cycleCount         ?? null,

    // Passthrough identity fields
    timestamp: data.timestamp ?? '',
    ts:        data.ts        ?? '',
    siteId:    data.siteId    ?? '',
    lineId:    data.lineId    ?? '',
    machineId: data.machineId ?? '',

    // Multi-drive arrays
    servos,                                        // all decoded servos
    primaryServoId: primaryServo?.servoId ?? null, // which servo is driving headline status
  }
}
