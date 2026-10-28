import { useEffect } from 'react'

function setMeta(selector: string, content: string): void {
  const element = document.querySelector<HTMLMetaElement>(selector)
  if (element) element.content = content
}

export function usePageMeta(title: string, description?: string): void {
  useEffect(() => {
    document.title = title
    if (!description) return

    setMeta('meta[name="description"]', description)
    setMeta('meta[property="og:title"]', title)
    setMeta('meta[property="og:description"]', description)
    setMeta('meta[name="twitter:title"]', title)
    setMeta('meta[name="twitter:description"]', description)
  }, [title, description])
}
