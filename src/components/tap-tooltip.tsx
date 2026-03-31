import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Info } from "lucide-react"

type TapTooltipProps = {
  children: ReactNode
  content: ReactNode
  label: string
}

export function TapTooltip({ children, content, label }: TapTooltipProps) {
  const [open, setOpen] = useState(false)
  const [isPositioned, setIsPositioned] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const tooltipId = useId()

  const closeTooltip = () => {
    setOpen(false)
    setIsPositioned(false)
  }

  useLayoutEffect(() => {
    if (!open) {
      return undefined
    }

    const updatePosition = () => {
      const trigger = triggerRef.current
      const tooltip = tooltipRef.current

      if (!trigger || !tooltip) {
        return
      }

      const triggerRect = trigger.getBoundingClientRect()
      const tooltipRect = tooltip.getBoundingClientRect()
      const viewportPadding = 12
      const left = Math.min(
        Math.max(triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2, viewportPadding),
        window.innerWidth - tooltipRect.width - viewportPadding,
      )

      setPosition({
        top: triggerRect.top - tooltipRect.height - 8,
        left,
      })
      setIsPositioned(true)
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)

    return () => {
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node

      if (
        !containerRef.current?.contains(target) &&
        !tooltipRef.current?.contains(target)
      ) {
        closeTooltip()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTooltip()
      }
    }

    window.addEventListener("pointerdown", handlePointerDown)
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }

    event.preventDefault()
    if (open) {
      closeTooltip()
      return
    }

    setOpen(true)
  }

  return (
    <div ref={containerRef} className="relative inline-flex">
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        className="inline-flex cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        onClick={() => {
          if (open) {
            closeTooltip()
            return
          }

          setOpen(true)
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        {children}
      </div>
      {createPortal(
        <div
          id={tooltipId}
          ref={tooltipRef}
          className={`fixed z-[2147483647] w-56 rounded-xl bg-slate-900 px-3 py-2 text-left text-xs leading-5 text-slate-50 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.9)] transition ${
            open && isPositioned
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }`}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 size-4 shrink-0 text-sky-200" />
            <div className="min-w-0">{content}</div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
