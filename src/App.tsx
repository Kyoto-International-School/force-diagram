import { useCallback, useEffect, useRef, useState } from "react"

import { ForcePlayground } from "@/components/force-playground"
import { ResultantPanel } from "@/components/resultant-panel"
import {
  type ForceDirection,
  type ForceItem,
  assignSideSlots,
  canAddForceToSide,
  canMoveForceToSide,
  normalizeCommittedMagnitude,
} from "@/lib/forces"
import {
  clearPersistedAppState,
  persistAppState,
  restoreAppState,
} from "@/lib/persistence"
import { DEFAULT_APP_SETTINGS } from "@/lib/settings"

function createForceId(creationOrder: number) {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID()
  }

  return `force-${creationOrder}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function App() {
  const [restoredAppState] = useState(() => restoreAppState())
  const [forces, setForces] = useState<ForceItem[]>(restoredAppState.forces)
  const [previewForce, setPreviewForce] = useState<ForceItem | null>(null)
  const [selectedForceId, setSelectedForceId] = useState<string | null>(null)
  const [resultsPlaybackKey, setResultsPlaybackKey] = useState(0)
  const [isResultsPlaying, setIsResultsPlaying] = useState(false)
  const [lastPlayedForcesSignature, setLastPlayedForcesSignature] = useState<string | null>(null)
  const [settings, setSettings] = useState(restoredAppState.settings ?? DEFAULT_APP_SETTINGS)
  const nextCreationOrderRef = useRef(restoredAppState.nextCreationOrder)
  const forcesSignature = getForcesSignature(forces)

  const stopResultsPlayback = useCallback(() => {
    setResultsPlaybackKey(0)
    setIsResultsPlaying(false)
  }, [])

  const removeSelectedForce = () => {
    if (!selectedForceId) {
      return
    }

    stopResultsPlayback()
    setForces((currentForces) =>
      assignSideSlots(currentForces.filter((force) => force.id !== selectedForceId)),
    )
    setSelectedForceId(null)
  }

  const removeForce = (forceId: string) => {
    stopResultsPlayback()
    setForces((currentForces) =>
      assignSideSlots(currentForces.filter((force) => force.id !== forceId)),
    )

    if (selectedForceId === forceId) {
      setSelectedForceId(null)
    }
  }

  useEffect(() => {
    persistAppState({ forces, settings })
  }, [forces, settings])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedForceId || (event.key !== "Backspace" && event.key !== "Delete")) {
        return
      }

      const activeTagName = document.activeElement?.tagName
      if (activeTagName === "INPUT" || activeTagName === "TEXTAREA") {
        return
      }

      event.preventDefault()
      stopResultsPlayback()
      setForces((currentForces) =>
        assignSideSlots(currentForces.filter((force) => force.id !== selectedForceId)),
      )
      setSelectedForceId(null)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedForceId, stopResultsPlayback])

  const addForce = (direction: ForceDirection, magnitude: number) => {
    stopResultsPlayback()
    setPreviewForce(null)
    setForces((currentForces) => {
      const normalizedMagnitude = normalizeCommittedMagnitude(magnitude)

      if (normalizedMagnitude === null) {
        return currentForces
      }

      if (!canAddForceToSide(currentForces, direction)) {
        return currentForces
      }

      const nextForce: ForceItem = {
        id: createForceId(nextCreationOrderRef.current),
        direction,
        magnitude: normalizedMagnitude,
        creationOrder: nextCreationOrderRef.current,
        sideSlot: 0,
      }
      nextCreationOrderRef.current += 1

      return assignSideSlots([...currentForces, nextForce])
    })
    setSelectedForceId(null)
  }

  const updateForce = (forceId: string, direction: ForceDirection, magnitude: number) => {
    stopResultsPlayback()
    setForces((currentForces) => {
      const normalizedMagnitude = normalizeCommittedMagnitude(magnitude)

      if (normalizedMagnitude === null) {
        return currentForces
      }

      const existingForce = currentForces.find((force) => force.id === forceId)

      if (!existingForce) {
        return currentForces
      }

      if (
        existingForce.direction !== direction &&
        !canMoveForceToSide(currentForces, forceId, direction)
      ) {
        return currentForces
      }

      return assignSideSlots(
        currentForces.map((force) =>
          force.id === forceId
            ? { ...force, direction, magnitude: normalizedMagnitude }
            : force,
        ),
      )
    })
  }

  const reorderForces = (orderedForceIds: string[]) => {
    stopResultsPlayback()
    setForces((currentForces) => {
      const forcesById = new Map(currentForces.map((force) => [force.id, force]))
      const reorderedForces = orderedForceIds
        .map((forceId, index) => {
          const force = forcesById.get(forceId)

          if (!force) {
            return null
          }

          return {
            ...force,
            creationOrder: index + 1,
          }
        })
        .filter((force): force is ForceItem => force !== null)

      return assignSideSlots(reorderedForces)
    })
  }

  const resetForces = () => {
    stopResultsPlayback()
    setForces([])
    setSelectedForceId(null)
    nextCreationOrderRef.current = 1
  }

  const clearSavedState = () => {
    clearPersistedAppState()

    if (typeof window !== "undefined") {
      window.location.reload()
    }
  }

  const playResults = () => {
    if (forces.length === 0) {
      return
    }

    setLastPlayedForcesSignature(forcesSignature)
    setSelectedForceId(null)
    setIsResultsPlaying(true)
    setResultsPlaybackKey((currentKey) => currentKey + 1)
  }

  const handleResultsPlaybackComplete = useCallback(() => {
    stopResultsPlayback()
  }, [stopResultsPlayback])

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[linear-gradient(180deg,#d8ecff_0%,#f7fbff_16%,#f8fafc_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="min-w-0">
            <ForcePlayground
              forces={forces}
              selectedForceId={selectedForceId}
              onSelectForce={setSelectedForceId}
              onPreviewForceChange={setPreviewForce}
              onAddForce={addForce}
              onUpdateForce={updateForce}
              onReorderForces={reorderForces}
              settings={settings}
              onUpdateSettings={(patch) =>
                setSettings((currentSettings) => ({ ...currentSettings, ...patch }))
              }
              onClearSavedState={clearSavedState}
              onRemoveSelected={removeSelectedForce}
              onRemoveForce={removeForce}
              onResetAll={resetForces}
              onPlayResults={playResults}
              canPlayResults={forces.length > 0}
              isResultsPlaying={isResultsPlaying}
              shouldPulsePlayButton={
                forces.length > 0 &&
                !isResultsPlaying &&
                forcesSignature !== lastPlayedForcesSignature
              }
              playAttentionVersion={forcesSignature}
            />
          </div>
          <div className="min-w-0">
            <ResultantPanel
              forces={getResultantForces(forces, previewForce)}
              settings={settings}
              playbackKey={resultsPlaybackKey}
              onPlaybackComplete={handleResultsPlaybackComplete}
            />
          </div>
        </div>
      </div>
    </main>
  )
}

function getForcesSignature(forces: ForceItem[]) {
  return forces
    .map((force) => `${force.id}:${force.direction}:${force.magnitude}:${force.creationOrder}:${force.sideSlot}`)
    .join("|")
}

function getResultantForces(forces: ForceItem[], previewForce: ForceItem | null) {
  if (!previewForce) {
    return forces
  }

  const previewAlreadyCommitted = forces.some(
    (force) =>
      force.direction === previewForce.direction &&
      force.magnitude === previewForce.magnitude &&
      force.sideSlot === previewForce.sideSlot,
  )

  if (previewAlreadyCommitted) {
    return forces
  }

  return [...forces, previewForce]
}

export default App
