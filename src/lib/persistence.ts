import { assignSideSlots, type ForceDirection, type ForceItem } from "@/lib/forces"
import { DEFAULT_APP_SETTINGS, type AppSettings } from "@/lib/settings"

const STORAGE_KEY = "force-diagram.state.v1"
const PLAYGROUND_ONBOARDING_DISMISSED_KEY = "force-diagram.playground-onboarding-dismissed.v1"
const VALID_DIRECTIONS = new Set<ForceDirection>(["up", "down", "left", "right"])

type PersistedForce = Pick<ForceItem, "id" | "direction" | "magnitude" | "creationOrder">

type RestoredAppState = {
  forces: ForceItem[]
  settings: AppSettings
  nextCreationOrder: number
}

export function restoreAppState(): RestoredAppState {
  if (typeof window === "undefined") {
    return createDefaultAppState()
  }

  try {
    const rawState = window.localStorage.getItem(STORAGE_KEY)

    if (!rawState) {
      return createDefaultAppState()
    }

    const parsedState = JSON.parse(rawState) as {
      forces?: unknown
      settings?: unknown
    }
    const restoredForces = Array.isArray(parsedState.forces)
      ? assignSideSlots(
          parsedState.forces
            .filter(isPersistedForce)
            .map((force) => ({
              ...force,
              sideSlot: 0,
            })),
        )
      : []
    const nextCreationOrder =
      restoredForces.reduce(
        (highestCreationOrder, force) =>
          Math.max(highestCreationOrder, force.creationOrder),
        0,
      ) + 1

    return {
      forces: restoredForces,
      settings: restoreSettings(parsedState.settings),
      nextCreationOrder,
    }
  } catch {
    return createDefaultAppState()
  }
}

export function persistAppState({
  forces,
  settings,
}: {
  forces: ForceItem[]
  settings: AppSettings
}) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        forces: forces.map(({ id, direction, magnitude, creationOrder }) => ({
          id,
          direction,
          magnitude,
          creationOrder,
        })),
        settings,
      }),
    )
  } catch {
    // Ignore storage failures and keep the app usable.
  }
}

export function clearPersistedAppState() {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.removeItem(PLAYGROUND_ONBOARDING_DISMISSED_KEY)
  } catch {
    // Ignore storage failures and keep the app usable.
  }
}

export function hasDismissedPlaygroundOnboarding() {
  if (typeof window === "undefined") {
    return false
  }

  try {
    return window.localStorage.getItem(PLAYGROUND_ONBOARDING_DISMISSED_KEY) === "true"
  } catch {
    return false
  }
}

export function dismissPlaygroundOnboarding() {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(PLAYGROUND_ONBOARDING_DISMISSED_KEY, "true")
  } catch {
    // Ignore storage failures and keep the app usable.
  }
}

function createDefaultAppState(): RestoredAppState {
  return {
    forces: [],
    settings: DEFAULT_APP_SETTINGS,
    nextCreationOrder: 1,
  }
}

function isPersistedForce(value: unknown): value is PersistedForce {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Partial<PersistedForce>

  return (
    typeof candidate.id === "string" &&
    typeof candidate.magnitude === "number" &&
    Number.isFinite(candidate.magnitude) &&
    typeof candidate.creationOrder === "number" &&
    Number.isFinite(candidate.creationOrder) &&
    typeof candidate.direction === "string" &&
    VALID_DIRECTIONS.has(candidate.direction as ForceDirection)
  )
}

function restoreSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object") {
    return DEFAULT_APP_SETTINGS
  }

  const candidate = value as Partial<AppSettings>

  return {
    advancedMode:
      typeof candidate.advancedMode === "boolean"
        ? candidate.advancedMode
        : DEFAULT_APP_SETTINGS.advancedMode,
  }
}
