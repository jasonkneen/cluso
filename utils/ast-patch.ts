/**
 * AST-Based Surgical Code Edits
 * 
 * Uses Babel to perform precise code transformations without LLM.
 * This is faster and more reliable than LLM-based patching for
 * well-defined edit types like className, style, and attribute changes.
 * 
 * PERFORMANCE: Typical edit takes 10-50ms vs 500ms-5s for LLM.
 */

import { parse, type ParserOptions } from '@babel/parser'
import traverse, { type NodePath } from '@babel/traverse'
import generate from '@babel/generator'
import * as t from '@babel/types'
import type { SelectedElement } from '../types'

// ============================================================================
// Types
// ============================================================================

export type AstEditType = 'className' | 'style' | 'text' | 'attribute' | 'booleanProp'

export interface AstPatchContext {
  sourceLine: number
  element: SelectedElement
}

export interface AstPatchResult {
  success: boolean
  code?: string
  durationMs: number
  error?: string
}

// ============================================================================
// Parser Configuration
// ============================================================================

const PARSER_OPTIONS: ParserOptions = {
  sourceType: 'module',
  plugins: [
    'jsx',
    'typescript',
    'decorators-legacy',
    'classProperties',
    'objectRestSpread',
  ],
  errorRecovery: true, // Don't throw on minor syntax issues
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a JSX element matches our target element based on line number and characteristics
 */
function isTargetElement(
  path: NodePath<t.JSXOpeningElement>,
  context: AstPatchContext
): boolean {
  const loc = path.node.loc
  if (!loc) return false

  // Check line number (allow some tolerance for multi-line elements)
  const lineTolerance = 10
  const lineMatch = Math.abs(loc.start.line - context.sourceLine) <= lineTolerance

  if (!lineMatch) return false

  // Check tag name if available
  const tagName = context.element.tagName?.toLowerCase()
  if (tagName) {
    const nodeName = t.isJSXIdentifier(path.node.name) 
      ? path.node.name.name.toLowerCase()
      : null
    if (nodeName && nodeName !== tagName && nodeName !== tagName.charAt(0).toUpperCase() + tagName.slice(1)) {
      // Allow case-insensitive match for HTML tags, and PascalCase for components
      return false
    }
  }

  // Check className if available
  const targetClassName = context.element.className?.split(' ')[0]
  if (targetClassName) {
    const classAttr = path.node.attributes.find(
      attr => t.isJSXAttribute(attr) && 
              t.isJSXIdentifier(attr.name) && 
              attr.name.name === 'className'
    )
    if (classAttr && t.isJSXAttribute(classAttr)) {
      if (t.isStringLiteral(classAttr.value)) {
        if (!classAttr.value.value.includes(targetClassName)) {
          return false
        }
      }
    }
  }

  // Check ID if available
  const targetId = context.element.id
  if (targetId) {
    const idAttr = path.node.attributes.find(
      attr => t.isJSXAttribute(attr) && 
              t.isJSXIdentifier(attr.name) && 
              attr.name.name === 'id'
    )
    if (idAttr && t.isJSXAttribute(idAttr)) {
      if (t.isStringLiteral(idAttr.value) && idAttr.value.value !== targetId) {
        return false
      }
    }
  }

  return true
}

/**
 * Find existing attribute by name
 */
function findAttribute(
  element: t.JSXOpeningElement,
  name: string
): t.JSXAttribute | undefined {
  return element.attributes.find(
    attr => t.isJSXAttribute(attr) && 
            t.isJSXIdentifier(attr.name) && 
            attr.name.name === name
  ) as t.JSXAttribute | undefined
}

// ============================================================================
// Edit Operations
// ============================================================================

/**
 * Patch className attribute
 */
function patchClassName(
  element: t.JSXOpeningElement,
  change: { add?: string[]; remove?: string[]; set?: string[] }
): boolean {
  const classAttr = findAttribute(element, 'className')

  const applyChange = (current: string[]): string[] => {
    if (change.set) return change.set
    let result = [...current]
    if (change.remove) {
      result = result.filter(c => !change.remove!.includes(c))
    }
    if (change.add) {
      for (const c of change.add) {
        if (!result.includes(c)) result.push(c)
      }
    }
    return result
  }

  if (classAttr) {
    if (t.isStringLiteral(classAttr.value)) {
      const current = classAttr.value.value.split(/\s+/).filter(Boolean)
      const next = applyChange(current)
      classAttr.value = t.stringLiteral(next.join(' '))
      return true
    }
    // Handle className={`...`} template literals
    if (t.isJSXExpressionContainer(classAttr.value) && 
        t.isTemplateLiteral(classAttr.value.expression)) {
      // For now, fall back to string if it's a simple template
      const quasi = classAttr.value.expression.quasis[0]?.value.raw
      if (quasi && classAttr.value.expression.quasis.length === 1) {
        const current = quasi.split(/\s+/).filter(Boolean)
        const next = applyChange(current)
        classAttr.value = t.stringLiteral(next.join(' '))
        return true
      }
    }
  } else if (change.add || change.set) {
    // Add new className attribute
    const classes = change.set || change.add || []
    element.attributes.push(
      t.jsxAttribute(
        t.jsxIdentifier('className'),
        t.stringLiteral(classes.join(' '))
      )
    )
    return true
  }

  return false
}

/**
 * Patch style prop
 */
function patchStyle(
  element: t.JSXOpeningElement,
  cssChanges: Record<string, string>
): boolean {
  const styleAttr = findAttribute(element, 'style')

  // Convert CSS property names to camelCase
  const normalizedChanges: Record<string, string> = {}
  for (const [prop, val] of Object.entries(cssChanges)) {
    const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    normalizedChanges[camelProp] = val
  }

  if (styleAttr && t.isJSXExpressionContainer(styleAttr.value)) {
    const expr = styleAttr.value.expression
    if (t.isObjectExpression(expr)) {
      // Merge into existing style object
      for (const [prop, val] of Object.entries(normalizedChanges)) {
        const existing = expr.properties.find(
          p => t.isObjectProperty(p) && 
               t.isIdentifier(p.key) && 
               p.key.name === prop
        )
        if (existing && t.isObjectProperty(existing)) {
          existing.value = t.stringLiteral(val)
        } else {
          expr.properties.push(
            t.objectProperty(t.identifier(prop), t.stringLiteral(val))
          )
        }
      }
      return true
    }
  } else {
    // Create new style prop
    const properties = Object.entries(normalizedChanges).map(([prop, val]) =>
      t.objectProperty(t.identifier(prop), t.stringLiteral(val))
    )
    element.attributes.push(
      t.jsxAttribute(
        t.jsxIdentifier('style'),
        t.jsxExpressionContainer(t.objectExpression(properties))
      )
    )
    return true
  }

  return false
}

/**
 * Patch a generic attribute
 */
function patchAttribute(
  element: t.JSXOpeningElement,
  attrName: string,
  newValue: string
): boolean {
  const attr = findAttribute(element, attrName)

  if (attr) {
    attr.value = t.stringLiteral(newValue)
    return true
  } else {
    element.attributes.push(
      t.jsxAttribute(t.jsxIdentifier(attrName), t.stringLiteral(newValue))
    )
    return true
  }
}

/**
 * Toggle boolean prop (disabled, hidden, etc.)
 */
function patchBooleanProp(
  element: t.JSXOpeningElement,
  propName: string,
  shouldBePresent: boolean
): boolean {
  const existingIndex = element.attributes.findIndex(
    attr => t.isJSXAttribute(attr) && 
            t.isJSXIdentifier(attr.name) && 
            attr.name.name === propName
  )

  if (shouldBePresent && existingIndex === -1) {
    // Add the prop (as a bare attribute, e.g., <input disabled />)
    element.attributes.push(
      t.jsxAttribute(t.jsxIdentifier(propName), null)
    )
    return true
  } else if (!shouldBePresent && existingIndex !== -1) {
    // Remove the prop
    element.attributes.splice(existingIndex, 1)
    return true
  }

  return false
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Try AST-based patching for supported edit types
 * 
 * @param content - Original file content
 * @param editType - Type of edit to perform
 * @param change - Edit-specific change data
 * @param context - Element targeting context
 * @returns Patched code or null if AST patch failed
 */
export function tryAstPatch(
  content: string,
  editType: AstEditType,
  change: Record<string, unknown>,
  context: AstPatchContext
): AstPatchResult {
  const startTime = performance.now()

  try {
    // Parse the code
    const ast = parse(content, PARSER_OPTIONS)

    let modified = false

    // Traverse and find target element
    traverse(ast, {
      JSXOpeningElement(path) {
        if (modified) return // Already found and modified
        if (!isTargetElement(path, context)) return

        switch (editType) {
          case 'className': {
            const classChange = change as { add?: string[]; remove?: string[]; set?: string[] }
            modified = patchClassName(path.node, classChange)
            break
          }
          case 'style': {
            const styleChange = change as Record<string, string>
            modified = patchStyle(path.node, styleChange)
            break
          }
          case 'attribute': {
            const attrName = change.name as string
            const attrValue = change.value as string
            if (attrName && attrValue !== undefined) {
              modified = patchAttribute(path.node, attrName, attrValue)
            }
            break
          }
          case 'booleanProp': {
            const propName = change.name as string
            const shouldBePresent = change.present as boolean
            if (propName !== undefined && shouldBePresent !== undefined) {
              modified = patchBooleanProp(path.node, propName, shouldBePresent)
            }
            break
          }
          case 'text': {
            // Text changes are handled separately (JSXText nodes)
            break
          }
        }

        if (modified) {
          path.stop() // Stop traversal
        }
      },
    })

    const durationMs = performance.now() - startTime

    if (!modified) {
      return {
        success: false,
        durationMs,
        error: 'Target element not found or change not applicable',
      }
    }

    // Generate code from modified AST
    const output = generate(ast, {
      retainLines: true,
      retainFunctionParens: true,
      comments: true,
    })

    console.log(`[AST Patch] SUCCESS in ${durationMs.toFixed(1)}ms`)

    return {
      success: true,
      code: output.code,
      durationMs,
    }
  } catch (err) {
    const durationMs = performance.now() - startTime
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.warn(`[AST Patch] Failed in ${durationMs.toFixed(1)}ms:`, errorMessage)

    return {
      success: false,
      durationMs,
      error: errorMessage,
    }
  }
}

/**
 * Detect the appropriate AST edit type from user request and change data
 */
export function detectAstEditType(
  cssChanges: Record<string, string>,
  userRequest?: string
): { type: AstEditType; change: Record<string, unknown> } | null {
  // CSS changes -> style edit
  if (Object.keys(cssChanges).length > 0) {
    return { type: 'style', change: cssChanges }
  }

  if (!userRequest) return null

  // className changes
  const classAddMatch = userRequest.match(/(?:add|append)\s+class(?:es)?\s+(.+)/i)
  if (classAddMatch) {
    const classes = classAddMatch[1].split(/[\s,]+/).filter(Boolean)
    return { type: 'className', change: { add: classes } }
  }

  const classRemoveMatch = userRequest.match(/(?:remove|delete)\s+class(?:es)?\s+(.+)/i)
  if (classRemoveMatch) {
    const classes = classRemoveMatch[1].split(/[\s,]+/).filter(Boolean)
    return { type: 'className', change: { remove: classes } }
  }

  const classSetMatch = userRequest.match(/(?:set|change)\s+class(?:name)?\s+to\s+(.+)/i)
  if (classSetMatch) {
    const classes = classSetMatch[1].split(/[\s,]+/).filter(Boolean)
    return { type: 'className', change: { set: classes } }
  }

  // Boolean props
  const boolMatch = userRequest.match(/(?:add|remove|toggle)\s+(disabled|hidden|checked|readonly|required|autoFocus)/i)
  if (boolMatch) {
    const propName = boolMatch[1]
    const shouldBePresent = !/remove/i.test(userRequest)
    return { type: 'booleanProp', change: { name: propName, present: shouldBePresent } }
  }

  // Attribute changes
  const attrMatch = userRequest.match(/(?:change|set|update)\s+(href|alt|title|placeholder|name)\s+to\s+["']?([^"'\n]+)["']?/i)
  if (attrMatch) {
    return { type: 'attribute', change: { name: attrMatch[1], value: attrMatch[2].trim() } }
  }

  return null
}
