import { Link } from 'react-router-dom'

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" width="34" height="34" fill="none">
        <path
          d="M9 2.5h13.5L27 7v17.5H9z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M22.5 2.5V7H27" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M5 7.5h14.5L24 12v17.5H5z"
          fill="var(--paper-raised)"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M19.5 7.5V12H24" stroke="currentColor" strokeWidth="1.4" />
        <path d="M9 16h10M9 19.5h10M9 23h6" stroke="var(--accent)" strokeWidth="1.4" />
      </svg>
    </span>
  )
}

export default function SiteHeader() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="Sheet — home">
          <BrandMark />
          <span className="brand-text">
            <span className="brand-name">Sheet</span>
            <span className="brand-sub">PDF workshop</span>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          <Link className="nav-link" to="/#tools">
            Tools
          </Link>
          <a
            className="nav-link"
            href="https://github.com/sarvkk/pdfresizer"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </nav>

        <span className="header-note">
          <span className="status-dot" aria-hidden="true" />
          On-device by default
        </span>
      </header>
    </>
  )
}
