/**
 * React Fiber Extraction Scripts
 *
 * Based on bippy's approach to extracting React component info.
 * These scripts are designed to be injected into webviews/iframes
 * to extract rich component context including file paths, line numbers,
 * and component hierarchies.
 *
 * @see https://github.com/aidenybai/bippy
 */

import type { ReactComponentInfo } from '@ai-cluso/shared-types'

export { ReactComponentInfo }

/**
 * Element context extracted from React fiber
 */
export interface ElementContext {
  html: string
  componentStack: ReactComponentInfo[]
  tagName: string
  attributes: Record<string, string>
  text: string
  xpath: string
  hasFiber: boolean
}

/**
 * The script to inject that extracts React fiber info.
 * This is a self-contained version of bippy's extraction logic.
 */
export const REACT_FIBER_EXTRACTION_SCRIPT = `
// React Fiber Extraction - based on bippy patterns
(function() {
  // Skip if already initialized
  if (window.__reactFiberExtraction) return;
  window.__reactFiberExtraction = true;

  // React work tags for component identification
  const FunctionComponentTag = 0;
  const ClassComponentTag = 1;
  const HostComponentTag = 5;
  const ForwardRefTag = 11;
  const MemoComponentTag = 14;
  const SimpleMemoComponentTag = 15;

  // Internal Next.js component names to skip
  const INTERNAL_COMPONENT_NAMES = new Set([
    'InnerLayoutRouter', 'RedirectErrorBoundary', 'RedirectBoundary',
    'HTTPAccessFallbackErrorBoundary', 'HTTPAccessFallbackBoundary',
    'LoadingBoundary', 'ErrorBoundary', 'InnerScrollAndFocusHandler',
    'ScrollAndFocusHandler', 'RenderFromTemplateContext', 'OuterLayoutRouter',
    'body', 'html', 'DevRootHTTPAccessFallbackBoundary',
    'AppDevOverlayErrorBoundary', 'AppDevOverlay', 'HotReload', 'Router',
    'ErrorBoundaryHandler', 'AppRouter', 'ServerRoot', 'SegmentStateProvider',
    'RootErrorBoundary', 'LoadableComponent', 'MotionDOMComponent'
  ]);

  function getFiberFromElement(element) {
    if (!element || typeof element !== 'object') return null;
    for (const key in element) {
      if (key.startsWith('__reactFiber$') ||
          key.startsWith('__reactInternalInstance$') ||
          key.startsWith('__reactContainer$')) {
        return element[key] || null;
      }
    }
    if ('_reactRootContainer' in element) {
      return element._reactRootContainer?._internalRoot?.current?.child;
    }
    return null;
  }

  function getDisplayName(type) {
    if (!type) return null;
    if (typeof type === 'string') return type;
    if (typeof type === 'function') {
      return type.displayName || type.name || null;
    }
    if (typeof type === 'object') {
      if (type.displayName) return type.displayName;
      if (type.type) return getDisplayName(type.type);
      if (type.render) return getDisplayName(type.render);
    }
    return null;
  }

  function isUserComponent(name) {
    if (!name) return false;
    if (name.startsWith('_')) return false;
    if (INTERNAL_COMPONENT_NAMES.has(name)) return false;
    if (!name[0] || name[0] !== name[0].toUpperCase()) return false;
    if (name.startsWith('Primitive.')) return false;
    if (name.includes('Provider') && name.includes('Context')) return false;
    return true;
  }

  function isCompositeFiber(fiber) {
    const tag = fiber.tag;
    return tag === FunctionComponentTag ||
           tag === ClassComponentTag ||
           tag === ForwardRefTag ||
           tag === MemoComponentTag ||
           tag === SimpleMemoComponentTag;
  }

  function normalizeFileName(fileName) {
    if (!fileName) return '';
    let normalized = fileName;
    const prefixes = [
      'webpack-internal:///',
      'webpack://',
      'file:///',
      'http://localhost:3000/',
      'http://localhost:5173/',
      'rsc://React/Server/',
      '/_next/static/',
    ];
    for (const prefix of prefixes) {
      if (normalized.startsWith(prefix)) {
        normalized = normalized.slice(prefix.length);
      }
    }
    const queryIndex = normalized.indexOf('?');
    if (queryIndex !== -1) {
      normalized = normalized.slice(0, queryIndex);
    }
    normalized = normalized.replace(/^\\/+/, '/');
    return normalized;
  }

  function isSourceFile(fileName) {
    if (!fileName) return false;
    const normalized = normalizeFileName(fileName);
    if (!normalized) return false;
    if (normalized.includes('node_modules')) return false;
    if (normalized.includes('webpack/') || normalized.includes('.vite/')) return false;
    if (!/\\.(jsx?|tsx?|vue|svelte)$/i.test(normalized)) return false;
    return true;
  }

  function getDebugSource(fiber) {
    const debugSource = fiber._debugSource;
    if (!debugSource) return null;
    if (typeof debugSource !== 'object') return null;
    return {
      fileName: debugSource.fileName || null,
      lineNumber: debugSource.lineNumber || null,
      columnNumber: debugSource.columnNumber || null
    };
  }

  function parseDebugStack(stack) {
    if (!stack || typeof stack !== 'string') return [];
    const frames = [];
    const lines = stack.split('\\n');
    for (const line of lines) {
      const match = line.match(/at\\s+([\\w$<>]+)?\\s*\\(?([^)]+):(\\d+):(\\d+)\\)?/);
      if (match) {
        frames.push({
          functionName: match[1] || null,
          fileName: match[2],
          lineNumber: parseInt(match[3], 10),
          columnNumber: parseInt(match[4], 10)
        });
      }
    }
    return frames;
  }

  function getComponentStack(fiber, maxDepth = 10) {
    const stack = [];
    let current = fiber;
    let depth = 0;
    while (current && depth < maxDepth) {
      if (isCompositeFiber(current)) {
        const name = getDisplayName(current.type);
        if (name && isUserComponent(name)) {
          const info = {
            componentName: name,
            fileName: null,
            lineNumber: null,
            columnNumber: null
          };
          const debugSource = getDebugSource(current);
          if (debugSource && isSourceFile(debugSource.fileName)) {
            info.fileName = normalizeFileName(debugSource.fileName);
            info.lineNumber = debugSource.lineNumber;
            info.columnNumber = debugSource.columnNumber;
          }
          if (!info.fileName && current._debugStack) {
            const stackError = current._debugStack;
            if (stackError instanceof Error && stackError.stack) {
              const frames = parseDebugStack(stackError.stack);
              for (const frame of frames) {
                if (isSourceFile(frame.fileName)) {
                  info.fileName = normalizeFileName(frame.fileName);
                  info.lineNumber = frame.lineNumber;
                  info.columnNumber = frame.columnNumber;
                  break;
                }
              }
            }
          }
          if (!info.fileName && current._debugOwner) {
            const ownerSource = getDebugSource(current._debugOwner);
            if (ownerSource && isSourceFile(ownerSource.fileName)) {
              info.fileName = normalizeFileName(ownerSource.fileName);
              info.lineNumber = ownerSource.lineNumber;
              info.columnNumber = ownerSource.columnNumber;
            }
          }
          stack.push(info);
        }
      }
      current = current.return;
      depth++;
    }
    return stack;
  }

  function getHTMLPreview(element, maxLength = 200) {
    const tagName = element.tagName.toLowerCase();
    let attrsText = '';
    const attrs = Array.from(element.attributes || []);
    for (const attr of attrs) {
      let value = attr.value;
      if (value.length > 30) {
        value = value.slice(0, 30) + '...';
      }
      attrsText += ' ' + attr.name + '="' + value + '"';
    }
    const text = (element.innerText || element.textContent || '').trim();
    const truncatedText = text.length > 100 ? text.slice(0, 100) + '...' : text;
    if (truncatedText) {
      return '<' + tagName + attrsText + '>\\n  ' + truncatedText + '\\n</' + tagName + '>';
    }
    return '<' + tagName + attrsText + ' />';
  }

  function getXPath(el) {
    if (!el) return '';
    if (el.id) return '//*[@id="' + el.id + '"]';
    const parts = [];
    while (el && el.nodeType === 1) {
      let idx = 1;
      for (let sib = el.previousSibling; sib; sib = sib.previousSibling) {
        if (sib.nodeType === 1 && sib.tagName === el.tagName) idx++;
      }
      parts.unshift(el.tagName.toLowerCase() + '[' + idx + ']');
      el = el.parentNode;
    }
    return '/' + parts.join('/');
  }

  window.extractReactContext = function(element) {
    const fiber = getFiberFromElement(element);
    const componentStack = fiber ? getComponentStack(fiber) : [];
    const attributes = {};
    Array.from(element.attributes || []).forEach(attr => {
      attributes[attr.name] = attr.value;
    });
    return {
      html: getHTMLPreview(element),
      componentStack: componentStack,
      tagName: element.tagName.toLowerCase(),
      attributes: attributes,
      text: (element.innerText || element.textContent || '').trim().slice(0, 500),
      xpath: getXPath(element),
      hasFiber: !!fiber
    };
  };

  window.getNearestComponentName = function(element) {
    const fiber = getFiberFromElement(element);
    if (!fiber) return null;
    let current = fiber;
    while (current) {
      if (isCompositeFiber(current)) {
        const name = getDisplayName(current.type);
        if (name && isUserComponent(name)) {
          return name;
        }
      }
      current = current.return;
    }
    return null;
  };

  window.formatElementContext = function(element) {
    const context = window.extractReactContext(element);
    let output = context.html;
    for (const frame of context.componentStack) {
      output += '\\n  in ' + (frame.componentName || '<anonymous>');
      if (frame.fileName) {
        output += ' (at ' + frame.fileName;
        if (frame.lineNumber) {
          output += ':' + frame.lineNumber;
          if (frame.columnNumber) {
            output += ':' + frame.columnNumber;
          }
        }
        output += ')';
      }
    }
    return output;
  };

  console.log('[ReactFiberExtraction] Initialized');
})();
`

