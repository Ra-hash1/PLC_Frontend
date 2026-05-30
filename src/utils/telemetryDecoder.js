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
// Full 16-bit map: lower byte = standard CiA 402, upper byte = CiA 402 + VEICHI
// Used by StatusWordBits component and decodeStatusWordText()
export const STATUS_WORD_BITS = [
  // ── Lower byte — standard CiA 402 state machine ───────────────────────────
  { key: 'RTSO',  label: 'Ready to Switch On',                      mask: 0x0001, color: '#34d399' },
  { key: 'S/ON',  label: 'Switched On',                             mask: 0x0002, color: '#34d399' },
  { key: 'OP EN', label: 'Operation Enabled',                       mask: 0x0004, color: '#34d399' },
  { key: 'FAULT', label: 'Fault',                                   mask: 0x0008, color: '#f87171' },
  { key: 'V EN',  label: 'Voltage Enabled',                         mask: 0x0010, color: '#60a5fa' },
  { key: 'Q-STP', label: 'Quick Stop (active low — 0 = stopping)',  mask: 0x0020, color: '#fbbf24' },
  { key: 'S-DSB', label: 'Switch On Disabled',                      mask: 0x0040, color: '#fbbf24' },
  { key: 'WARN',  label: 'Warning',                                 mask: 0x0080, color: '#fbbf24' },
  // ── Upper byte — CiA 402 standard (bits 8-11) + VEICHI specific (12-15) ───
  { key: 'MS1',   label: 'Manufacturer Specific (bit 8)',           mask: 0x0100, color: '#a78bfa' },
  { key: 'REM',   label: 'Remote — drive accepting remote commands',mask: 0x0200, color: '#60a5fa' },
  { key: 'T-RCH', label: 'Target Reached',                         mask: 0x0400, color: '#34d399' },
  { key: 'I-LIM', label: 'Internal Limit Active',                   mask: 0x0800, color: '#fbbf24' },
  { key: 'MS2',   label: 'Manufacturer Specific (bit 12)',          mask: 0x1000, color: '#a78bfa' },
  { key: 'MS3',   label: 'Manufacturer Specific (bit 13)',          mask: 0x2000, color: '#a78bfa' },
  { key: 'MS4',   label: 'Manufacturer Specific (bit 14)',          mask: 0x4000, color: '#a78bfa' },
  { key: 'MS5',   label: 'Manufacturer Specific (bit 15)',          mask: 0x8000, color: '#a78bfa' },
]

