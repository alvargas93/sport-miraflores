const TZ = 'Europe/Madrid'

export function toMadridDate(date) {
  return new Date(new Date(date).toLocaleString('en-US', { timeZone: TZ }))
}

export function formatDate(date, opts = {}) {
  return new Intl.DateTimeFormat('es-ES', { timeZone: TZ, ...opts }).format(new Date(date))
}

export function formatTime(date) {
  return formatDate(date, { hour: '2-digit', minute: '2-digit' })
}

export function formatDayLong(date) {
  return formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })
}

export function formatDayShort(date) {
  return formatDate(date, { weekday: 'short', day: 'numeric' })
}

// Returns today's date as 'YYYY-MM-DD' in Europe/Madrid timezone
export function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

// Returns 'YYYY-MM-01' for the current month in Madrid time
export function currentMonthStart() {
  return todayStr().slice(0, 7) + '-01'
}

// Converts a date+time expressed in Madrid local time to a UTC ISO string.
// Uses noon UTC to determine the Madrid offset (safe against DST edge cases).
// dateStr: 'YYYY-MM-DD', timeStr: 'HH:MM' or 'HH:MM:SS'
export function madridToUTC(dateStr, timeStr) {
  const noonUTC = new Date(`${dateStr}T12:00:00Z`)
  const madridHour = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(noonUTC),
    10
  )
  const offsetHours = madridHour - 12
  const full = timeStr.length === 5 ? `${timeStr}:00` : timeStr
  const localAsUTC = new Date(`${dateStr}T${full}Z`)
  return new Date(localAsUTC.getTime() - offsetHours * 3600 * 1000).toISOString()
}

// Returns UTC ISO strings for the start and end of a Madrid calendar day.
// Use these for Supabase query filters on timestamptz columns.
export function madridDayBounds(dateStr) {
  return {
    start: madridToUTC(dateStr, '00:00:00'),
    end: madridToUTC(dateStr, '23:59:59'),
  }
}

// Parses a 'YYYY-MM-DD' string as local midnight (avoids UTC offset issues)
export function parseDateLocal(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}
