import { Link } from 'react-router-dom'
import Icon, { type IconName } from '../components/Icon'
import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'
import { usePageMeta } from '../hooks/usePageMeta'

interface Tool {
  path: string
  number: string
  title: string
  summary: string
  tag: string
  icon: IconName
}

const tools: Tool[] = [
  {
    path: '/compress',
    number: '01',
    title: 'Compress',
    summary: 'Reduce file size with Ghostscript, or use the private in-browser mode.',
    tag: 'Local API',
    icon: 'compress',
  },
  {
    path: '/resize',
    number: '02',
    title: 'Resize',
    summary: 'Give every page the same paper size, orientation, scale, and margin.',
    tag: 'On-device',
    icon: 'resize',
  },
  {
    path: '/merge',
    number: '03',
    title: 'Merge',
    summary: 'Combine documents in exactly the order you choose.',
    tag: 'On-device',
    icon: 'merge',
  },
  {
    path: '/split',
    number: '04',
    title: 'Split',
    summary: 'Pull out the pages you need by clicking or typing a range.',
    tag: 'On-device',
    icon: 'split',
  },
  {
    path: '/rotate',
    number: '05',
    title: 'Rotate',
    summary: 'Turn selected pages by 90°, 180°, or 270° in one pass.',
    tag: 'On-device',
    icon: 'rotate',
  },
  {
    path: '/reorder',
    number: '06',
    title: 'Reorder',
    summary: 'Move pages around like cards, then download the new sequence.',
    tag: 'On-device',
    icon: 'reorder',
  },
]

const method = [
  {
    number: '01',
    title: 'Choose a tool',
    copy: 'Pick the job. Every tool is a single page with no setup, no account, and no upload step.',
  },
  {
    number: '02',
    title: 'Bring your file',
    copy: 'Drop a PDF or browse for it. The file is read by your browser, not by a stranger’s server.',
  },
  {
    number: '03',
    title: 'Take it with you',
    copy: 'Adjust the settings, run the job, and download the result. Close the tab when you are done.',
  },
]

export default function Home() {
  usePageMeta(
    'Sheet — PDF workshop',
    'Six precise PDF tools: compress, resize, merge, split, rotate, and reorder. No accounts, no uploads, no watermarks.',
  )

  return (
    <div className="app-shell">
      <SiteHeader />

      <main className="home-main" id="main">
        <div className="home-wrap">
          <section className="hero">
            <div className="hero-copy">
              <p className="eyebrow">Sheet / PDF workshop</p>
              <h1>
                Paper in.
                <br />
                <em>Order</em> out.
              </h1>
              <p className="hero-lede">
                Six precise tools for the PDFs in your life. Compress, resize, merge, split,
                rotate, and reorder — without an account, a watermark, or a round trip to someone
                else&apos;s server.
              </p>

              <div className="hero-actions">
                <a className="btn btn-primary" href="#tools">
                  Browse the tools
                  <Icon name="arrow" size={18} />
                </a>
                <a className="btn btn-secondary" href="#how">
                  How it works
                </a>
              </div>

              <ul className="hero-notes">
                <li>
                  <Icon name="check" size={14} /> No sign-up
                </li>
                <li>
                  <Icon name="check" size={14} /> No watermarks
                </li>
                <li>
                  <Icon name="check" size={14} /> No cloud by default
                </li>
              </ul>
            </div>

            <div className="hero-art" aria-hidden="true">
              <span className="crop-mark crop-mark-tl" />
              <span className="crop-mark crop-mark-tr" />
              <span className="crop-mark crop-mark-bl" />
              <span className="crop-mark crop-mark-br" />

              <div className="paper-stack">
                <div className="paper paper-back">
                  <span className="paper-meta">PDF / 01—06</span>
                  <span className="paper-back-rule" />
                  <span className="paper-back-rule" />
                  <span className="paper-back-rule" />
                </div>
                <div className="paper paper-mid">
                  <span className="paper-meta">Sheet / workshop</span>
                  <span className="paper-mid-title">Handle with care.</span>
                </div>
                <div className="paper paper-front">
                  <div className="paper-head">
                    <span>Job ticket</span>
                    <span>№ 001</span>
                  </div>
                  <p className="paper-title">
                    One clean
                    <br />
                    <em>sheet.</em>
                  </p>
                  <span className="paper-rule" />
                  <ul className="paper-list">
                    {tools.map((tool) => (
                      <li key={tool.path}>
                        <span>{tool.title}</span>
                        <span>{tool.number}</span>
                      </li>
                    ))}
                  </ul>
                  <span className="paper-stamp">On device</span>
                </div>
              </div>
            </div>
          </section>

          <div className="service-strip" aria-hidden="true">
            {tools.map((tool, index) => (
              <span key={tool.path} className="service-item">
                {tool.title}
                {index < tools.length - 1 && <span className="service-sep">/</span>}
              </span>
            ))}
          </div>

          <section className="tools-section" id="tools" aria-labelledby="tools-title">
            <header className="section-head">
              <p className="eyebrow">Service ledger</p>
              <h2 id="tools-title">
                Six ways to <em>handle</em> a PDF.
              </h2>
              <p className="section-lede">
                Start with the job, not the software. Each tool opens with one file, a few honest
                settings, and a download at the end.
              </p>
            </header>

            <ol className="tool-list">
              {tools.map((tool) => (
                <li key={tool.path}>
                  <Link to={tool.path} className="tool-row">
                    <span className="tool-number">{tool.number}</span>
                    <span className="tool-icon">
                      <Icon name={tool.icon} size={22} />
                    </span>
                    <span className="tool-body">
                      <span className="tool-name">{tool.title}</span>
                      <span className="tool-summary">{tool.summary}</span>
                    </span>
                    <span className="tool-tag">{tool.tag}</span>
                    <span className="tool-arrow">
                      <Icon name="arrow" size={20} />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <section className="how-section" id="how" aria-labelledby="how-title">
            <header className="section-head section-head-split">
              <div>
                <p className="eyebrow">The method</p>
                <h2 id="how-title">
                  Drop. Adjust. <em>Download.</em>
                </h2>
              </div>
              <p className="section-lede">
                No onboarding, no file manager, no dashboard. The work is the interface.
              </p>
            </header>

            <ol className="how-grid">
              {method.map((step) => (
                <li key={step.number}>
                  <span className="how-num">{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className="privacy-band" aria-labelledby="privacy-title">
          <div className="home-wrap privacy-inner">
            <div className="privacy-heading">
              <p className="eyebrow">Privacy, by default</p>
              <h2 id="privacy-title">
                Your PDFs don&apos;t need a <em>round trip.</em>
              </h2>
            </div>
            <div className="privacy-copy">
              <p>
                Merge, split, resize, rotate, and reorder run entirely on your device with
                pdf-lib. Compression is the only job that may touch a server — and that server is
                the one on your own machine, running Ghostscript. Temp files are deleted after
                every request.
              </p>
              <Link to="/compress" className="text-link">
                See how compression works
                <Icon name="arrow" size={16} />
              </Link>
            </div>
            <ul className="privacy-facts">
              <li>
                <span>01</span> Browser-side editing
              </li>
              <li>
                <span>02</span> Optional local API
              </li>
              <li>
                <span>03</span> No tracking
              </li>
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