// ─── Status Word Decoder ──────────────────────────────────────────────────────
// Returns primary CiA 402 state name + optional suffix for notable upper bits.
// Example: 0x1637 → "Operation enabled · Remote · Target reached"
export function decodeStatusWordText(statusWord) {
  const sw = statusWord ?? 0

  // ── Lower byte: CiA 402 state machine ────────────────────────────────────
  const readyToSwitchOn  = !!(sw & 0x0001)
  const switchedOn       = !!(sw & 0x0002)
  const operationEnabled = !!(sw & 0x0004)
  const fault            = !!(sw & 0x0008)
  const voltageEnabled   = !!(sw & 0x0010)
  const quickStop        = !!(sw & 0x0020)
  const switchOnDisabled = !!(sw & 0x0040)
  const warning          = !!(sw & 0x0080)

  let state
  if (fault)                          state = 'Fault'
  else if (operationEnabled)          state = 'Operation enabled'
  else if (switchedOn && voltageEnabled) state = 'Switched on'
  else if (readyToSwitchOn && quickStop) state = 'Ready to switch on'
  else if (switchOnDisabled)          state = 'Switch on disabled'
  else if (warning)                   state = 'Warning active'
  else                                state = 'Unknown state'

  // ── Upper byte: notable CiA 402 bits appended as suffix ──────────────────
  const suffixes = []
  if (sw & 0x0200) suffixes.push('Remote')
  if (sw & 0x0400) suffixes.push('Target reached')
  if (sw & 0x0800) suffixes.push('Limit active')

  return suffixes.length > 0 ? `${state} · ${suffixes.join(' · ')}` : state
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
// New firmware sends axisErrorId (canonical) — errorCode kept as legacy alias.
// New firmware sends diagnosticWord (canonical) — reservedWord kept as legacy alias.
export function decodeServo(servo) {
  // statusWord / modeDisplay are kept as null when absent — this is the "no data"
  // sentinel consumed by StatusWordBits (it shows "—" instead of 8 dimmed pills).
  const statusWord       = servo.statusWord  ?? null
  const modeDisplay      = servo.modeDisplay ?? null

  // axisErrorId is the canonical name; errorCode is the legacy alias (backward compat)
  const errorCode        = servo.axisErrorId ?? servo.errorCode ?? 0

  // Lambda sends faultActiveRaw (raw CiA 402 FAULT bit); faultActive is legacy alias
  const faultActive      = !!(servo.faultActiveRaw ?? servo.faultActive ?? false)
  const warningActive    = !!servo.warningActive
  const operationEnabled = !!servo.operationEnabled

  // diagnosticWord is canonical; reservedWord is the legacy alias
  const diagnosticWord   = servo.diagnosticWord ?? servo.reservedWord ?? 0

  return {
    // ── Identity ─────────────────────────────────────────────────────────────
    servoId:          servo.servoId  ?? servo.axisId ?? 0,
    axisId:           servo.axisId   ?? servo.servoId ?? 0,

    // ── CiA 402 status ───────────────────────────────────────────────────────
    statusWord,
    statusWordText:   decodeStatusWordText(statusWord ?? 0),
    modeDisplay,
    modeDisplayText:  decodeModeDisplayText(modeDisplay ?? 0),

    // ── Error / diagnostics ──────────────────────────────────────────────────
    errorCode,                                // canonical (axisErrorId ?? errorCode)
    errorText:        decodeErrorCode(errorCode),
    diagnosticWord,                           // canonical (diagnosticWord ?? reservedWord)

    // ── Aggregated status flags ───────────────────────────────────────────────
    statusFlags:      servo.statusFlags  ?? 0,
    operationEnabled,
    faultActive,
    warningActive,
    remoteActive:     !!servo.remoteActive,

    // ── PLC-native per-axis state flags (new firmware, v5 schema) ───────────
    feedbackFresh:    servo.feedbackFresh    != null ? !!servo.feedbackFresh    : null,
    faultActiveRaw:   servo.faultActiveRaw   != null ? !!servo.faultActiveRaw   : null,
    readyToRun:       servo.readyToRun       != null ? !!servo.readyToRun       : null,
    actuallyRunning:  servo.actuallyRunning  != null ? !!servo.actuallyRunning  : null,
    faulted:          servo.faulted          != null ? !!servo.faulted          : null,
    stopping:         servo.stopping         != null ? !!servo.stopping         : null,
    standstill:       servo.standstill       != null ? !!servo.standstill       : null,
    disabled:         servo.disabled         != null ? !!servo.disabled         : null,
    homing:           servo.homing           != null ? !!servo.homing           : null,

    // ── Read-status validity flags ────────────────────────────────────────────
    readStatusValid:  servo.readStatusValid  != null ? !!servo.readStatusValid  : null,
    axisErrorValid:   servo.axisErrorValid   != null ? !!servo.axisErrorValid   : null,
    positionValid:    servo.positionValid    != null ? !!servo.positionValid    : null,

    // ── Motion state flags ───────────────────────────────────────────────────
    continuousMotion: servo.continuousMotion != null ? !!servo.continuousMotion : null,
    discreteMotion:   servo.discreteMotion   != null ? !!servo.discreteMotion   : null,
    syncMotion:       servo.syncMotion       != null ? !!servo.syncMotion       : null,
    speedChanging:    servo.speedChanging    != null ? !!servo.speedChanging    : null,
    readBlockError:   servo.readBlockError   != null ? !!servo.readBlockError   : null,

    // ── Torque / load ────────────────────────────────────────────────────────
    torqueMagnitude:  servo.torqueMagnitude  != null ? Number(servo.torqueMagnitude) : null,
    torqueNegative:   servo.torqueNegative   != null ? !!servo.torqueNegative        : null,
    torqueActual:     servo.torqueActual     != null ? Number(servo.torqueActual)    : null,
    loadPercent:      servo.loadPercent      != null ? Number(servo.loadPercent)     : null,

    // ── Derived ──────────────────────────────────────────────────────────────
    alarmStatus:    (errorCode !== 0 || faultActive) ? 'ACTIVE' : 'NONE',
    machineStatus:  faultActive ? 'STOPPED' : operationEnabled ? 'RUNNING' : 'STOPPED',
  }
}

// ─── Single CANopen Node Decoder ──────────────────────────────────────────────
// Decodes a canopenNodes[] entry from the Lambda / ESP32 payload.
// Each entry represents one physical node on the CAN bus network.
export function decodeCANopenNode(node) {
  const errorCode = node.errorCode ?? node.axisErrorId ?? 0

  return {
    // ── Identity ─────────────────────────────────────────────────────────────
    nodeId:           node.nodeId        ?? 0,

    // ── Network presence ─────────────────────────────────────────────────────
    online:           node.online        != null ? !!node.online          : null,
    heartbeatActive:  node.heartbeatActive != null ? !!node.heartbeatActive : null,
    heartbeatCount:   node.heartbeatCount != null ? Number(node.heartbeatCount) : null,

    // ── NMT state ────────────────────────────────────────────────────────────
    // String sent by Lambda: OPERATIONAL / PRE_OPERATIONAL / STOPPED / INITIALIZING
    nmtState:         node.nmtState ?? node.state ?? 'UNKNOWN',

    // ── CiA 402 status ───────────────────────────────────────────────────────
    statusWord:       node.statusWord    ?? null,
    statusWordText:   decodeStatusWordText(node.statusWord ?? 0),
    modeDisplay:      node.modeDisplay   ?? null,
    modeDisplayText:  decodeModeDisplayText(node.modeDisplay ?? 0),

    // ── Error / diagnostics ──────────────────────────────────────────────────
    errorCode,
    errorText:        decodeErrorCode(errorCode),
    errorRegister:    node.errorRegister != null ? Number(node.errorRegister) : null,
    axisErrorId:      node.axisErrorId   ?? null,
    diagnosticWord:   node.diagnosticWord != null ? Number(node.diagnosticWord) : null,

    // ── Status flags ─────────────────────────────────────────────────────────
    faultActive:      node.faultActive      != null ? !!node.faultActive      : null,
    warningActive:    node.warningActive     != null ? !!node.warningActive    : null,
    operationEnabled: node.operationEnabled  != null ? !!node.operationEnabled : null,
    remoteActive:     node.remoteActive      != null ? !!node.remoteActive     : null,

    // ── Torque / load ────────────────────────────────────────────────────────
    torqueActual:     node.torqueActual  != null ? Number(node.torqueActual)  : null,
    loadPercent:      node.loadPercent   != null ? Number(node.loadPercent)   : null,

    // ── PDO counters ─────────────────────────────────────────────────────────
    rpdoRxCount:      node.rpdoRxCount   != null ? Number(node.rpdoRxCount)  : null,
    tpdoTxCount:      node.tpdoTxCount   != null ? Number(node.tpdoTxCount)  : null,
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
//  1. Decode all servos (with extended v5 fields).
//  2. Decode all canopenNodes[].
//  3. Select "primaryServo" using fault-priority:
//       → first servo with errorCode ≠ 0 or faultActive = true
//       → fall back to servos[0]
//     The primaryServo drives the headline status word / error / mode shown at the top.
//  4. Aggregate boolean flags (operationEnabled, faultActive, warningActive) across
//     ALL servos so alert banners fire for any drive fault, not just the selected one.
//  5. Derive machineStatus and alarmStatus from the decoded servo set.
export function decodeTelemetry(data) {
  // ── Step 1: decode all servos ─────────────────────────────────────────────
  const servos = Array.isArray(data.servos) ? data.servos.map(decodeServo) : []

  // ── Step 2: decode all canopenNodes ──────────────────────────────────────
  const canopenNodes = Array.isArray(data.canopenNodes)
    ? data.canopenNodes.map(decodeCANopenNode)
    : []

  // ── Step 3: fault-priority primary servo ─────────────────────────────────
  // If a faulted servo exists, it becomes "primary" so the dashboard immediately
  // surfaces the fault — even if the user currently has a healthy drive selected.
  const primaryServo = servos.find(s => s.errorCode !== 0 || s.faultActive) ?? servos[0] ?? null

  // ── Step 4: key scalar fields — prefer primaryServo, fall back to top-level ─
  // statusWord/modeDisplay use 0 as the numeric default so that StatCards can
  // render "0x0000" / "Unknown state" when the machine hasn't sent a value yet.
  // The per-servo null sentinel is handled separately inside decodeServo().
  const statusWord  = primaryServo?.statusWord  ?? data.statusWord  ?? 0
  const errorCode   = primaryServo?.errorCode   ?? data.errorCode   ?? 0
  const modeDisplay = primaryServo?.modeDisplay ?? data.modeDisplay ?? 0

  // ── Step 5: aggregate boolean flags across all servos ─────────────────────
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

  // ── Step 6: machine-level status derived from the decoded servo set ───────
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

    // Multi-drive arrays (decoded)
    servos,
    primaryServoId: primaryServo?.servoId ?? null,

    // CANopen network topology (decoded)
    canopenNodes,
  }
}
