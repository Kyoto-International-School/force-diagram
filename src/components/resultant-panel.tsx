import { useEffect, useState } from "react"

import {
  ForceDiagram,
  type DiagramArrow,
  type DiagramNode,
} from "@/components/force-diagram"
import { InfoTooltip } from "@/components/info-tooltip"
import { ScaleLegend } from "@/components/scale-legend"
import {
  createObjectNode,
} from "@/lib/diagram-presets"
import { DIRECTION_STROKE_COLORS } from "@/lib/diagram"
import {
  PLAYGROUND_GRID_RADIUS,
} from "@/lib/force-config"
import {
  calculateResultant,
  type ForceItem,
  generateWalkthroughPositions,
  summarizeVectorMagnitude,
} from "@/lib/forces"
import type { AppSettings } from "@/lib/settings"

type ResultantPanelProps = {
  forces: ForceItem[]
  settings: AppSettings
  playbackKey: number
  onPlaybackComplete: () => void
}

const PLAYBACK_STEP_MS = 900
const PLAYBACK_RESULT_MS = 1000
const WALKTHROUGH_STROKE = 16
const RESULTANT_STROKE = 6

type PlaybackState =
  | {
      mode: "idle"
      completedSteps: number
      activeStepIndex: null
      activeStepProgress: number
      resultantProgress: number
    }
  | {
      mode: "walkthrough"
      completedSteps: number
      activeStepIndex: number
      activeStepProgress: number
      resultantProgress: 0
    }
  | {
      mode: "resultant"
      completedSteps: number
      activeStepIndex: null
      activeStepProgress: 1
      resultantProgress: number
    }

