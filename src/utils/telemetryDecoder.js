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

export function decodeModeDisplayText(modeDisplay) {
  const mode = modeDisplay ?? 0
  const modeMap = {
    1: 'Profile Position',
    2: 'Velocity',
    3: 'Profile Velocity',
    4: 'Torque',
    6: 'Homing',
    8: 'CSP',
    9: 'CSV',
    10: 'CST',
  }
  return modeMap[mode] || `Mode ${mode}`
}

export function decodeMachineStatus(data) {
  const canState         = (data.canState || '').toUpperCase()
  const operationEnabled = !!data.operationEnabled
  const faultActive      = !!data.faultActive
  if (canState !== 'OPERATIONAL') return 'POWER OFF'
  if (faultActive)                return 'STOPPED'
  if (operationEnabled)           return 'RUNNING'
  return 'STOPPED'
}

export function decodeAlarmStatus(data) {
  return data.errorCode && data.errorCode !== 0 ? 'ACTIVE' : 'NONE'
}

export function decodeErrorCode(errorCode) {
  const code = errorCode ?? 0
  if (code === 0) return 'No fault'
  const faultMap = {
    2370: 'Drive alarm active',
  }
  return faultMap[code] || `Drive fault ${code} (0x${code.toString(16).toUpperCase()})`
}

export function decodeTelemetry(data) {
  const statusWord  = data.statusWord  ?? 0
  const errorCode   = data.errorCode   ?? 0
  const modeDisplay = data.modeDisplay ?? 0
  return {
    machineStatus:    decodeMachineStatus(data),
    alarmStatus:      decodeAlarmStatus(data),
    statusWord,
    statusWordText:   decodeStatusWordText(statusWord),
    errorCode,
    errorText:        decodeErrorCode(errorCode),
    statusFlags:      data.statusFlags    ?? 0,
    currentActual:    data.currentActual  ?? 0,
    operationEnabled: !!data.operationEnabled,
    faultActive:      !!data.faultActive,
    warningActive:    !!data.warningActive,
    remoteActive:     !!data.remoteActive,
    modeDisplay,
    modeDisplayText:  decodeModeDisplayText(modeDisplay),
    canState:         data.canState  ?? 'UNKNOWN',
    canNodeId:        data.canNodeId ?? null,
    deviceUptimeMs:   data.deviceUptimeMs ?? null,
    rpdoRxCounter:    data.rpdoRxCounter ?? null,
    telemetryTxCounter: data.telemetryTxCounter ?? null,
    timestamp:        data.timestamp ?? '',
    ts:               data.ts        ?? '',
    siteId:           data.siteId    ?? '',
    lineId:           data.lineId    ?? '',
    machineId:        data.machineId ?? '',
  }
}