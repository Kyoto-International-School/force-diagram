import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react"

import { ArrowUpDown, Eraser, GripVertical, Play, RotateCcw, Settings } from "lucide-react"
import {
  FaHandPointer,
} from "react-icons/fa6"

import { Button } from "@/components/ui/button"
import {
  DialogClose,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ForceDiagram,
  type DiagramArrow,
} from "@/components/force-diagram"
import { InfoTooltip } from "@/components/info-tooltip"
import { ScaleLegend } from "@/components/scale-legend"
import { TapTooltip } from "@/components/tap-tooltip"
import {
  DIRECTION_STROKE_COLORS,
  getPointFromDiagramClient,
} from "@/lib/diagram"
import {
  createForceEndpointHandle,
  createObjectNode,
} from "@/lib/diagram-presets"
import {
  BOX_HALF_UNITS,
  DIAGRAM_LINE_STROKE,
  DIAGRAM_SELECTED_LINE_STROKE,
  GRID_UNIT_PX,
  PLAYGROUND_GRID_RADIUS,
} from "@/lib/force-config"
import {
  dismissPlaygroundOnboarding,
  hasDismissedPlaygroundOnboarding,
} from "@/lib/persistence"
import {
  type ForceDirection,
  type ForceItem,
  type ForcePreview,
  canAddForceToSide,
  canMoveForceToSide,
  getForceLabel,
  getDirectionalMagnitudeFromPoint,
  getForceAnchor,
  getForceEndpoint,
  getNextSideSlot,
  snapDragDirection,
  snapToGridMagnitude,
} from "@/lib/forces"
import type { AppSettings } from "@/lib/settings"

type DragState =
  | { mode: "create" }
  | { mode: "edit"; forceId: string }

type PendingTouchEdit = {
  pointerId: number
  startX: number
  startY: number
  forceId: string
}

type ForcePlaygroundProps = {
  forces: ForceItem[]
  selectedForceId: string | null
  onSelectForce: (forceId: string | null) => void
  onPreviewForceChange: (force: ForceItem | null) => void
  onAddForce: (direction: ForceDirection, magnitude: number) => void
  onUpdateForce: (forceId: string, direction: ForceDirection, magnitude: number) => void
  onReorderForces: (orderedForceIds: string[]) => void
  settings: AppSettings
  onUpdateSettings: (patch: Partial<AppSettings>) => void
  onClearSavedState: () => void
  onRemoveSelected: () => void
  onRemoveForce: (forceId: string) => void
  onResetAll: () => void
  onPlayResults: () => void
  canPlayResults: boolean
  isResultsPlaying: boolean
  shouldPulsePlayButton: boolean
  playAttentionVersion: number
}

const TOUCH_DRAG_THRESHOLD_PX = 10
const OBJECT_NODE_SIZE_PX = BOX_HALF_UNITS * GRID_UNIT_PX * 2

