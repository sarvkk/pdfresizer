import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import SiteFooter from './components/SiteFooter'
import SiteHeader from './components/SiteHeader'
import Home from './pages/Home'
import NotFound from './pages/NotFound'

const Compress = lazy(() => import('./pages/Compress'))
const Resize = lazy(() => import('./pages/Resize'))
const Merge = lazy(() => import('./pages/Merge'))
const Split = lazy(() => import('./pages/Split'))
const Rotate = lazy(() => import('./pages/Rotate'))
const Reorder = lazy(() => import('./pages/Reorder'))

function RouteFallback() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="tool-main" id="main">
        <div className="route-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          <p>Opening the workshop…</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/compress" element={<Compress />} />
          <Route path="/resize" element={<Resize />} />
          <Route path="/merge" element={<Merge />} />
          <Route path="/split" element={<Split />} />
          <Route path="/rotate" element={<Rotate />} />
          <Route path="/reorder" element={<Reorder />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  )
}
