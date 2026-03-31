/// <reference types="vite/client" />

import type { DetailedHTMLProps, HTMLAttributes } from "react"

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      math: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>
      mrow: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>
      msqrt: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>
      msup: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>
      mn: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>
      mo: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>
      mtext: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>
    }
  }
}
