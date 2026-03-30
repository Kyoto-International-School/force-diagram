import { cn } from "@/lib/utils"

type ScaleLegendProps = {
  className?: string
}

export function ScaleLegend({ className }: ScaleLegendProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute right-6 top-6 z-10 border border-slate-200/80 bg-white/78 px-2.5 py-1.5 text-slate-700",
        className,
      )}
    >
      <div className="text-xs font-medium">
        1 grid square ={" "}
        <math className="inline-block align-middle">
          <mrow>
            <mn>1</mn>
            <mtext>&nbsp;N</mtext>
          </mrow>
        </math>
      </div>
    </div>
  )
}
