import type { ReactNode, SVGProps } from 'react'

export type IconName =
  | 'compress'
  | 'resize'
  | 'merge'
  | 'split'
  | 'rotate'
  | 'reorder'
  | 'upload'
  | 'download'
  | 'arrow'
  | 'check'
  | 'shield'
  | 'file'
  | 'trash'
  | 'close'
  | 'alert'

const paths: Record<IconName, ReactNode> = {
  compress: (
    <>
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
      <rect x="10" y="10" width="4" height="4" rx="0.5" />
    </>
  ),
  resize: (
    <>
      <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
    </>
  ),
  merge: (
    <>
      <rect x="3" y="3" width="10" height="14" rx="1" />
      <rect x="11" y="7" width="10" height="14" rx="1" />
      <path d="M16 11v6M13 14h6" />
    </>
  ),
  split: (
    <>
      <circle cx="6" cy="7" r="2.5" />
      <circle cx="6" cy="17" r="2.5" />
      <path d="M8.2 8.4 20 17M8.2 15.6 20 7" />
    </>
  ),
  rotate: (
    <>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v5h-5" />
    </>
  ),
  reorder: (
    <>
      <path d="M4 6h9M4 12h9M4 18h9" />
      <path d="M17 4v16M14 7l3-3 3 3M14 17l3 3 3-3" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12M7 11l5 5 5-5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </>
  ),
  arrow: <path d="M4 12h15M13 6l6 6-6 6" />,
  check: <path d="m5 12 4.5 4.5L19 6" />,
  shield: (
    <>
      <path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  alert: (
    <>
      <path d="M12 3 2 21h20z" />
      <path d="M12 9v5M12 18h.01" />
    </>
  ),
}

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
}

export default function Icon({ name, size = 24, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  )
}
