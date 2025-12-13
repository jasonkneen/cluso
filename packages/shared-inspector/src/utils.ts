/**
 * Inspector Utilities
 *
 * Utility functions for element inspection, XPath generation,
 * and element summary extraction.
 */

import type { SelectedElement, ReactComponentInfo } from '@ai-cluso/shared-types'

/**
 * Generate XPath for an element
 */
export function generateXPath(el: Element | null): string {
  if (!el) return ''
  if (el.id) return `//*[@id="${el.id}"]`

  const parts: string[] = []
  let current: Element | null = el

  while (current && current.nodeType === 1) {
    let idx = 1
    let sib = current.previousSibling

    while (sib) {
      if (sib.nodeType === 1 && (sib as Element).tagName === current.tagName) {
        idx++
      }
      sib = sib.previousSibling
    }

    parts.unshift(`${current.tagName.toLowerCase()}[${idx}]`)
    current = current.parentElement
  }

  return '/' + parts.join('/')
}

/**
 * Get computed styles for an element
 */
export function getComputedStyles(el: Element): SelectedElement['computedStyle'] {
  const styles = window.getComputedStyle(el)
  return {
    display: styles.display,
    position: styles.position,
    visibility: styles.visibility,
    color: styles.color,
    backgroundColor: styles.backgroundColor,
    fontSize: styles.fontSize,
  }
}

/**
 * Get all attributes of an element as a record
 */
export function getElementAttributes(el: Element): Record<string, string> {
  const attributes: Record<string, string> = {}
  Array.from(el.attributes || []).forEach((attr) => {
    attributes[attr.name] = attr.value
  })
  return attributes
}

/**
 * Get bounding rect of an element
 */
export function getElementRect(el: Element): SelectedElement['rect'] {
  const rect = el.getBoundingClientRect()
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }
}

/**
 * Extract basic element summary without React fiber info
 */
export function extractBasicElementSummary(el: Element): Partial<SelectedElement> {
  const htmlEl = el as HTMLElement
  return {
    tagName: el.tagName.toLowerCase(),
    id: el.id || undefined,
    className: el.className || undefined,
    text: htmlEl.innerText ? htmlEl.innerText.substring(0, 100) : undefined,
    xpath: generateXPath(el),
    attributes: getElementAttributes(el),
    computedStyle: getComputedStyles(el),
    rect: getElementRect(el),
  }
}

/**
 * Extract element summary with React context if available
 * This should be called from within the page context where React extraction scripts are injected
 */
export function extractElementSummary(el: Element): SelectedElement {
  const basicInfo = extractBasicElementSummary(el)

  // Type declarations for injected window functions
  interface WindowWithReactExtraction extends Window {
    extractReactContext?: (el: Element) => {
      hasFiber: boolean
      componentStack?: ReactComponentInfo[]
      xpath: string
      attributes: Record<string, string>
    }
    formatElementContext?: (el: Element) => string
    getRSCSourceForElement?: (el: Element) => {
      sources: Array<{ name: string; file: string; line: number; column: number }>
      summary: string
      componentStack: Array<{ name: string; file: string; line: number; column: number }>
      isRSC: boolean
      matched: boolean
    } | null
  }

  const win = window as WindowWithReactExtraction

  // Try to get React fiber info if available
  if (win.extractReactContext) {
    try {
      const reactContext = win.extractReactContext(el)

      if (reactContext.hasFiber && reactContext.componentStack?.length) {
        return {
          ...basicInfo,
          tagName: basicInfo.tagName!,
          componentStack: reactContext.componentStack || [],
          componentName: reactContext.componentStack?.[0]?.componentName || null,
          fileName: reactContext.componentStack?.[0]?.fileName || null,
          lineNumber: reactContext.componentStack?.[0]?.lineNumber || null,
          columnNumber: reactContext.componentStack?.[0]?.columnNumber || null,
          fullContext: win.formatElementContext ? win.formatElementContext(el) : null,
          xpath: reactContext.xpath,
          attributes: reactContext.attributes,
          hasFiber: true,
        }
      }
    } catch (e) {
      console.warn('[Inspector] Failed to extract React context:', e)
    }
  }

  // Fallback: Try RSC extraction for Server Components
  if (win.getRSCSourceForElement) {
    try {
      const rscSource = win.getRSCSourceForElement(el)
      if (rscSource && rscSource.sources?.length > 0) {
        return {
          ...basicInfo,
          tagName: basicInfo.tagName!,
          componentStack: rscSource.componentStack.map((c) => ({
            componentName: c.name,
            fileName: c.file,
            lineNumber: c.line,
            columnNumber: c.column,
          })),
          componentName: rscSource.sources[0]?.name || null,
          fileName: rscSource.sources[0]?.file || null,
          lineNumber: rscSource.sources[0]?.line || null,
          columnNumber: rscSource.sources[0]?.column || null,
          fullContext: rscSource.summary || null,
          hasFiber: false,
        }
      }
    } catch (e) {
      console.warn('[Inspector] Failed to extract RSC source:', e)
    }
  }

  return {
    ...basicInfo,
    tagName: basicInfo.tagName!,
  }
}

/**
 * Get elements that intersect with a rectangle
 */
export function getElementsInRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): Array<{ element: Element; rect: DOMRect }> {
  const left = Math.min(x1, x2)
  const top = Math.min(y1, y2)
  const right = Math.max(x1, x2)
  const bottom = Math.max(y1, y2)

  const selector =
    'button, a, input, textarea, select, img, video, h1, h2, h3, h4, h5, h6, p, span, div, section, article, nav, header, footer, form, label, li'
  const allElements = document.querySelectorAll(selector)
  const intersecting: Array<{ element: Element; rect: DOMRect }> = []

  allElements.forEach((el) => {
    const rect = el.getBoundingClientRect()
    // Check if element intersects with selection rectangle
    if (rect.left < right && rect.right > left && rect.top < bottom && rect.bottom > top) {
      // Skip if it's a parent of already-selected elements (prefer more specific)
      const dominated = intersecting.some((other) => el.contains(other.element))
      if (!dominated && rect.width > 5 && rect.height > 5) {
        intersecting.push({ element: el, rect })
      }
    }
  })

  return intersecting
}

/**
 * Create a number badge element for element numbering
 */
export function createNumberBadge(number: number): HTMLDivElement {
  const badge = document.createElement('div')
  badge.className = 'element-number-badge'
  badge.setAttribute('data-cluso-ui', '1')
  badge.setAttribute('aria-hidden', 'true')
  badge.textContent = String(number)
  return badge
}
