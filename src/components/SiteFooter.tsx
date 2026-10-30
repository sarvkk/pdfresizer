import { Link } from 'react-router-dom'

const toolLinks = [
  { path: '/compress', label: 'Compress' },
  { path: '/resize', label: 'Resize' },
  { path: '/merge', label: 'Merge' },
  { path: '/split', label: 'Split' },
  { path: '/rotate', label: 'Rotate' },
  { path: '/reorder', label: 'Reorder' },
  { path: '/flatten', label: 'Flatten' },
  { path: '/protect', label: 'Protect' },
]

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-lede">
          <span className="footer-wordmark">Sheet</span>
          <p>
            A small, quiet workshop for the PDFs in your life. Built to do the job and get out of
            the way.
          </p>
        </div>

        <nav className="footer-nav" aria-label="Tools">
          <span className="footer-label">Tools</span>
          <ul>
            {toolLinks.map((tool) => (
              <li key={tool.path}>
                <Link to={tool.path}>{tool.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer-meta">
          <span className="footer-label">Colophon</span>
          <p>
            pdf-lib and pdf.js in the browser.
            <br />
            Ghostscript for compression.
            <br />
            qpdf and PKCS#7 for protection.
          </p>
          <a
            className="footer-source"
            href="https://github.com/sarvkk/pdfresizer"
            target="_blank"
            rel="noreferrer"
          >
            Source on GitHub <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Sheet</span>
        <span>No accounts · No uploads · No watermarks</span>
        <span>MIT licensed</span>
      </div>
    </footer>
  )
}
