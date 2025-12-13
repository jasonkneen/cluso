/**
 * DevTools Entry Point
 *
 * Creates a DevTools panel for viewing React component hierarchy.
 */

chrome.devtools.panels.create(
  'Cluso',
  'icons/icon-16.png',
  'src/devtools/panel.html',
  (panel) => {
    console.log('[Cluso] DevTools panel created')
  }
)
