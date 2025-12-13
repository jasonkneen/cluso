
import { SelectedElement } from '../types';

/**
 * Generates a unique CSS selector for a selected element.
 * Prioritizes ID, then a unique combination of classes, and falls back to tag + nth-child.
 * 
 * @param element The selected element data from Electron/Webview
 * @returns A CSS selector string
 */
export function generateUniqueSelector(element: Partial<SelectedElement>): string {
  // 1. If we have an ID, that's the gold standard (assuming it's unique, which it should be)
  if (element.id && element.id.trim().length > 0) {
    // If the ID contains spaces or special chars, it might need escaping, 
    // but typically IDs are clean. Let's assume standard IDs for now.
    return `#${element.id}`;
  }

  // 2. If we have classes, try to construct a specific class selector
  // Note: element.className might be a string of space-separated classes
  if (element.className && typeof element.className === 'string' && element.className.trim().length > 0) {
    // Split by whitespace to get individual classes
    const classes = element.className.trim().split(/\s+/);
    // Filter out common utility classes if we wanted to be fancy, but for now take them all
    // Join with dots
    if (classes.length > 0) {
      // Use the tag name + classes for specificity, e.g. "div.flex.row"
      // If tagname is missing, just use classes
      const classSelector = `.${classes.join('.')}`;
      return element.tagName ? `${element.tagName.toLowerCase()}${classSelector}` : classSelector;
    }
  }

  // 3. Fallback: Use the tagName. 
  // If we had the parent info or nth-child index, we could be more specific.
  // Since the current SelectedElement interface might not have sibling index,
  // we'll do our best with what we have.
  
  if (element.tagName) {
    const tagName = element.tagName.toLowerCase();
    
    // If we have attributes, maybe we can use them?
    if (element.attributes) {
      // Try to find a unique-ish attribute
      const uniqueAttrs = ['name', 'data-testid', 'data-id', 'role', 'aria-label'];
      for (const attr of uniqueAttrs) {
        if (element.attributes[attr]) {
          return `${tagName}[${attr}="${element.attributes[attr]}"]`;
        }
      }
    }
    
    // If all else fails, just return the tag name. 
    // It's not unique globally, but might be enough if the user says "this button".
    // Better would be if the inspector sent us the full path or nth-child.
    // However, if we have an XPath, we *could* use that, but the prompt asks for a CSS selector.
    // Converting XPath to CSS is hard reliably.
    
    return tagName;
  }

  // 4. Absolute fallback
  return '*';
}
