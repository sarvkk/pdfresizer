import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'
import { usePageMeta } from '../hooks/usePageMeta'

export default function NotFound() {
  usePageMeta('Page not found — Sheet', 'That page is not part of the Sheet PDF workshop.')

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="tool-main not-found" id="main">
        <p className="eyebrow">Error 404</p>
        <h1>This page slipped off the stack.</h1>
        <p className="not-found-copy">
          The address may be wrong, or the tool may have moved. The workshop itself is still
          open.
        </p>
        <Link to="/" className="btn btn-primary">
          Back to the tools
          <Icon name="arrow" size={18} />
        </Link>
      </main>
      <SiteFooter />
    </div>
  )
}
