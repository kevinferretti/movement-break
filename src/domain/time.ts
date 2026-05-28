export type LocalHourParts = {
  dateKey: string
  hour: number
  hourKey: string
}

export function isHourInWindow(hour: number, startHour: number, endHour: number) {
  if (startHour === endHour) {
    return hour === startHour
  }

  if (startHour < endHour) {
    return hour >= startHour && hour <= endHour
  }

  return hour >= startHour || hour <= endHour
}

export function formatHour(hour: number) {
  const normalized = ((hour % 24) + 24) % 24
  const suffix = normalized >= 12 ? 'PM' : 'AM'
  const displayHour = normalized % 12 === 0 ? 12 : normalized % 12

  return `${displayHour} ${suffix}`
}

export function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function getLocalHourParts(date: Date, timeZone: string): LocalHourParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value
    }

    return acc
  }, {})

  const dateKey = `${parts.year}-${parts.month}-${parts.day}`
  const hour = Number(parts.hour)

  return {
    dateKey,
    hour,
    hourKey: `${dateKey}T${String(hour).padStart(2, '0')}`,
  }
}
