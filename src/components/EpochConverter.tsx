import { useState, useCallback } from 'react'

type TimestampUnit = 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds'

const UNIT_FACTORS: Record<TimestampUnit, bigint> = {
  seconds: 1n,
  milliseconds: 1000n,
  microseconds: 1000000n,
  nanoseconds: 1000000000n,
}

export function detectUnit(value: string): TimestampUnit {
  const len = value.replace(/^-/, '').length
  if (len <= 10) return 'seconds'
  if (len <= 13) return 'milliseconds'
  if (len <= 16) return 'microseconds'
  return 'nanoseconds'
}

export function toMillis(value: string, unit: TimestampUnit): number {
  const big = BigInt(value)
  const factor = UNIT_FACTORS[unit]
  if (unit === 'seconds') return Number(big) * 1000
  if (unit === 'milliseconds') return Number(big)
  return Number(big * 1000n / factor)
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [text])
  return (
    <button
      onClick={copy}
      className="ml-2 px-2 py-0.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors flex-shrink-0"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-gray-400 text-sm w-28 flex-shrink-0">{label}</span>
      <code className="text-sm text-gray-200 bg-gray-800 px-2 py-0.5 rounded flex-1 min-w-0 truncate">{value}</code>
      <CopyButton text={value} />
    </div>
  )
}

function TimestampToDate() {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const trimmed = input.trim()
  let results: { unit: TimestampUnit; utc: string; local: string } | null = null

  if (trimmed) {
    if (!/^-?\d+$/.test(trimmed)) {
      if (!error) setError('Enter a valid integer timestamp')
    } else {
      const unit = detectUnit(trimmed)
      try {
        const ms = toMillis(trimmed, unit)
        const date = new Date(ms)
        if (isNaN(date.getTime())) throw new Error('Invalid date')
        results = {
          unit,
          utc: date.toUTCString(),
          local: date.toLocaleString(),
        }
        if (error) setError(null)
      } catch {
        if (!error) setError('Timestamp out of range')
      }
    }
  } else if (error) {
    setError(null)
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Timestamp → Date</h3>
      <input
        type="text"
        value={input}
        onChange={e => { setInput(e.target.value); setError(null) }}
        placeholder="e.g. 1700000000 or 1700000000000"
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-violet-500"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {results && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-2 pb-2">
            <span className="text-xs text-violet-400 font-medium bg-violet-500/10 px-2 py-0.5 rounded">
              Detected: {results.unit}
            </span>
          </div>
          <ResultRow label="UTC" value={results.utc} />
          <ResultRow label="Local" value={results.local} />
        </div>
      )}
    </div>
  )
}

function DateToTimestamp() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear().toString())
  const [month, setMonth] = useState((now.getMonth() + 1).toString().padStart(2, '0'))
  const [day, setDay] = useState(now.getDate().toString().padStart(2, '0'))
  const [hour, setHour] = useState('12')
  const [minute, setMinute] = useState('00')
  const [second, setSecond] = useState('00')
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM')
  const [tz, setTz] = useState<'UTC' | 'LOCAL'>('LOCAL')

  let results: Record<TimestampUnit, string> | null = null
  let error: string | null = null

  try {
    let h = parseInt(hour, 10)
    if (ampm === 'PM' && h !== 12) h += 12
    if (ampm === 'AM' && h === 12) h = 0

    const date = tz === 'UTC'
      ? new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), h, parseInt(minute), parseInt(second)))
      : new Date(parseInt(year), parseInt(month) - 1, parseInt(day), h, parseInt(minute), parseInt(second))

    if (isNaN(date.getTime())) throw new Error('Invalid date')

    const s = BigInt(Math.floor(date.getTime() / 1000))
    results = {
      seconds: s.toString(),
      milliseconds: (s * 1000n).toString(),
      microseconds: (s * 1000000n).toString(),
      nanoseconds: (s * 1000000000n).toString(),
    }
  } catch {
    error = 'Invalid date input'
  }

  const inputClass = "bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-violet-500 text-center"
  const selectClass = "bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-violet-500"

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Date → Timestamp</h3>
      <div className="flex flex-wrap items-center gap-2">
        <input type="text" value={year} onChange={e => setYear(e.target.value)} className={`${inputClass} w-20`} placeholder="YYYY" />
        <span className="text-gray-500">/</span>
        <input type="text" value={month} onChange={e => setMonth(e.target.value)} className={`${inputClass} w-14`} placeholder="MM" />
        <span className="text-gray-500">/</span>
        <input type="text" value={day} onChange={e => setDay(e.target.value)} className={`${inputClass} w-14`} placeholder="DD" />
        <span className="text-gray-600 mx-1">|</span>
        <input type="text" value={hour} onChange={e => setHour(e.target.value)} className={`${inputClass} w-14`} placeholder="HH" />
        <span className="text-gray-500">:</span>
        <input type="text" value={minute} onChange={e => setMinute(e.target.value)} className={`${inputClass} w-14`} placeholder="MM" />
        <span className="text-gray-500">:</span>
        <input type="text" value={second} onChange={e => setSecond(e.target.value)} className={`${inputClass} w-14`} placeholder="SS" />
        <select value={ampm} onChange={e => setAmpm(e.target.value as 'AM' | 'PM')} className={selectClass}>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
        <select value={tz} onChange={e => setTz(e.target.value as 'UTC' | 'LOCAL')} className={selectClass}>
          <option value="LOCAL">Local</option>
          <option value="UTC">UTC</option>
        </select>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {results && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-1">
          <ResultRow label="Seconds" value={results.seconds} />
          <ResultRow label="Milliseconds" value={results.milliseconds} />
          <ResultRow label="Microseconds" value={results.microseconds} />
          <ResultRow label="Nanoseconds" value={results.nanoseconds} />
        </div>
      )}
    </div>
  )
}

export default function EpochConverter() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 w-full space-y-8">
      <h2 className="text-xl font-bold text-gray-100">Epoch Converter</h2>
      <TimestampToDate />
      <hr className="border-gray-800" />
      <DateToTimestamp />
    </div>
  )
}
