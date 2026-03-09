type EventKind = 'event' | 'error' | 'metric'

export interface ObservabilityEvent {
  kind: EventKind
  name: string
  timestampIso: string
  data?: Record<string, unknown>
}

const OBSERVABILITY_EVENT_NAME = 'suncast:observability'
const MAX_BUFFERED_EVENTS = 200
const bufferedEvents: ObservabilityEvent[] = []

function normalizeData(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }
  return value as Record<string, unknown>
}

function pushEvent(event: ObservabilityEvent): void {
  bufferedEvents.push(event)
  if (bufferedEvents.length > MAX_BUFFERED_EVENTS) {
    bufferedEvents.splice(0, bufferedEvents.length - MAX_BUFFERED_EVENTS)
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent<ObservabilityEvent>(OBSERVABILITY_EVENT_NAME, { detail: event }))
  }
}

export function recordEvent(name: string, data?: Record<string, unknown>): void {
  pushEvent({
    kind: 'event',
    name,
    timestampIso: new Date().toISOString(),
    data: normalizeData(data),
  })
}

export function captureException(error: unknown, data?: Record<string, unknown>): void {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorName = error instanceof Error ? error.name : 'UnknownError'

  pushEvent({
    kind: 'error',
    name: 'exception',
    timestampIso: new Date().toISOString(),
    data: {
      errorName,
      errorMessage,
      ...normalizeData(data),
    },
  })
}

export function recordMetric(name: string, value: number, data?: Record<string, unknown>): void {
  pushEvent({
    kind: 'metric',
    name,
    timestampIso: new Date().toISOString(),
    data: {
      value,
      ...normalizeData(data),
    },
  })
}

export function getBufferedObservabilityEvents(): ObservabilityEvent[] {
  return [...bufferedEvents]
}