export function ResultantPanel({
  forces,
  settings,
  playbackKey,
  onPlaybackComplete,
}: ResultantPanelProps) {
  const resultant = calculateResultant(forces)
  const walkthrough = generateWalkthroughPositions(forces)
  const walkthroughStepCount = walkthrough.steps.length
  const [playbackState, setPlaybackState] = useState<PlaybackState>(() =>
    createIdlePlaybackState(walkthroughStepCount),
  )
  const currentResultPoint =
    playbackState.mode === "walkthrough"
      ? walkthrough.positions[playbackState.completedSteps]
      : { x: resultant.x, y: resultant.y }
  const magnitudeSummary = summarizeVectorMagnitude(
    currentResultPoint.x,
    currentResultPoint.y,
  )
  const finalMagnitudeSummary = summarizeVectorMagnitude(resultant.x, resultant.y)
  const verticalComponent = Math.abs(currentResultPoint.y)
  const horizontalComponent = Math.abs(currentResultPoint.x)

  const completedWalkthroughArrows: DiagramArrow[] = walkthrough.steps
    .slice(0, playbackState.completedSteps)
    .map((step) => ({
      id: step.force.id,
      from: step.from,
      to: step.to,
      stroke: DIRECTION_STROKE_COLORS[step.force.direction],
      strokeWidth: WALKTHROUGH_STROKE,
    }))

  const activeWalkthroughArrow: DiagramArrow[] =
    playbackState.mode === "walkthrough"
      ? [
          {
            id: `${walkthrough.steps[playbackState.activeStepIndex]?.force.id ?? "active"}-active`,
            from: walkthrough.steps[playbackState.activeStepIndex].from,
            to: interpolatePoint(
              walkthrough.steps[playbackState.activeStepIndex].from,
              walkthrough.steps[playbackState.activeStepIndex].to,
              playbackState.activeStepProgress,
            ),
            stroke:
              DIRECTION_STROKE_COLORS[
                walkthrough.steps[playbackState.activeStepIndex].force.direction
              ],
            strokeWidth: WALKTHROUGH_STROKE,
            opacity: 0.95,
          },
        ]
      : []

  const walkthroughArrows: DiagramArrow[] = [...completedWalkthroughArrows, ...activeWalkthroughArrow]
  const resultantArrow: DiagramArrow[] =
    walkthrough.steps.length > 0 &&
    (playbackState.mode === "idle" || playbackState.mode === "resultant")
      ? [
          {
            id: "resultant",
            from: { x: 0, y: 0 },
            to:
              playbackState.mode === "resultant"
                ? interpolatePoint(
                    { x: 0, y: 0 },
                    { x: resultant.x, y: resultant.y },
                    playbackState.resultantProgress,
                  )
                : { x: resultant.x, y: resultant.y },
            stroke: "#eab308",
            label:
              settings.advancedMode && playbackState.mode === "idle"
                ? `${finalMagnitudeSummary.isApproximate ? "≈ " : ""}${finalMagnitudeSummary.magnitudeText} N`
                : undefined,
            labelRotateWithLine: true,
            strokeDasharray: "12 8",
            strokeWidth: RESULTANT_STROKE,
            opacity: 0.9,
          },
        ]
      : []
  const walkthroughNodes: DiagramNode[] = [
    createObjectNode({
      id: "node-0",
      point: { x: 0, y: 0 },
    }),
  ]

  useEffect(() => {
    setPlaybackState(createIdlePlaybackState(walkthroughStepCount))
  }, [walkthroughStepCount])

  useEffect(() => {
    if (playbackKey === 0) {
      return undefined
    }

    if (walkthroughStepCount === 0) {
      setPlaybackState(createIdlePlaybackState(0))
      onPlaybackComplete()
      return undefined
    }

    let animationFrame = 0
    let cancelled = false

    const runSegment = (
      duration: number,
      onFrame: (progress: number) => void,
      onDone: () => void,
    ) => {
      let startTime: number | null = null

      const tick = (timestamp: number) => {
        if (cancelled) {
          return
        }

        if (startTime === null) {
          startTime = timestamp
        }

        const progress = Math.min((timestamp - startTime) / duration, 1)
        onFrame(easeInOutCubic(progress))

        if (progress < 1) {
          animationFrame = window.requestAnimationFrame(tick)
          return
        }

        onDone()
      }

      animationFrame = window.requestAnimationFrame(tick)
    }

    const animateResultant = () => {
      runSegment(
        PLAYBACK_RESULT_MS,
        (progress) => {
          setPlaybackState({
            mode: "resultant",
            completedSteps: walkthroughStepCount,
            activeStepIndex: null,
            activeStepProgress: 1,
            resultantProgress: progress,
          })
        },
        () => {
          setPlaybackState(createIdlePlaybackState(walkthroughStepCount))
          onPlaybackComplete()
        },
      )
    }

    const animateStep = (stepIndex: number) => {
      runSegment(
        PLAYBACK_STEP_MS,
        (progress) => {
          setPlaybackState({
            mode: "walkthrough",
            completedSteps: stepIndex,
            activeStepIndex: stepIndex,
            activeStepProgress: progress,
            resultantProgress: 0,
          })
        },
        () => {
          if (stepIndex === walkthroughStepCount - 1) {
            animateResultant()
            return
          }

          animateStep(stepIndex + 1)
        },
      )
    }

    setPlaybackState({
      mode: "walkthrough",
      completedSteps: 0,
      activeStepIndex: 0,
      activeStepProgress: 0,
      resultantProgress: 0,
    })
    animateStep(0)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(animationFrame)
    }
  }, [onPlaybackComplete, playbackKey, walkthroughStepCount])

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_60px_-36px_rgba(15,23,42,0.45)]">
      <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-3">
        <h2 className="text-lg font-semibold text-slate-900">Resultant Force</h2>
        <InfoTooltip label="About the results panel">
          Step-by-step walk and final resultant.
        </InfoTooltip>
      </div>

      <div className="flex flex-1 flex-col pt-1">
        <div className="px-5">
          <div className="relative rounded-[1.6rem] bg-[linear-gradient(180deg,#fbfcfe,#f2f5fa)] p-3">
            <ScaleLegend />
            <ForceDiagram
              className="aspect-square w-full rounded-[1.3rem] border border-slate-100 bg-slate-50/80"
              gridRadius={PLAYGROUND_GRID_RADIUS}
              arrows={[...walkthroughArrows, ...resultantArrow]}
              nodes={walkthroughNodes}
            />
          </div>
        </div>
        <div className="mt-3 min-h-[96px] border-t border-slate-200/80 bg-slate-50/70 px-9 py-3 text-sm text-slate-700">
          <div className="text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Resultant
          </div>
          <div className={`mt-2 grid gap-3 ${settings.advancedMode ? "md:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)]" : ""}`}>
            <div className="inline-grid grid-cols-[3.1rem_2.5rem_0.9rem_0.85rem] items-baseline gap-x-0.5 gap-y-1.5 text-[12px]">
              <div className="text-slate-500">Vertical:</div>
              <math className="inline-block justify-self-end text-slate-900">
                <mn>{formatComponentValue(verticalComponent)}</mn>
              </math>
              <math className="inline-block text-slate-900">
                <mtext>N</mtext>
              </math>
              <span className="text-slate-900">
                {currentResultPoint.y !== 0 ? (currentResultPoint.y > 0 ? "↑" : "↓") : ""}
              </span>
              <div className="text-slate-500">Horizontal:</div>
              <math className="inline-block justify-self-end text-slate-900">
                <mn>{formatComponentValue(horizontalComponent)}</mn>
              </math>
              <math className="inline-block text-slate-900">
                <mtext>N</mtext>
              </math>
              <span className="text-slate-900">
                {currentResultPoint.x !== 0 ? (currentResultPoint.x > 0 ? "→" : "←") : ""}
              </span>
            </div>
            {settings.advancedMode ? (
              <div className="border-t border-slate-200 pt-2 text-[12px] text-slate-900 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                <span className="text-slate-500">Magnitude:</span>{" "}
                <math className="inline-block align-middle">
                  <msqrt>
                    <mtext>
                      ({verticalComponent}
                      ² + {horizontalComponent}
                      ²)
                    </mtext>
                  </msqrt>
                </math>{" "}
                ={" "}
                <math className="inline-block align-middle">
                  <msqrt>
                    <mn>{magnitudeSummary.squaredSum}</mn>
                  </msqrt>
                </math>{" "}
                {magnitudeSummary.relationSymbol}{" "}
                <math className="inline-block align-middle">
                  <mrow>
                    <mn>{magnitudeSummary.magnitudeText}</mn>
                    <mtext>&nbsp;N</mtext>
                  </mrow>
                </math>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function formatComponentValue(value: number) {
  if (Number.isInteger(value)) {
    return value.toString()
  }

  return value.toFixed(1)
}

function createIdlePlaybackState(stepCount: number): PlaybackState {
  return {
    mode: "idle",
    completedSteps: stepCount,
    activeStepIndex: null,
    activeStepProgress: 1,
    resultantProgress: stepCount > 0 ? 1 : 0,
  }
}

function interpolatePoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  progress: number,
) {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  }
}

function easeInOutCubic(progress: number) {
  if (progress < 0.5) {
    return 4 * progress * progress * progress
  }

  return 1 - Math.pow(-2 * progress + 2, 3) / 2
}
