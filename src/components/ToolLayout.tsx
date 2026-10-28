import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import SiteFooter from './SiteFooter'
import SiteHeader from './SiteHeader'
import { usePageMeta } from '../hooks/usePageMeta'

export interface ToolMeta {
  label: string
  value: string
}

interface ToolLayoutProps {
  number: string
  title: string
  description: string
  steps: [string, string, string]
  meta: ToolMeta[]
  note?: string
  children: ReactNode
}

const DEFAULT_NOTE = 'Files are processed on your device. Nothing is uploaded.'

export default function ToolLayout({
  number,
  title,
  description,
  steps,
  meta,
  note = DEFAULT_NOTE,
  children,
}: ToolLayoutProps) {
  usePageMeta(`${title} — Sheet`, description)

  return (
    <div className="app-shell">
      <SiteHeader />

      <main className="tool-main" id="main">
        <Link to="/" className="back-link">
          <Icon name="arrow" size={16} />
          All tools
        </Link>

        <div className="tool-heading">
          <span className="tool-index" aria-hidden="true">
            {number}
            <small>/ 06</small>
          </span>
          <div className="tool-heading-copy">
            <h1 className="tool-title">{title}</h1>
            <p className="tool-desc">{description}</p>
          </div>
        </div>

        <div className="workspace">
          <div className="workspace-panel">{children}</div>

          <aside className="workspace-aside" aria-label={`About ${title}`}>
            <div className="aside-block">
              <p className="eyebrow">Method</p>
              <ol className="step-list">
                {steps.map((step, index) => (
                  <li key={step}>
                    <span className="step-number">{String(index + 1).padStart(2, '0')}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="aside-block">
              <p className="eyebrow">Details</p>
              <dl className="meta-list">
                {meta.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="aside-note">
              <Icon name="shield" size={18} />
              <p>{note}</p>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
