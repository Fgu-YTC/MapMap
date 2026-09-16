const WEI = 10n ** 18n

export function truncateAddress(address: string, chars = 6): string {
  if (address.length < chars * 2 + 2) return address
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`
}

export function formatWei(wei: string, decimals = 4): string {
  try {
    const value = BigInt(wei)
    const whole = value / WEI
    const fraction = value % WEI
    if (fraction === 0n) return whole.toString()

    const fracStr = fraction.toString().padStart(18, '0').slice(0, decimals)
    const trimmed = fracStr.replace(/0+$/, '')
    return trimmed ? `${whole}.${trimmed}` : whole.toString()
  } catch {
    return '0'
  }
}

export function formatTokenAmount(
  raw: string,
  decimalsStr: string,
  maxDecimals = 6,
): string {
  try {
    const decimals = Number(decimalsStr) || 0
    const value = BigInt(raw)
    if (decimals === 0) return value.toString()

    const base = 10n ** BigInt(decimals)
    const whole = value / base
    const fraction = value % base
    if (fraction === 0n) return whole.toLocaleString()

    const shown = Math.min(maxDecimals, decimals)
    const fracStr = fraction
      .toString()
      .padStart(decimals, '0')
      .slice(0, shown)
      .replace(/0+$/, '')

    return fracStr
      ? `${whole.toLocaleString()}.${fracStr}`
      : whole.toLocaleString()
  } catch {
    return '0'
  }
}

export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: amount < 1 ? 4 : 2,
  }).format(amount)
}

export function weiToUsd(wei: string, usdPrice: string): number {
  const merl = Number(formatWei(wei, 8))
  const price = Number(usdPrice)
  if (!Number.isFinite(merl) || !Number.isFinite(price)) return NaN
  return merl * price
}

export function formatTimestamp(unix: string): string {
  const ms = Number(unix) * 1000
  if (!Number.isFinite(ms)) return '—'
  return new Intl.DateTimeFormat('zh-TW', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ms))
}

export function formatRelative(unix: string): string {
  const ms = Number(unix) * 1000
  if (!Number.isFinite(ms)) return ''
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小時前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return formatTimestamp(unix)
}