export function ForcePlayground({
  forces,
  selectedForceId,
  onSelectForce,
  onPreviewForceChange,
  onAddForce,
  onUpdateForce,
  onReorderForces,
  settings,
  onUpdateSettings,
  onClearSavedState,
  onRemoveSelected,
  onRemoveForce,
  onResetAll,
  onPlayResults,
  canPlayResults,
  isResultsPlaying,
  shouldPulsePlayButton,
  playAttentionVersion,
}: ForcePlaygroundProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [pendingTouchEdit, setPendingTouchEdit] = useState<PendingTouchEdit | null>(null)
  const [preview, setPreview] = useState<ForcePreview | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isOrderOpen, setIsOrderOpen] = useState(false)
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(() =>
    hasDismissedPlaygroundOnboarding(),
  )
  const [orderDragState, setOrderDragState] = useState<{
    forceId: string
    pointerId: number
  } | null>(null)

  const selectedForce = useMemo(
    () => forces.find((force) => force.id === selectedForceId) ?? null,
    [forces, selectedForceId],
  )
  const orderedForces = useMemo(
    () => [...forces].sort((left, right) => left.creationOrder - right.creationOrder),
    [forces],
  )
  const orderedForceIdsRef = useRef<string[]>(orderedForces.map((force) => force.id))
  const playDisabledReason = isResultsPlaying
    ? "The results animation is already playing."
    : "Add at least one force to play the results."
  const orderDisabledReason = "Add at least two forces to change their order."
  const eraseDisabledReason = "Select a force before erasing it."
  const resetDisabledReason = "Add at least one force before resetting the grid."
  const toolButtonClassName =
    "h-13 w-14 flex-col gap-0.5 rounded-xl px-0 py-1 text-[10px] font-medium leading-none"
  const destructiveToolButtonClassName =
    `${toolButtonClassName} border-rose-200/90 bg-rose-50/92 text-rose-700 hover:bg-rose-100`
  const showOnboardingGesture =
    !isOnboardingDismissed &&
    forces.length === 0 &&
    !dragState &&
    !pendingTouchEdit &&
    !preview &&
    !isSettingsOpen &&
    !isOrderOpen &&
    !isResetConfirmOpen

  const dismissOnboardingGesture = () => {
    if (isOnboardingDismissed) {
      return
    }

    setIsOnboardingDismissed(true)
    dismissPlaygroundOnboarding()
  }

  useEffect(() => {
    orderedForceIdsRef.current = orderedForces.map((force) => force.id)
  }, [orderedForces])

  useEffect(() => {
    if (forces.length > 0) {
      dismissOnboardingGesture()
    }
  }, [forces.length])

  useEffect(() => {
    if (!dragState && !pendingTouchEdit) {
      return undefined
    }

    const getPointForEvent = (event: PointerEvent) =>
      getPointFromDiagramClient(
        svgRef.current,
        event.clientX,
        event.clientY,
        PLAYGROUND_GRID_RADIUS,
      )

    const getPreviewForPoint = (point: { x: number; y: number }) => {
      const direction = snapDragDirection(point.x, point.y)

      if (!direction) {
        return null
      }

      const magnitude = snapToGridMagnitude(
        getDirectionalMagnitudeFromPoint(point, direction),
      )

      return {
        direction,
        magnitude,
        sideSlot: getNextSideSlot(forces, direction),
        blocked: !canAddForceToSide(forces, direction),
      }
    }

    const applyEditForPoint = (point: { x: number; y: number }, forceId: string) => {
      const direction = snapDragDirection(point.x, point.y)

      if (!direction) {
        return
      }

      const magnitude = snapToGridMagnitude(getDirectionalMagnitudeFromPoint(point, direction))

      if (magnitude >= 1 && canMoveForceToSide(forces, forceId, direction)) {
        onUpdateForce(forceId, direction, magnitude)
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.cancelable) {
        event.preventDefault()
      }

      if (pendingTouchEdit) {
        if (event.pointerId !== pendingTouchEdit.pointerId) {
          return
        }

        const distance = Math.hypot(
          event.clientX - pendingTouchEdit.startX,
          event.clientY - pendingTouchEdit.startY,
        )

        if (distance < TOUCH_DRAG_THRESHOLD_PX) {
          return
        }

        setPendingTouchEdit(null)
        setDragState({
          mode: "edit",
          forceId: pendingTouchEdit.forceId,
        })
      }

      if (!dragState && !pendingTouchEdit) {
        return
      }

      const point = getPointForEvent(event)

      if (!point) {
        return
      }

      if (dragState?.mode === "create") {
        setPreview(getPreviewForPoint(point))
        return
      }

      const editForceId =
        dragState?.mode === "edit" ? dragState.forceId : pendingTouchEdit?.forceId

      if (!editForceId) {
        return
      }

      applyEditForPoint(point, editForceId)
    }

    const resetInteraction = () => {
      setPendingTouchEdit(null)
      setDragState(null)
      setPreview(null)
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (pendingTouchEdit && event.pointerId === pendingTouchEdit.pointerId) {
        resetInteraction()
        return
      }

      const point = getPointForEvent(event)

      if (dragState?.mode === "create") {
        const finalPreview = point ? getPreviewForPoint(point) : preview

        if (finalPreview && !finalPreview.blocked && finalPreview.magnitude >= 1) {
          onAddForce(finalPreview.direction, finalPreview.magnitude)
        }
      }

      if (dragState?.mode === "edit" && point) {
        applyEditForPoint(point, dragState.forceId)
      }

      resetInteraction()
    }

    const handlePointerCancel = () => {
      resetInteraction()
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false })
    window.addEventListener("pointerup", handlePointerUp, { once: true })
    window.addEventListener("pointercancel", handlePointerCancel, { once: true })

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerCancel)
    }
  }, [dragState, forces, onAddForce, onUpdateForce, pendingTouchEdit, preview])

  useEffect(() => {
    if (!orderDragState) {
      return undefined
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== orderDragState.pointerId) {
        return
      }

      if (event.cancelable) {
        event.preventDefault()
      }

      const element = document.elementFromPoint(event.clientX, event.clientY)
      const row = element?.closest<HTMLElement>("[data-force-order-row-id]")
      const overForceId = row?.dataset.forceOrderRowId

      if (!overForceId || overForceId === orderDragState.forceId) {
        return
      }

      const nextOrder = moveForceId(
        orderedForceIdsRef.current,
        orderDragState.forceId,
        overForceId,
      )

      if (!nextOrder) {
        return
      }

      orderedForceIdsRef.current = nextOrder
      onReorderForces(nextOrder)
    }

    const finishDrag = (event?: PointerEvent) => {
      if (event && event.pointerId !== orderDragState.pointerId) {
        return
      }

      setOrderDragState(null)
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false })
    window.addEventListener("pointerup", finishDrag)
    window.addEventListener("pointercancel", finishDrag)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", finishDrag)
      window.removeEventListener("pointercancel", finishDrag)
    }
  }, [onReorderForces, orderDragState])

  const diagramNodes = [
    createObjectNode({
      id: "object",
      point: { x: 0, y: 0 },
      stroke: "#bfdbfe",
      strokeWidth: 8,
      className: "drop-shadow-[0_0_18px_rgba(59,130,246,0.14)]",
      onPointerDown: (event: ReactPointerEvent<SVGCircleElement | SVGRectElement>) => {
        event.stopPropagation()
        dismissOnboardingGesture()
        onSelectForce(null)
        setPendingTouchEdit(null)
        setPreview(null)
        setDragState({ mode: "create" })
      },
    }),
    {
      id: "object-hit-target",
      point: { x: 0, y: 0 },
      shape: "rect" as const,
      layer: "above-arrows" as const,
      width: OBJECT_NODE_SIZE_PX,
      height: OBJECT_NODE_SIZE_PX,
      cornerRadius: 22,
      fill: "transparent",
      onPointerDown: (event: ReactPointerEvent<SVGCircleElement | SVGRectElement>) => {
        event.stopPropagation()
        dismissOnboardingGesture()
        onSelectForce(null)
        setPendingTouchEdit(null)
        setPreview(null)
        setDragState({ mode: "create" })
      },
    },
  ]

  const diagramArrows: DiagramArrow[] = forces.map((force) => {
    const isSelected = force.id === selectedForceId
    const beginForceEdit = (
      event: ReactPointerEvent<SVGLineElement | SVGCircleElement>,
    ) => {
      event.stopPropagation()
      onSelectForce(force.id)

      if (event.pointerType === "touch") {
        setPendingTouchEdit({
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          forceId: force.id,
        })
        return
      }

      setPendingTouchEdit(null)
      setDragState({
        mode: "edit",
        forceId: force.id,
      })
    }

    return {
      id: force.id,
      from: getForceAnchor(force),
      to: getForceEndpoint(force),
      stroke: DIRECTION_STROKE_COLORS[force.direction],
      label: `${force.magnitude} N`,
      labelPlacement: "endpoint",
      opacity: isSelected ? 1 : 0.9,
      strokeWidth: isSelected ? DIAGRAM_SELECTED_LINE_STROKE : DIAGRAM_LINE_STROKE,
      lineHitAreaWidth: 30,
      onPointerDown: beginForceEdit,
      endpointHandle: createForceEndpointHandle({
        direction: force.direction,
        isSelected,
        onPointerDown: beginForceEdit,
      }),
    }
  })

  const previewArrow: DiagramArrow[] =
    preview && preview.magnitude >= 1
      ? [
          {
            id: "preview",
            from: getForceAnchor({
              direction: preview.direction,
              sideSlot: preview.sideSlot,
            }),
            to: getForceEndpoint({
              direction: preview.direction,
              sideSlot: preview.sideSlot,
              magnitude: preview.magnitude,
            }),
            stroke: preview.blocked ? "#fda4af" : "#94a3b8",
            label: preview.blocked ? "Side full" : `${preview.magnitude} N`,
            labelPlacement: "endpoint",
            labelColor: preview.blocked ? "#e11d48" : "#475569",
            opacity: preview.blocked ? 0.5 : 0.75,
            strokeDasharray: "10 8",
          },
        ]
      : []

  useEffect(() => {
    if (!preview || preview.blocked || preview.magnitude < 1) {
      onPreviewForceChange(null)
      return
    }

    onPreviewForceChange({
      id: "preview-force",
      direction: preview.direction,
      magnitude: preview.magnitude,
      creationOrder:
        orderedForces.length > 0
          ? Math.max(...orderedForces.map((force) => force.creationOrder)) + 1
          : 1,
      sideSlot: preview.sideSlot,
    })
  }, [onPreviewForceChange, orderedForces, preview])

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_60px_-36px_rgba(15,23,42,0.45)]">
      <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-3">
        <h2 className="text-lg font-semibold text-slate-900">Force Playground</h2>
        <InfoTooltip label="About the force playground">
          Drag out from the object to add a force. Click an arrow to edit or remove it.
        </InfoTooltip>
      </div>

      <div className="flex flex-1 flex-col pt-1">
        <div className="px-5">
          <div className="relative rounded-[1.6rem] bg-[linear-gradient(180deg,#f8fbff,#eef5ff)] p-3">
            <ScaleLegend />
            {showOnboardingGesture ? (
              <div className="pointer-events-none absolute inset-3 z-[5] overflow-hidden rounded-[1.3rem]" aria-hidden="true">
                <div className="playground-onboarding absolute left-1/2 top-1/2">
                  <div className="playground-onboarding__origin" />
                  <div className="playground-onboarding__gesture playground-onboarding__gesture--right">
                    <div className="playground-onboarding__trail" />
                    <div className="playground-onboarding__hand">
                      <FaHandPointer className="size-7 text-sky-600/80" />
                    </div>
                  </div>
                  <div className="playground-onboarding__gesture playground-onboarding__gesture--left">
                    <div className="playground-onboarding__trail" />
                    <div className="playground-onboarding__hand">
                      <FaHandPointer className="size-7 text-sky-600/80" />
                    </div>
                  </div>
                  <div className="playground-onboarding__gesture playground-onboarding__gesture--up">
                    <div className="playground-onboarding__trail" />
                    <div className="playground-onboarding__hand">
                      <FaHandPointer className="size-7 text-sky-600/80" />
                    </div>
                  </div>
                  <div className="playground-onboarding__gesture playground-onboarding__gesture--down">
                    <div className="playground-onboarding__trail" />
                    <div className="playground-onboarding__hand">
                      <FaHandPointer className="size-7 text-sky-600/80" />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <ForceDiagram
              svgRef={svgRef}
              className="aspect-square w-full touch-none rounded-[1.3rem] border border-slate-200 bg-white"
              gridRadius={PLAYGROUND_GRID_RADIUS}
              nodes={diagramNodes}
              arrows={[...diagramArrows, ...previewArrow]}
              onBackgroundPointerDown={() => {
                setPendingTouchEdit(null)
                onSelectForce(null)
              }}
            />
          </div>
        </div>
        <div className="mt-3 flex min-h-[96px] flex-col border-t border-slate-200/80 bg-slate-50/70 px-9 py-3 text-sm text-slate-700">
          <div className="text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Tools
          </div>
          <div className="flex flex-1 items-center">
            <div className="mt-1 grid w-full content-center justify-items-center gap-2 grid-cols-5">
              {!canPlayResults || isResultsPlaying ? (
                <TapTooltip label="Why play is unavailable" content={playDisabledReason}>
                  <Button
                    size="icon-lg"
                    className={`${toolButtonClassName} bg-sky-600 text-white hover:bg-sky-700`}
                    disabled
                    aria-label="Play"
                  >
                    <Play className="size-4" />
                    <span>Play</span>
                  </Button>
                </TapTooltip>
              ) : (
                <Button
                  key={`play-${playAttentionVersion}`}
                  size="icon-lg"
                  className={`${toolButtonClassName} bg-sky-600 text-white hover:bg-sky-700 ${shouldPulsePlayButton ? "play-button-attention" : ""}`}
                  onClick={onPlayResults}
                  aria-label="Play"
                  title="Play"
                >
                  <Play className="size-4" />
                  <span>Play</span>
                </Button>
              )}
              {forces.length < 2 ? (
                <TapTooltip label="Why order is unavailable" content={orderDisabledReason}>
                  <Button
                    variant="outline"
                    size="icon-lg"
                    className={toolButtonClassName}
                    disabled
                    aria-label="Order"
                  >
                    <ArrowUpDown className="size-4" />
                    <span>Order</span>
                  </Button>
                </TapTooltip>
              ) : (
                <Button
                  variant="outline"
                  size="icon-lg"
                  className={toolButtonClassName}
                  onClick={() => setIsOrderOpen(true)}
                  aria-label="Order"
                  title="Order"
                >
                  <ArrowUpDown className="size-4" />
                  <span>Order</span>
                </Button>
              )}
              {!selectedForce ? (
                <TapTooltip label="Why erase is unavailable" content={eraseDisabledReason}>
                  <Button
                    variant="destructive"
                    size="icon-lg"
                    className={destructiveToolButtonClassName}
                    disabled
                    aria-label="Erase"
                  >
                    <Eraser className="size-4" />
                    <span>Erase</span>
                  </Button>
                </TapTooltip>
              ) : (
                <Button
                  variant="destructive"
                  size="icon-lg"
                  className={destructiveToolButtonClassName}
                  onClick={onRemoveSelected}
                  aria-label="Erase"
                  title="Erase"
                >
                  <Eraser className="size-4" />
                  <span>Erase</span>
                </Button>
              )}
              {forces.length === 0 ? (
                <TapTooltip label="Why reset is unavailable" content={resetDisabledReason}>
                  <Button
                    variant="destructive"
                    size="icon-lg"
                    className={destructiveToolButtonClassName}
                    disabled
                    aria-label="Reset"
                  >
                    <RotateCcw className="size-4" />
                    <span>Reset</span>
                  </Button>
                </TapTooltip>
              ) : (
                <Button
                  variant="destructive"
                  size="icon-lg"
                  className={destructiveToolButtonClassName}
                  onClick={() => setIsResetConfirmOpen(true)}
                  aria-label="Reset"
                  title="Reset"
                >
                  <RotateCcw className="size-4" />
                  <span>Reset</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="icon-lg"
                className={toolButtonClassName}
                onClick={() => setIsSettingsOpen(true)}
                aria-label="Settings"
                title="Settings"
              >
                <Settings className="size-4" />
                <span>Settings</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
      <Dialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset grid?</DialogTitle>
            <DialogDescription>
              This will remove every force from the grid and clear the current walkthrough.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                onResetAll()
                setIsResetConfirmOpen(false)
              }}
            >
              Reset grid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Control advanced result details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            <section className="space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Display
              </div>
              <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-900">Advanced mode</div>
                  <p className="text-sm text-slate-600">
                    Show the magnitude calculation in Results and label the green resultant line.
                  </p>
                </div>
                <label className="relative mt-0.5 inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={settings.advancedMode}
                    onChange={(event) =>
                      onUpdateSettings({ advancedMode: event.target.checked })
                    }
                  />
                  <span className="h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-sky-600" />
                  <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                  <span className="sr-only">Toggle advanced mode</span>
                </label>
              </div>
            </section>
            <section className="space-y-3 border-t border-slate-200 pt-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Storage
              </div>
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-900">Clear saved data</div>
                  <p className="text-sm text-slate-600">
                    Remove the saved grid, order, and settings from this browser and reset the current session.
                  </p>
                </div>
                <div className="flex justify-start">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      onClearSavedState()
                      setIsSettingsOpen(false)
                    }}
                  >
                    Clear saved data
                  </Button>
                </div>
              </div>
            </section>
          </div>
          <div className="flex justify-end border-t border-slate-200 pt-4">
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isOrderOpen} onOpenChange={setIsOrderOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Order</DialogTitle>
            <DialogDescription>
              Drag forces to change the walkthrough order used in the results grid.
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-h-[16rem] content-start gap-2 overflow-y-auto">
            {orderedForces.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Add forces to set an order.
              </div>
            ) : (
              orderedForces.map((force, index) => (
                <div
                  key={force.id}
                  data-force-order-row-id={force.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${
                    orderDragState?.forceId === force.id
                      ? "border-sky-300 bg-sky-50 shadow-sm"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <button
                    type="button"
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                      orderDragState?.forceId === force.id
                        ? "border-sky-300 bg-white text-sky-700"
                        : "border-slate-200 bg-white text-slate-500"
                    }`}
                    onPointerDown={(event) => {
                      event.preventDefault()
                      setOrderDragState({
                        forceId: force.id,
                        pointerId: event.pointerId,
                      })
                    }}
                  >
                    <GripVertical className="size-4" />
                    <span className="sr-only">Drag to reorder</span>
                  </button>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="w-7 text-right text-sm font-bold tabular-nums text-slate-700">
                      {index + 1}
                    </div>
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: DIRECTION_STROKE_COLORS[force.direction] }}
                    />
                    <div className="min-w-0 truncate text-sm font-normal text-slate-600">
                      {getForceLabel(force)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 transition-colors hover:bg-rose-50"
                    onPointerDown={(event) => {
                      event.stopPropagation()
                    }}
                    onClick={() => {
                      onRemoveForce(force.id)
                    }}
                    aria-label={`Delete ${getForceLabel(force)}`}
                    title="Delete"
                  >
                    <Eraser className="size-4" />
                  </button>
                </div>
              ))
            )}
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </section>
  )
}

function moveForceId(forceIds: string[], draggedForceId: string, targetForceId: string) {
  const fromIndex = forceIds.indexOf(draggedForceId)
  const toIndex = forceIds.indexOf(targetForceId)

  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return null
  }

  const nextForceIds = [...forceIds]
  const [draggedForce] = nextForceIds.splice(fromIndex, 1)
  nextForceIds.splice(toIndex, 0, draggedForce)
  return nextForceIds
}