/**
 * RSC (React Server Components) Payload Extraction Script
 * For Next.js 13+ apps with App Router that use Server Components
 */
export const RSC_EXTRACTION_SCRIPT = `
(function() {
  if (window.__rscExtraction) return;
  window.__rscExtraction = true;

  window.extractRSCComponents = function() {
    const components = [];
    const prefixes = [
      'webpack-internal:///(rsc)/',
      'webpack-internal:///(ssr)/',
      'webpack-internal:///(app-pages-browser)/',
      'webpack://',
      'rsc://React/Server/',
    ];

    function normalizeFilePath(filePath) {
      let normalized = filePath;
      for (const prefix of prefixes) {
        if (normalized.startsWith(prefix)) {
          normalized = normalized.slice(prefix.length);
        }
      }
      const queryIndex = normalized.indexOf('?');
      if (queryIndex !== -1) {
        normalized = normalized.slice(0, queryIndex);
      }
      return normalized;
    }

    const componentRegex = /\\[\\[?\\"([A-Z][a-zA-Z0-9_]*)\\",\\"([^"]+)\\",(\\d+),(\\d+)/g;

    if (window.__next_f && Array.isArray(window.__next_f)) {
      for (const entry of window.__next_f) {
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const payload = entry[1];
        if (typeof payload !== 'string') continue;
        let match;
        while ((match = componentRegex.exec(payload)) !== null) {
          const [, componentName, filePath, line, col] = match;
          if (componentName.startsWith('_') ||
              componentName === 'html' ||
              componentName === 'body' ||
              filePath.includes('node_modules')) {
            continue;
          }
          components.push({
            name: componentName,
            file: normalizeFilePath(filePath),
            line: parseInt(line, 10),
            column: parseInt(col, 10)
          });
        }
      }
    }

    if (components.length === 0) {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const text = script.textContent || '';
        if (!text.includes('__next_f.push')) continue;
        let match;
        while ((match = componentRegex.exec(text)) !== null) {
          const [, componentName, filePath, line, col] = match;
          if (componentName.startsWith('_') ||
              componentName === 'html' ||
              componentName === 'body' ||
              filePath.includes('node_modules')) {
            continue;
          }
          components.push({
            name: componentName,
            file: normalizeFilePath(filePath),
            line: parseInt(line, 10),
            column: parseInt(col, 10)
          });
        }
      }
    }

    return components;
  };

  window.getRSCSourceForElement = function(element) {
    const rscComponents = window.extractRSCComponents();
    if (rscComponents.length === 0) return null;

    let matchedComponent = null;
    let current = element;
    let depth = 0;

    while (current && depth < 10 && !matchedComponent) {
      const attrs = Array.from(current.attributes || []);
      for (const attr of attrs) {
        if (attr.name.startsWith('data-') && attr.value) {
          const attrValue = attr.value.toLowerCase();
          for (const comp of rscComponents) {
            const compNameLower = comp.name.toLowerCase();
            if (attrValue.includes(compNameLower) ||
                attr.name.toLowerCase().includes(compNameLower)) {
              matchedComponent = comp;
              break;
            }
          }
          if (matchedComponent) break;
        }
      }

      if (!matchedComponent) {
        const classNames = typeof current.className === 'string'
          ? current.className.split(/\\s+/)
          : [];
        for (const cls of classNames) {
          const potentialName = cls
            .split('-')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join('');
          for (const comp of rscComponents) {
            if (comp.name === potentialName ||
                comp.name.toLowerCase() === cls.toLowerCase()) {
              matchedComponent = comp;
              break;
            }
          }
          if (matchedComponent) break;
        }
      }

      current = current.parentElement;
      depth++;
    }

    if (!matchedComponent && rscComponents.length > 0) {
      const userComponents = rscComponents.filter(c =>
        !c.name.startsWith('_') &&
        c.file &&
        c.file.includes('/') &&
        !c.file.includes('node_modules')
      );

      if (userComponents.length > 0) {
        const seen = new Set();
        const uniqueComponents = [];
        for (const comp of userComponents) {
          if (!seen.has(comp.name)) {
            seen.add(comp.name);
            uniqueComponents.push(comp);
          }
        }

        return {
          sources: uniqueComponents.slice(0, 5),
          summary: uniqueComponents[0].file + ':' + uniqueComponents[0].line,
          componentStack: uniqueComponents.slice(0, 5),
          isRSC: true,
          matched: false
        };
      }
    }

    if (matchedComponent) {
      return {
        sources: [matchedComponent],
        summary: matchedComponent.file + ':' + matchedComponent.line,
        componentStack: [matchedComponent],
        isRSC: true,
        matched: true
      };
    }

    return null;
  };

  console.log('[RSCExtraction] Initialized');
})();
`
