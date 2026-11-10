import { buildPeriodReportHtml, reportFileName } from './periodReport'

/**
 * Print the period report through a hidden iframe (no popup, so mobile browsers do not
 * block it). The browser's print dialog offers "Save as PDF"; the page title is set to
 * the report name so it becomes the default file name.
 */
export function printPeriodReport(data, options = {}) {
  const html = buildPeriodReportHtml(data, options)
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'

  const originalTitle = document.title
  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    document.title = originalTitle
    frame.remove()
  }

  frame.onload = () => {
    const win = frame.contentWindow
    if (!win) { cleanup(); return }
    document.title = reportFileName(data.period)
    win.addEventListener('afterprint', cleanup)
    // Fallback for browsers that never fire afterprint.
    window.setTimeout(cleanup, 60_000)
    win.focus()
    win.print()
  }

  frame.srcdoc = html
  document.body.appendChild(frame)
}
