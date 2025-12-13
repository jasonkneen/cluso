import React, { useMemo, useState } from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  BoxSelect,
  Columns,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Grid3X3,
  LayoutTemplate,
  Minus,
  Plus,
  RotateCcw,
  ChevronDown,
  X,
} from 'lucide-react'
import type { ElementStyles } from '../types/elementStyles'
import { Textarea } from './ui/textarea'
import { CodeBlock, CodeBlockCopyButton } from '@/components/ai-elements/code-block'
import type { BundledLanguage } from 'shiki'

interface PropertiesPanelProps {
  styles: ElementStyles
  onChange: (key: keyof ElementStyles, value: ElementStyles[keyof ElementStyles]) => void
  isDarkMode: boolean
  panelBg: string
  panelBorder: string
  embedded?: boolean
  selectedElementName?: string | null
  selectedElementNumber?: number | null
  computedStyles?: Record<string, string> | null
  attributes?: Record<string, string> | null
  dataset?: Record<string, string> | null
  fontFamilies?: string[] | null
  projectPath?: string | null
  classNames?: string[] | null
  sourceSnippet?: {
    filePath: string
    displayPath: string
    startLine: number
    focusLine: number
    language: string
    code: string
  } | null
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  styles,
  onChange,
  isDarkMode,
  panelBg,
  panelBorder,
  embedded = false,
  selectedElementName,
  selectedElementNumber,
  computedStyles,
  attributes,
  dataset,
  fontFamilies,
  projectPath,
  classNames,
  sourceSnippet,
}) => {
  const [activeTab, setActiveTab] = useState<'design' | 'css' | 'tailwind' | 'code'>('design')
  const hasSelection = !!selectedElementNumber
  const [cssFilter, setCssFilter] = useState('')
  const [cssAddOpen, setCssAddOpen] = useState(false)
  const [cssAddProp, setCssAddProp] = useState('')
  const [cssAddValue, setCssAddValue] = useState('')
  const [attrAddKey, setAttrAddKey] = useState('')
  const [attrAddValue, setAttrAddValue] = useState('')
  const [dataAddKey, setDataAddKey] = useState('')
  const [dataAddValue, setDataAddValue] = useState('')
  const [twAdd, setTwAdd] = useState('')
  const [twSuggestIndex, setTwSuggestIndex] = useState(0)
  const [twSuggestOpen, setTwSuggestOpen] = useState(false)
  const captionClass = 'text-[9px] text-neutral-500 font-semibold uppercase tracking-wide mb-1.5'

  const codeLanguage = useMemo((): BundledLanguage => {
    const lang = (sourceSnippet?.language || '').toLowerCase().trim()
    const map: Record<string, BundledLanguage> = {
      tsx: 'tsx',
      jsx: 'jsx',
      ts: 'typescript',
      typescript: 'typescript',
      js: 'javascript',
      javascript: 'javascript',
      html: 'html',
      css: 'css',
      json: 'json',
      md: 'markdown',
      markdown: 'markdown',
    }
    return map[lang] || 'tsx'
  }, [sourceSnippet?.language])

  const cssContent = useMemo(() => {
    const transform = `translate(${styles.x}px, ${styles.y}px) rotate(${styles.rotation}deg) scale(${styles.scaleX}, ${styles.scaleY})`
    const boxShadow = styles.shadowEnabled && styles.shadowVisible
      ? `${styles.shadowType === 'inner' ? 'inset ' : ''}${styles.shadowX}px ${styles.shadowY}px ${styles.shadowBlur}px ${styles.shadowSpread}px ${styles.shadowColor}`
      : 'none'
    const filter =
      styles.blurEnabled && styles.blurVisible && styles.blurType === 'layer' && styles.blur > 0 ? `blur(${styles.blur}px)` : 'none'
    const backdropFilter =
      styles.blurEnabled && styles.blurVisible && styles.blurType === 'backdrop' && styles.blur > 0 ? `blur(${styles.blur}px)` : 'none'
    const overrides = Object.keys(styles.cssOverrides || {}).length
      ? `\n  /* Overrides */\n${Object.entries(styles.cssOverrides || {})
          .map(([k, v]) => `  ${k}: ${v};`)
          .join('\n')}\n`
      : ''
    return `
.element {
  /* Tailwind / classes */
  /* className: ${styles.className} */

  /* Position */
  position: relative;
  width: ${styles.width}px;
  height: ${styles.height}px;
  transform: ${transform};

  /* Layout */
  display: ${styles.display};
  ${styles.display === 'flex' ? `flex-direction: ${styles.flexDirection};` : ''}
  ${styles.display === 'flex' ? `justify-content: ${styles.justifyContent};` : ''}
  ${styles.display === 'flex' ? `align-items: ${styles.alignItems};` : ''}
  gap: ${styles.gap}px;
  padding: ${styles.padding}px;
  overflow: ${styles.overflow};
  box-sizing: ${styles.boxSizing};

  /* Appearance */
  background-color: ${styles.backgroundColor};
  color: ${styles.color};
  font-family: ${styles.fontFamily};
  font-size: ${styles.fontSize}px;
  font-weight: ${styles.fontWeight};
  line-height: ${styles.lineHeight ? `${styles.lineHeight}px` : 'normal'};
  letter-spacing: ${styles.letterSpacing ? `${styles.letterSpacing}px` : 'normal'};
  text-align: ${styles.textAlign};
  opacity: ${styles.opacity / 100};
  border: ${styles.borderWidth}px ${styles.borderStyle} ${styles.borderColor};
  border-radius: ${styles.borderRadius}px;
  box-shadow: ${boxShadow};
  filter: ${filter};${overrides}
  backdrop-filter: ${backdropFilter};
}
`.trim()
  }, [styles])

  const handleNumber = (key: keyof ElementStyles) => (value: number) => {
    onChange(key, value as ElementStyles[keyof ElementStyles])
  }

  const handleText = (key: keyof ElementStyles) => (value: string) => {
    onChange(key, value as ElementStyles[keyof ElementStyles])
  }

  const handleBool = (key: keyof ElementStyles) => (value: boolean) => {
    onChange(key, value as ElementStyles[keyof ElementStyles])
  }

  const cssEntries = useMemo(() => {
    const base = computedStyles || {}
    const overrides = styles.cssOverrides || {}
    const q = cssFilter.trim().toLowerCase()
    const keys = Object.keys(base)
    keys.sort((a, b) => a.localeCompare(b))
    return keys
      .filter((k) => {
        if (!q) return true
        const v = overrides[k] ?? base[k] ?? ''
        return k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q)
      })
      .map((k) => ({
        prop: k,
        value: String(overrides[k] ?? base[k] ?? '').trim(),
        computed: String(base[k] ?? '').trim(),
        overridden: Object.prototype.hasOwnProperty.call(overrides, k),
      }))
  }, [computedStyles, styles.cssOverrides, cssFilter])

  const setCssOverride = (prop: string, value: string) => {
    const next = { ...(styles.cssOverrides || {}) }
    const v = value.trim()
    if (!v) delete next[prop]
    else next[prop] = v
    onChange('cssOverrides', next)
  }

  const setAttrOverride = (key: string, value: string) => {
    const next = { ...(styles.attributeOverrides || {}) }
    if (value === '') delete next[key]
    else next[key] = value
    onChange('attributeOverrides', next)
  }

  const setDatasetOverride = (key: string, value: string) => {
    const next = { ...(styles.datasetOverrides || {}) }
    if (value === '') delete next[key]
    else next[key] = value
    onChange('datasetOverrides', next)
  }

  const addClassToken = (token: string) => {
    const t = token.trim()
    if (!t) return
    const next = Array.from(
      new Set(
        styles.className
          .split(/\s+/)
          .map((x) => x.trim())
          .filter(Boolean)
          .concat([t]),
      ),
    ).join(' ')
    onChange('className', next)
    setTwAdd('')
    setTwSuggestOpen(false)
    setTwSuggestIndex(0)
  }

  const removeClassToken = (token: string) => {
    const t = token.trim()
    const next = styles.className
      .split(/\s+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((x) => x !== t)
      .join(' ')
    onChange('className', next)
  }

  const twSuggestions = useMemo(() => {
    const q = twAdd.trim()
    if (!q) return []
    const existing = new Set(styles.className.split(/\s+/).map((x) => x.trim()).filter(Boolean))

    const fromPage = (classNames || [])
      .map((c) => c.trim())
      .filter(Boolean)
      .filter((c) => c.startsWith(q))
      .filter((c) => !existing.has(c))
      .slice(0, 12)
      .map((v) => ({ value: v, source: 'page' as const }))

    const fromTw = getTailwindSuggestions(q, 12)
      .filter((c) => !existing.has(c))
      .slice(0, 12)
      .map((v) => ({ value: v, source: 'tw' as const }))

    // Prefer page classes if it looks like a custom token (no dash)
    const looksCustom = !q.includes('-') && !q.includes(':') && !q.startsWith('bg-') && !q.startsWith('text-') && !q.startsWith('border-')
    const merged = looksCustom ? [...fromPage, ...fromTw] : [...fromTw, ...fromPage]

    const seen = new Set<string>()
    const out: Array<{ value: string; source: 'page' | 'tw' }> = []
    for (const s of merged) {
      if (seen.has(s.value)) continue
      seen.add(s.value)
      out.push(s)
      if (out.length >= 10) break
    }
    return out
  }, [twAdd, styles.className, classNames])

  return (
    <div
      className={[
        'flex flex-col h-full',
        embedded ? '' : 'border rounded-xl overflow-hidden',
      ].join(' ')}
      style={embedded ? undefined : { backgroundColor: panelBg, borderColor: panelBorder }}
    >
      {/* Tab Header */}
      <div className="h-12 border-b flex items-center px-3" style={{ borderColor: panelBorder }}>
        <div
          className={[
            'flex items-center p-1 rounded-md border flex-1',
            isDarkMode ? 'bg-neutral-900' : 'bg-stone-100',
          ].join(' ')}
          style={{ borderColor: panelBorder }}
        >
          {(['Design', 'CSS', 'Tailwind', 'Code'] as const).map((tab) => {
            const tabKey = tab.toLowerCase() as 'design' | 'css' | 'tailwind' | 'code'
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tabKey)}
                className={[
                  'flex-1 py-1 text-xs font-medium rounded-sm transition-all',
                  activeTab === tabKey
                    ? isDarkMode
                      ? 'bg-neutral-700 text-white shadow-sm'
                      : 'bg-white text-stone-900 shadow-sm'
                    : isDarkMode
                      ? 'text-neutral-500 hover:text-neutral-300'
                      : 'text-stone-500 hover:text-stone-700',
                ].join(' ')}
              >
                {tab}
              </button>
            )
          })}
        </div>
      </div>

      {!hasSelection ? (
        <div className={`flex-1 p-3 text-sm ${isDarkMode ? 'text-neutral-500' : 'text-stone-500'}`}>
          Select an element in Layers to edit its properties.
        </div>
      ) : activeTab === 'code' ? (
        <div className="flex-1 overflow-y-auto p-3">
          <div className={captionClass}>Selected Element Source</div>
          {!sourceSnippet ? (
            <div className={`text-sm ${isDarkMode ? 'text-neutral-500' : 'text-stone-600'}`}>
              No source mapping available for this selection.
            </div>
          ) : (
            <>
              <div className={`mb-2 text-[11px] font-mono ${isDarkMode ? 'text-neutral-400' : 'text-stone-600'}`}>
                {sourceSnippet.displayPath}:{sourceSnippet.focusLine}
              </div>
              <CodeBlock
                code={sourceSnippet.code}
                language={codeLanguage}
                showLineNumbers
                isDarkMode={isDarkMode}
              >
                <CodeBlockCopyButton
                  variant="ghost"
                  size="sm"
                  className={isDarkMode ? 'text-neutral-300 hover:text-white' : 'text-stone-700 hover:text-stone-900'}
                />
              </CodeBlock>
              <div className={`mt-2 text-[11px] ${isDarkMode ? 'text-neutral-500' : 'text-stone-500'}`}>
                Showing lines {sourceSnippet.startLine}–{sourceSnippet.startLine + Math.max(0, sourceSnippet.code.split('\n').length - 1)}.
              </div>
            </>
          )}
        </div>
      ) : activeTab === 'design' ? (
        <div className="flex-1 overflow-y-auto">
          <Section title="Position" defaultOpen isDarkMode={isDarkMode} panelBorder={panelBorder}>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <NumberInput label="X" value={styles.x} onChange={handleNumber('x')} suffix="px" disabled={!hasSelection} />
              <NumberInput label="Y" value={styles.y} onChange={handleNumber('y')} suffix="px" disabled={!hasSelection} />
            </div>
            <div className="flex items-center gap-2">
              <NumberInput
                label={<RotateCcw size={10} />}
                value={styles.rotation}
                onChange={handleNumber('rotation')}
                suffix="°"
                containerClassName="flex-1"
                disabled={!hasSelection}
              />
              <div className="flex gap-1">
                <ToggleButton
                  className="w-7 h-7"
                  title="Reset rotation"
                  onClick={() => onChange('rotation', 0)}
                  disabled={!hasSelection}
                >
                  <RotateCcw size={12} />
                </ToggleButton>
                <ToggleButton
                  className="w-7 h-7"
                  title="Flip horizontal"
                  active={styles.scaleX === -1}
                  onClick={() => onChange('scaleX', styles.scaleX === 1 ? -1 : 1)}
                  disabled={!hasSelection}
                >
                  <FlipHorizontal2 size={12} />
                </ToggleButton>
                <ToggleButton
                  className="w-7 h-7"
                  title="Flip vertical"
                  active={styles.scaleY === -1}
                  onClick={() => onChange('scaleY', styles.scaleY === 1 ? -1 : 1)}
                  disabled={!hasSelection}
                >
                  <FlipVertical2 size={12} />
                </ToggleButton>
              </div>
            </div>
          </Section>

          <Section title="Layout" defaultOpen isDarkMode={isDarkMode} panelBorder={panelBorder}>
            <div className="mb-3">
              <div className={captionClass}>Flow</div>
              <div className="grid grid-cols-4 gap-1 bg-neutral-900 p-0.5 rounded border border-border">
                <ToggleButton
                  active={styles.display === 'block'}
                  onClick={() => onChange('display', 'block')}
                  title="Block"
                  disabled={!hasSelection}
                >
                  <LayoutTemplate size={14} />
                </ToggleButton>
                <ToggleButton
                  active={styles.display === 'flex' && styles.flexDirection === 'row'}
                  onClick={() => {
                    onChange('display', 'flex')
                    onChange('flexDirection', 'row')
                  }}
                  title="Flex row"
                  disabled={!hasSelection}
                >
                  <Columns size={14} />
                </ToggleButton>
                <ToggleButton
                  active={styles.display === 'flex' && styles.flexDirection === 'column'}
                  onClick={() => {
                    onChange('display', 'flex')
                    onChange('flexDirection', 'column')
                  }}
                  title="Flex column"
                  disabled={!hasSelection}
                >
                  <div className="rotate-90">
                    <Columns size={14} />
                  </div>
                </ToggleButton>
                <ToggleButton
                  active={styles.display === 'grid'}
                  onClick={() => onChange('display', 'grid')}
                  title="Grid"
                  disabled={!hasSelection}
                >
                  <Grid3X3 size={14} />
                </ToggleButton>
              </div>
            </div>

            <div className="mb-3">
              <div className={captionClass}>Dimensions</div>
              <div className="grid grid-cols-2 gap-2">
                <NumberInput label="W" value={styles.width} onChange={handleNumber('width')} suffix="px" disabled={!hasSelection} />
                <NumberInput label="H" value={styles.height} onChange={handleNumber('height')} suffix="px" disabled={!hasSelection} />
              </div>
            </div>

            {styles.display === 'flex' && (
              <div className="mb-3">
                <div className={captionClass}>Align</div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="bg-neutral-900 rounded p-0.5 flex gap-0.5 justify-between border border-border">
                    {(['flex-start', 'center', 'flex-end', 'space-between'] as const).map((v) => (
                      <ToggleButton
                        key={v}
                        active={styles.justifyContent === v}
                        onClick={() => onChange('justifyContent', v)}
                        className="flex-1"
                        title={`justify-content: ${v}`}
                        disabled={!hasSelection}
                      >
                        {v === 'flex-start' && <AlignLeft size={12} />}
                        {v === 'center' && <AlignCenter size={12} />}
                        {v === 'flex-end' && <AlignRight size={12} />}
                        {v === 'space-between' && <AlignJustify size={12} />}
                      </ToggleButton>
                    ))}
                  </div>
                  <div className="bg-neutral-900 rounded p-0.5 flex gap-0.5 justify-between border border-border">
                    {(['flex-start', 'center', 'flex-end'] as const).map((v) => (
                      <ToggleButton
                        key={v}
                        active={styles.alignItems === v}
                        onClick={() => onChange('alignItems', v)}
                        className="flex-1"
                        title={`align-items: ${v}`}
                        disabled={!hasSelection}
                      >
                        {v === 'flex-start' && <AlignStartVertical size={12} />}
                        {v === 'center' && <AlignCenterVertical size={12} />}
                        {v === 'flex-end' && <AlignEndVertical size={12} />}
                      </ToggleButton>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-neutral-500 font-semibold uppercase tracking-wide w-8">Gap</span>
                  <NumberInput value={styles.gap} onChange={handleNumber('gap')} suffix="px" disabled={!hasSelection} />
                </div>
              </div>
            )}

            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className={captionClass.replace(' mb-1.5', '')}>Padding</div>
                <ToggleButton className="h-4 w-4" title="Padding mode" disabled>
                  <BoxSelect size={10} />
                </ToggleButton>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <NumberInput
                  label={<BoxSelect size={10} />}
                  value={styles.padding}
                  onChange={handleNumber('padding')}
                  placeholder="All"
                  suffix="px"
                  disabled={!hasSelection}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <Checkbox
                label="Clip content"
                checked={styles.overflow === 'hidden'}
                onChange={(checked) => onChange('overflow', checked ? 'hidden' : 'visible')}
                disabled={!hasSelection}
              />
              <Checkbox
                label="Border box"
                checked={styles.boxSizing === 'border-box'}
                onChange={(checked) => onChange('boxSizing', checked ? 'border-box' : 'content-box')}
                disabled={!hasSelection}
              />
            </div>
          </Section>

          <Section
            title="Appearance"
            defaultOpen
            isDarkMode={isDarkMode}
            panelBorder={panelBorder}
            actions={(
              <div className="flex gap-1">
                <div className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-stone-500'}`}>
                  {selectedElementName ? selectedElementName : `Element ${selectedElementNumber}`}
                </div>
              </div>
            )}
          >
            <div className="space-y-3">
              <div>
                <div className={captionClass}>Opacity</div>
                <NumberInput
                  label={<Eye size={10} />}
                  value={styles.opacity}
                  onChange={handleNumber('opacity')}
                  suffix="%"
                  max={100}
                  min={0}
                  disabled={!hasSelection}
                />
              </div>
              <div>
                <div className={captionClass}>Corner Radius</div>
                <div className="flex gap-2">
                  <NumberInput
                    label={<BoxSelect size={10} />}
                    value={styles.borderRadius}
                    onChange={handleNumber('borderRadius')}
                    suffix="px"
                    containerClassName="flex-1"
                    disabled={!hasSelection}
                  />
                  <ToggleButton className="h-7 w-7 bg-neutral-800 border border-neutral-700" title="Radius presets" disabled>
                    <BoxSelect size={12} />
                  </ToggleButton>
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Background"
            defaultOpen
            isDarkMode={isDarkMode}
            panelBorder={panelBorder}
            actions={(
              <button
                type="button"
                className="p-1 -m-1 rounded hover:bg-neutral-800 disabled:opacity-50"
                title="Reset background"
                onClick={() => onChange('backgroundColor', '#000000')}
                disabled={!hasSelection}
              >
                <RotateCcw size={12} className="text-neutral-500 hover:text-white" />
              </button>
            )}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded border border-neutral-600 overflow-hidden relative">
                  <input
                    type="color"
                    value={styles.backgroundColor}
                    onChange={(e) => handleText('backgroundColor')(e.target.value)}
                    disabled={!hasSelection}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 m-0 border-0 cursor-pointer"
                  />
                </div>
                <div className="flex-1 h-7 bg-neutral-800 border border-neutral-700 rounded-sm flex items-center px-2 focus-within:border-blue-500">
                  <input
                    type="text"
                    value={styles.backgroundColor}
                    onChange={(e) => handleText('backgroundColor')(e.target.value)}
                    disabled={!hasSelection}
                    className="bg-transparent w-full text-xs text-neutral-300 outline-none font-mono uppercase"
                  />
                </div>
                <NumberInput value={100} onChange={() => {}} suffix="%" containerClassName="w-16" disabled />
              </div>
            </div>
          </Section>

          <Section title="Text" isDarkMode={isDarkMode} panelBorder={panelBorder}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <NumberInput label="Size" value={styles.fontSize} onChange={handleNumber('fontSize')} suffix="px" disabled={!hasSelection} />
                <NumberInput label="Weight" value={styles.fontWeight} onChange={handleNumber('fontWeight')} disabled={!hasSelection} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <NumberInput label="Line" value={styles.lineHeight} onChange={handleNumber('lineHeight')} suffix="px" disabled={!hasSelection} />
                <NumberInput label="Track" value={styles.letterSpacing} onChange={handleNumber('letterSpacing')} suffix="px" disabled={!hasSelection} />
              </div>
              <div>
                <div className={captionClass}>Font</div>
                <FontPicker
                  value={styles.fontFamily}
                  onSelect={(family) => onChange('fontFamily', family)}
                  projectFonts={fontFamilies || []}
                  onLoadGoogleFont={(family) => onChange('googleFonts', Array.from(new Set([...(styles.googleFonts || []), family])))}
                  onInstallLocalFont={(font) => onChange('fontFaces', mergeFontFaces(styles.fontFaces || [], font))}
                  projectPath={projectPath}
                  disabled={!hasSelection}
                />
              </div>
              <div>
                <div className={captionClass}>Color</div>
                <ColorInput value={styles.color} onChange={handleText('color')} disabled={!hasSelection} />
              </div>
              <div>
                <div className={captionClass}>Alignment</div>
                <div className="grid grid-cols-4 gap-1 bg-neutral-900 p-0.5 rounded border border-border">
                  {(['left', 'center', 'right', 'justify'] as const).map((v) => (
                    <ToggleButton
                      key={v}
                      active={styles.textAlign === v}
                      onClick={() => onChange('textAlign', v)}
                      title={`text-align: ${v}`}
                      disabled={!hasSelection}
                    >
                      {v === 'left' && <AlignLeft size={14} />}
                      {v === 'center' && <AlignCenter size={14} />}
                      {v === 'right' && <AlignRight size={14} />}
                      {v === 'justify' && <AlignJustify size={14} />}
                    </ToggleButton>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Border"
            isDarkMode={isDarkMode}
            panelBorder={panelBorder}
            actions={(
              <button
                type="button"
                className="p-1 -m-1 rounded hover:bg-neutral-800 disabled:opacity-50"
                title="Add border"
                onClick={() => {
                  onChange('borderWidth', styles.borderWidth || 1)
                  onChange('borderStyle', styles.borderStyle === 'none' ? 'solid' : styles.borderStyle)
                }}
                disabled={!hasSelection}
              >
                <Plus size={12} className="text-neutral-500 hover:text-white" />
              </button>
            )}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <NumberInput label="Width" value={styles.borderWidth} onChange={handleNumber('borderWidth')} suffix="px" disabled={!hasSelection} />
                <SelectInput
                  label="Style"
                  value={styles.borderStyle}
                  onChange={(v) => onChange('borderStyle', v)}
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'solid', label: 'Solid' },
                    { value: 'dashed', label: 'Dashed' },
                    { value: 'dotted', label: 'Dotted' },
                  ]}
                  disabled={!hasSelection}
                />
              </div>
              <div>
                <div className={captionClass}>Color</div>
                <ColorInput value={styles.borderColor} onChange={handleText('borderColor')} disabled={!hasSelection} />
              </div>
            </div>
          </Section>

          <Section
            title="Shadow & Blur"
            isDarkMode={isDarkMode}
            panelBorder={panelBorder}
            actions={(
              <ShadowBlurAddButton
                disabled={!hasSelection}
                onAdd={(kind) => {
                  if (kind === 'drop-shadow') {
                    onChange('shadowEnabled', true)
                    onChange('shadowVisible', true)
                    onChange('shadowType', 'drop')
                    onChange('shadowBlur', styles.shadowBlur || 10)
                    onChange('shadowColor', styles.shadowColor || 'rgba(0,0,0,0.25)')
                    return
                  }
                  if (kind === 'inner-shadow') {
                    onChange('shadowEnabled', true)
                    onChange('shadowVisible', true)
                    onChange('shadowType', 'inner')
                    onChange('shadowBlur', styles.shadowBlur || 10)
                    onChange('shadowColor', styles.shadowColor || 'rgba(0,0,0,0.25)')
                    return
                  }
                  if (kind === 'layer-blur') {
                    onChange('blurEnabled', true)
                    onChange('blurVisible', true)
                    onChange('blurType', 'layer')
                    onChange('blur', styles.blur || 8)
                    return
                  }
                  if (kind === 'backdrop-blur') {
                    onChange('blurEnabled', true)
                    onChange('blurVisible', true)
                    onChange('blurType', 'backdrop')
                    onChange('blur', styles.blur || 8)
                  }
                }}
              />
            )}
          >
            <div className="space-y-3">
              {(styles.shadowEnabled || styles.shadowBlur || styles.shadowSpread || styles.shadowX || styles.shadowY) ? (
                <div className="space-y-2">
                  <EffectRow
                    checked={styles.shadowEnabled}
                    onChecked={(v) => onChange('shadowEnabled', v)}
                    kind="shadow"
                    title={styles.shadowType === 'inner' ? 'Inner shadow' : 'Drop shadow'}
                    onKindChange={(v) => onChange('shadowType', v)}
                    visible={styles.shadowVisible}
                    onVisible={(v) => onChange('shadowVisible', v)}
                    onRemove={() => {
                      onChange('shadowEnabled', false)
                      onChange('shadowVisible', true)
                      onChange('shadowX', 0)
                      onChange('shadowY', 0)
                      onChange('shadowBlur', 0)
                      onChange('shadowSpread', 0)
                    }}
                    disabled={!hasSelection}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <NumberInput label="X" value={styles.shadowX} onChange={handleNumber('shadowX')} suffix="px" disabled={!hasSelection || !styles.shadowEnabled} />
                    <NumberInput label="Y" value={styles.shadowY} onChange={handleNumber('shadowY')} suffix="px" disabled={!hasSelection || !styles.shadowEnabled} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberInput label="Blur" value={styles.shadowBlur} onChange={handleNumber('shadowBlur')} suffix="px" disabled={!hasSelection || !styles.shadowEnabled} />
                    <NumberInput label="Spread" value={styles.shadowSpread} onChange={handleNumber('shadowSpread')} suffix="px" disabled={!hasSelection || !styles.shadowEnabled} />
                  </div>
                  <div>
                    <div className={captionClass}>Color</div>
                    <TextInput
                      value={styles.shadowColor}
                      onChange={handleText('shadowColor')}
                      placeholder="rgba(0,0,0,0.25)"
                      disabled={!hasSelection || !styles.shadowEnabled}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-xs text-neutral-500">No shadow.</div>
              )}

              {(styles.blurEnabled || (styles.blur || 0) > 0) ? (
                <div className="space-y-2">
                  <EffectRow
                    checked={styles.blurEnabled}
                    onChecked={(v) => onChange('blurEnabled', v)}
                    kind="blur"
                    title={styles.blurType === 'backdrop' ? 'Backdrop Blur' : 'Layer Blur'}
                    onKindChange={(v) => onChange('blurType', v)}
                    visible={styles.blurVisible}
                    onVisible={(v) => onChange('blurVisible', v)}
                    onRemove={() => {
                      onChange('blurEnabled', false)
                      onChange('blurVisible', true)
                      onChange('blur', 0)
                    }}
                    disabled={!hasSelection}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <NumberInput
                      label="Blur"
                      value={styles.blur}
                      onChange={(v) => {
                        onChange('blur', v)
                        onChange('blurEnabled', v > 0)
                      }}
                      suffix="px"
                      disabled={!hasSelection || !styles.blurEnabled}
                    />
                    <div className="flex items-center">
                      <div className="text-xs text-neutral-500">
                        {styles.blurType === 'backdrop' ? 'Affects backdrop' : 'Affects layer'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-neutral-500">No blur.</div>
              )}
            </div>
          </Section>

          <Section title="Properties" isDarkMode={isDarkMode} panelBorder={panelBorder} defaultOpen>
            <div className="space-y-4">
              <div>
                <div className={captionClass.replace(' mb-1.5', ' mb-2')}>Attributes</div>
                <div className="space-y-2">
                  {Object.keys(attributes || {}).length === 0 && Object.keys(styles.attributeOverrides || {}).length === 0 ? (
                    <div className="text-xs text-neutral-500">No attributes found.</div>
                  ) : (
                    Object.keys({ ...(attributes || {}), ...(styles.attributeOverrides || {}) })
                      .sort((a, b) => a.localeCompare(b))
                      .map((k) => {
                        const v = (styles.attributeOverrides || {})[k] ?? (attributes || {})[k] ?? ''
                        const overridden = Object.prototype.hasOwnProperty.call(styles.attributeOverrides || {}, k)
                        return (
                          <KeyValueRow
                            key={k}
                            k={k}
                            v={v}
                            overridden={overridden}
                            onChange={(next) => setAttrOverride(k, next)}
                            onClear={overridden ? () => setAttrOverride(k, '') : undefined}
                            disabled={!hasSelection}
                          />
                        )
                      })
                  )}
                  <div className="flex gap-2 pt-1">
                    <TextInput value={attrAddKey} onChange={setAttrAddKey} placeholder="attr" disabled={!hasSelection} />
                    <TextInput value={attrAddValue} onChange={setAttrAddValue} placeholder="value" disabled={!hasSelection} />
                    <ToggleButton
                      className="w-7 h-7"
                      title="Add attribute"
                      disabled={!hasSelection || !attrAddKey.trim()}
                      onClick={() => {
                        setAttrOverride(attrAddKey.trim(), attrAddValue)
                        setAttrAddKey('')
                        setAttrAddValue('')
                      }}
                    >
                      <Plus size={12} />
                    </ToggleButton>
                  </div>
                </div>
              </div>

              <div>
                <div className={captionClass.replace(' mb-1.5', ' mb-2')}>Dataset</div>
                <div className="space-y-2">
                  {Object.keys(dataset || {}).length === 0 && Object.keys(styles.datasetOverrides || {}).length === 0 ? (
                    <div className="text-xs text-neutral-500">No data-* entries found.</div>
                  ) : (
                    Object.keys({ ...(dataset || {}), ...(styles.datasetOverrides || {}) })
                      .sort((a, b) => a.localeCompare(b))
                      .map((k) => {
                        const v = (styles.datasetOverrides || {})[k] ?? (dataset || {})[k] ?? ''
                        const overridden = Object.prototype.hasOwnProperty.call(styles.datasetOverrides || {}, k)
                        return (
                          <KeyValueRow
                            key={k}
                            k={`data-${k}`}
                            v={v}
                            overridden={overridden}
                            onChange={(next) => setDatasetOverride(k, next)}
                            onClear={overridden ? () => setDatasetOverride(k, '') : undefined}
                            disabled={!hasSelection}
                          />
                        )
                      })
                  )}
                  <div className="flex gap-2 pt-1">
                    <TextInput value={dataAddKey} onChange={setDataAddKey} placeholder="key" disabled={!hasSelection} />
                    <TextInput value={dataAddValue} onChange={setDataAddValue} placeholder="value" disabled={!hasSelection} />
                    <ToggleButton
                      className="w-7 h-7"
                      title="Add data-*"
                      disabled={!hasSelection || !dataAddKey.trim()}
                      onClick={() => {
                        setDatasetOverride(dataAddKey.trim(), dataAddValue)
                        setDataAddKey('')
                        setDataAddValue('')
                      }}
                    >
                      <Plus size={12} />
                    </ToggleButton>
                  </div>
                </div>
              </div>
            </div>
          </Section>
        </div>
      ) : activeTab === 'tailwind' ? (
        <div className="flex-1 p-3 overflow-auto">
          <div className={`text-xs mb-2 ${isDarkMode ? 'text-neutral-500' : 'text-stone-500'}`}>
            Edits `className` on the selected element (live in the webview).
          </div>
          <div className="mb-3">
            <div className="flex flex-wrap gap-1.5">
              {styles.className
                .split(/\s+/)
                .map((c) => c.trim())
                .filter(Boolean)
                .map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-900 border border-neutral-700 text-neutral-200 hover:bg-neutral-800"
                    title="Remove class"
                    onClick={() => removeClassToken(c)}
                    disabled={!hasSelection}
                  >
                    <span>{c}</span>
                    <X size={10} className="text-neutral-500" />
                  </button>
                ))}
            </div>
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <div className="flex-1 h-7 bg-neutral-900 border border-neutral-700 rounded-sm flex items-center px-2 focus-within:border-blue-500">
                  <input
                    type="text"
                    value={twAdd}
                    onChange={(e) => {
                      setTwAdd(e.target.value)
                      setTwSuggestOpen(true)
                      setTwSuggestIndex(0)
                    }}
                    onFocus={() => {
                      if (twAdd.trim()) setTwSuggestOpen(true)
                    }}
                    onBlur={() => {
                      window.setTimeout(() => setTwSuggestOpen(false), 120)
                    }}
                    onKeyDown={(e) => {
                      if (!twSuggestOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && twSuggestions.length > 0) {
                        setTwSuggestOpen(true)
                        return
                      }
                      if (e.key === 'ArrowDown' && twSuggestions.length > 0) {
                        e.preventDefault()
                        setTwSuggestIndex((i) => Math.min(twSuggestions.length - 1, i + 1))
                        return
                      }
                      if (e.key === 'ArrowUp' && twSuggestions.length > 0) {
                        e.preventDefault()
                        setTwSuggestIndex((i) => Math.max(0, i - 1))
                        return
                      }
                      if ((e.key === 'Enter' || e.key === 'Tab') && twAdd.trim()) {
                        const picked = twSuggestOpen && twSuggestions[twSuggestIndex] ? twSuggestions[twSuggestIndex].value : twAdd.trim()
                        addClassToken(picked)
                        e.preventDefault()
                        return
                      }
                      if (e.key === 'Escape') {
                        setTwSuggestOpen(false)
                      }
                    }}
                    placeholder="Add class…"
                    disabled={!hasSelection}
                    className="bg-transparent w-full text-xs text-neutral-200 outline-none"
                  />
                </div>
                {twSuggestOpen && twSuggestions.length > 0 && hasSelection && (
                  <div className="absolute left-0 right-0 mt-1 rounded-md border border-neutral-700 bg-neutral-900 shadow-lg z-50 overflow-hidden">
                    {twSuggestions.map((s, idx) => (
                      <button
                        key={`${s.source}:${s.value}`}
                        type="button"
                        className={[
                          'w-full px-2 py-1.5 text-left text-xs font-mono flex items-center justify-between gap-2',
                          idx === twSuggestIndex ? 'bg-neutral-800 text-white' : 'text-neutral-200 hover:bg-neutral-800',
                        ].join(' ')}
                        onMouseEnter={() => setTwSuggestIndex(idx)}
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => addClassToken(s.value)}
                      >
                        <span className="truncate">{s.value}</span>
                        <span className="text-[10px] text-neutral-500">{s.source === 'tw' ? 'TW' : 'CSS'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="h-7 px-2 rounded-md bg-neutral-900 border border-neutral-700 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
                disabled={!hasSelection || !twAdd.trim()}
                onClick={() => {
                  const picked = twSuggestOpen && twSuggestions[twSuggestIndex] ? twSuggestions[twSuggestIndex].value : twAdd.trim()
                  addClassToken(picked)
                }}
              >
                Add
              </button>
            </div>
          </div>
          <Textarea
            value={styles.className}
            onChange={(e) => handleText('className')(e.target.value)}
            className="min-h-40 font-mono text-xs"
            placeholder="e.g. flex items-center gap-2 bg-blue-500 text-white"
            disabled={!hasSelection}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-3 border-b" style={{ borderColor: panelBorder }}>
            <div className={`text-xs mb-2 ${isDarkMode ? 'text-neutral-500' : 'text-stone-500'}`}>
              Computed styles (click a value to override).
            </div>
            <div className="flex gap-2">
              <input
                value={cssFilter}
                onChange={(e) => setCssFilter(e.target.value)}
                placeholder="Filter…"
                className="flex-1 h-8 px-2 rounded-md bg-neutral-900 border border-neutral-700 text-xs text-neutral-200 outline-none focus:border-blue-500"
              />
              <button
                type="button"
                className="h-8 px-2 rounded-md bg-neutral-900 border border-neutral-700 text-xs text-neutral-200 hover:bg-neutral-800"
                onClick={() => setCssAddOpen((v) => !v)}
              >
                <span className="flex items-center gap-1">
                  <Plus size={12} /> Add
                </span>
              </button>
            </div>
            {cssAddOpen && (
              <div className="mt-2 flex gap-2">
                <TextInput value={cssAddProp} onChange={setCssAddProp} placeholder="property" disabled={!hasSelection} />
                <TextInput value={cssAddValue} onChange={setCssAddValue} placeholder="value" disabled={!hasSelection} />
                <button
                  type="button"
                  className="h-7 px-2 rounded-md bg-blue-600 text-xs text-white disabled:opacity-50"
                  disabled={!hasSelection || !cssAddProp.trim()}
                  onClick={() => {
                    setCssOverride(cssAddProp.trim(), cssAddValue)
                    setCssAddProp('')
                    setCssAddValue('')
                    setCssAddOpen(false)
                  }}
                >
                  Apply
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto p-3 font-mono text-xs select-text">
            {cssEntries.length === 0 ? (
              <pre className="whitespace-pre-wrap text-blue-300">{cssContent}</pre>
            ) : (
              <div className="space-y-1">
                {cssEntries.map(({ prop, value, computed, overridden }) => (
                  <CssRow
                    key={prop}
                    prop={prop}
                    value={value}
                    computed={computed}
                    overridden={overridden}
                    onChange={(next) => setCssOverride(prop, next)}
                    onClear={overridden ? () => setCssOverride(prop, '') : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const Section: React.FC<{
  title: string
  defaultOpen?: boolean
  children?: React.ReactNode
  actions?: React.ReactNode
  isDarkMode: boolean
  panelBorder: string
}> = ({ title, defaultOpen, children, actions, isDarkMode, panelBorder }) => {
  const [isOpen, setIsOpen] = useState(!!defaultOpen)

  return (
    <div className="border-b" style={{ borderColor: panelBorder }}>
      <SectionHeader title={title} isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} actions={actions} isDarkMode={isDarkMode} panelBorder={panelBorder} />
      {isOpen && <div className="p-3">{children}</div>}
    </div>
  )
}

const SectionHeader: React.FC<{
  title: string
  isOpen: boolean
  onToggle: () => void
  actions?: React.ReactNode
  isDarkMode: boolean
  panelBorder: string
}> = ({ title, isOpen, onToggle, actions, isDarkMode, panelBorder }) => (
  <div
    className="flex items-center justify-between px-3 py-2 select-none cursor-pointer"
    style={{ borderColor: panelBorder }}
    onClick={onToggle}
  >
    <div className="flex items-center gap-2">
      <ChevronDown size={14} className={[isDarkMode ? 'text-neutral-400' : 'text-stone-500', isOpen ? '' : '-rotate-90'].join(' ')} />
      <span className={`text-xs font-semibold ${isDarkMode ? 'text-neutral-200' : 'text-stone-700'}`}>{title}</span>
    </div>
    <div onClick={(e) => e.stopPropagation()}>{actions}</div>
  </div>
)

const ToggleButton: React.FC<{
  active?: boolean
  onClick?: () => void
  className?: string
  title?: string
  disabled?: boolean
  children: React.ReactNode
}> = ({ active, onClick, className = '', title, disabled, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    disabled={disabled}
    className={[
      'h-7 rounded-sm flex items-center justify-center transition-all border border-transparent',
      active ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800',
      disabled ? 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-neutral-400' : '',
      className,
    ].join(' ')}
  >
    {children}
  </button>
)

const NumberInput: React.FC<{
  label?: React.ReactNode
  value?: number
  onChange: (value: number) => void
  suffix?: string
  placeholder?: string
  containerClassName?: string
  min?: number
  max?: number
  disabled?: boolean
}> = ({ label, value, onChange, suffix, placeholder, containerClassName = '', min, max, disabled }) => (
  <div className={['flex items-center gap-2', containerClassName].join(' ')}>
    {label && <div className="text-[11px] text-neutral-500">{label}</div>}
    <div className="flex-1 h-7 bg-neutral-900 border border-neutral-700 rounded-sm flex items-center px-2 focus-within:border-blue-500">
      <input
        type="number"
        value={Number.isFinite(value as number) ? (value as number) : 0}
        onChange={(e) => onChange(Number.parseFloat(e.target.value || '0') || 0)}
        placeholder={placeholder}
        min={min}
        max={max}
        disabled={disabled}
        className="bg-transparent w-full text-xs text-neutral-200 outline-none"
      />
      {suffix && <span className="text-[10px] text-neutral-500 ml-1">{suffix}</span>}
    </div>
  </div>
)

const TextInput: React.FC<{
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}> = ({ value, onChange, placeholder, disabled }) => (
  <div className="flex-1 h-7 bg-neutral-900 border border-neutral-700 rounded-sm flex items-center px-2 focus-within:border-blue-500">
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="bg-transparent w-full text-xs text-neutral-200 outline-none"
    />
  </div>
)

const SelectInput: React.FC<{
  label: string
  value: string
  onChange: (value: any) => void
  options: Array<{ value: string; label: string }>
  disabled?: boolean
}> = ({ label, value, onChange, options, disabled }) => (
  <div className="flex items-center gap-2">
    <div className="text-neutral-500 text-xs w-10">{label}</div>
    <div className="flex-1 h-7 bg-neutral-900 border border-neutral-700 rounded-sm flex items-center px-2 focus-within:border-blue-500">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-transparent w-full text-xs text-neutral-200 outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  </div>
)

const ColorInput: React.FC<{ value: string; onChange: (value: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
  <div className="flex items-center gap-2">
    <div className="h-7 w-7 rounded border border-neutral-600 overflow-hidden relative">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 m-0 border-0 cursor-pointer"
      />
    </div>
    <div className="flex-1 h-7 bg-neutral-900 border border-neutral-700 rounded-sm flex items-center px-2 focus-within:border-blue-500">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-transparent w-full text-xs text-neutral-200 outline-none font-mono uppercase"
      />
    </div>
  </div>
)

const TW_COLORS = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
] as const

const TW_STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const

const TW_SPACING = [
  '0',
  '0.5',
  '1',
  '1.5',
  '2',
  '2.5',
  '3',
  '3.5',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '14',
  '16',
  '20',
  '24',
  '28',
  '32',
  '36',
  '40',
  '44',
  '48',
  '52',
  '56',
  '60',
  '64',
  '72',
  '80',
  '96',
] as const

const TW_BASE = [
  'flex',
  'inline-flex',
  'grid',
  'block',
  'inline-block',
  'hidden',
  'items-start',
  'items-center',
  'items-end',
  'justify-start',
  'justify-center',
  'justify-end',
  'justify-between',
  'justify-around',
  'justify-evenly',
  'gap-0',
  'gap-1',
  'gap-2',
  'gap-3',
  'gap-4',
  'w-full',
  'h-full',
  'min-w-0',
  'min-h-0',
  'rounded',
  'rounded-md',
  'rounded-lg',
  'rounded-xl',
  'border',
  'border-0',
  'shadow',
  'shadow-sm',
  'shadow-md',
  'shadow-lg',
  'overflow-hidden',
  'overflow-auto',
  'truncate',
  'text-xs',
  'text-sm',
  'text-base',
  'text-lg',
  'font-normal',
  'font-medium',
  'font-semibold',
  'font-bold',
  'uppercase',
  'tracking-tight',
  'tracking-wide',
] as const

function getTailwindSuggestions(queryRaw: string, limit: number): string[] {
  const query = queryRaw.trim()
  if (!query) return []

  const out: string[] = []
  const push = (v: string) => {
    if (out.length >= limit) return
    if (!out.includes(v)) out.push(v)
  }

  for (const base of TW_BASE) {
    if (base.startsWith(query)) push(base)
    if (out.length >= limit) return out
  }

  const colorPrefixes = ['bg-', 'text-', 'border-', 'ring-', 'from-', 'via-', 'to-'] as const
  for (const prefix of colorPrefixes) {
    if (query.startsWith(prefix) || prefix.startsWith(query)) {
      for (const c of TW_COLORS) {
        for (const step of TW_STEPS) {
          const candidate = `${prefix}${c}-${step}`
          if (candidate.startsWith(query)) push(candidate)
          if (out.length >= limit) return out
        }
      }
    }
  }

  const spacingPrefixes = ['p-', 'px-', 'py-', 'pt-', 'pr-', 'pb-', 'pl-', 'm-', 'mx-', 'my-', 'mt-', 'mr-', 'mb-', 'ml-', 'gap-'] as const
  for (const prefix of spacingPrefixes) {
    if (query.startsWith(prefix) || prefix.startsWith(query)) {
      for (const n of TW_SPACING) {
        const candidate = `${prefix}${n}`
        if (candidate.startsWith(query)) push(candidate)
        if (out.length >= limit) return out
      }
    }
  }

  const rounded = ['rounded-none', 'rounded-sm', 'rounded', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-3xl', 'rounded-full'] as const
  if (query.startsWith('rounded') || 'rounded'.startsWith(query)) {
    for (const r of rounded) {
      if (r.startsWith(query)) push(r)
      if (out.length >= limit) return out
    }
  }

  return out
}

type FontFaceSpec = { family: string; srcUrl: string; format?: string }

function mergeFontFaces(existing: FontFaceSpec[], next: FontFaceSpec): FontFaceSpec[] {
  const family = String(next.family || '').trim()
  const srcUrl = String(next.srcUrl || '').trim()
  if (!family || !srcUrl) return existing
  const format = next.format ? String(next.format) : undefined
  const out: FontFaceSpec[] = []
  const seen = new Set<string>()
  for (const f of [...existing, { family, srcUrl, format }]) {
    if (!f) continue
    const k = `${f.family}|${f.srcUrl}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(f)
  }
  return out
}

const SYSTEM_FONTS: Array<{ label: string; value: string }> = [
  { label: 'System UI', value: 'system-ui' },
  { label: 'Inter', value: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' },
  { label: 'SF Pro', value: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, Times, serif' },
  { label: 'Times', value: 'Times New Roman, Times, serif' },
  { label: 'Courier', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace' },
]

const GOOGLE_FONTS: string[] = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Playfair Display',
  'Source Sans 3',
  'Source Serif 4',
]

const FontPicker: React.FC<{
  value: string
  onSelect: (family: string) => void
  projectFonts: string[]
  onLoadGoogleFont: (family: string) => void
  onInstallLocalFont: (face: FontFaceSpec) => void
  projectPath?: string | null
  disabled?: boolean
}> = ({ value, onSelect, projectFonts, onLoadGoogleFont, onInstallLocalFont, projectPath, disabled }) => {
  const [importPath, setImportPath] = useState('')
  const [importFamily, setImportFamily] = useState('')
  const [copyToProject, setCopyToProject] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canImport = !!projectPath && typeof window !== 'undefined' && !!(window as any).electronAPI?.files

  const guessFormat = (filename: string): string | undefined => {
    const lower = filename.toLowerCase()
    if (lower.endsWith('.woff2')) return 'woff2'
    if (lower.endsWith('.woff')) return 'woff'
    if (lower.endsWith('.ttf')) return 'truetype'
    if (lower.endsWith('.otf')) return 'opentype'
    return undefined
  }

  const basename = (p: string) => p.replace(/\\/g, '/').split('/').filter(Boolean).pop() || p
  const stripExt = (p: string) => p.replace(/\.(woff2|woff|ttf|otf)$/i, '')

  const handleSelect = (raw: string) => {
    setError(null)
    if (!raw) return
    if (raw.startsWith('google:')) {
      const family = raw.slice('google:'.length)
      onLoadGoogleFont(family)
      onSelect(`'${family}', system-ui, sans-serif`)
      return
    }
    onSelect(raw)
  }

  const handleInstall = async () => {
    setError(null)
    if (!importPath.trim()) return
    const srcPath = importPath.trim()
    const file = basename(srcPath)
    const family = (importFamily.trim() || stripExt(file)).trim()
    if (!family) {
      setError('Missing family name.')
      return
    }
    if (!canImport) {
      setError('Font install requires an Electron project tab.')
      return
    }

    setBusy(true)
    try {
      const filesApi = (window as any).electronAPI.files
      const fontsDir = `${projectPath}/public/fonts`
      await filesApi.createDirectory(fontsDir)
      const destPath = `${fontsDir}/${file}`
      if (copyToProject) {
        const r = await filesApi.copyFile(srcPath, destPath)
        if (!r?.success) throw new Error(r?.error || 'Copy failed')
      }

      const srcUrl = `/fonts/${file}`
      const format = guessFormat(file)
      onInstallLocalFont({ family, srcUrl, format })
      onSelect(`'${family}', system-ui, sans-serif`)
      setImportFamily('')
      setImportPath('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to install font.')
    } finally {
      setBusy(false)
    }
  }

  const uniqueProjectFonts = Array.from(new Set(projectFonts.map(f => f.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-7 bg-neutral-900 border border-neutral-700 rounded-sm flex items-center px-2 focus-within:border-blue-500">
          <select
            value={value}
            onChange={(e) => handleSelect(e.target.value)}
            disabled={disabled}
            className="bg-transparent w-full text-xs text-neutral-200 outline-none"
          >
            <option value={value}>{value || 'Select font…'}</option>
            <optgroup label="System">
              {SYSTEM_FONTS.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </optgroup>
            {uniqueProjectFonts.length > 0 && (
              <optgroup label="Project / Page">
                {uniqueProjectFonts.map((f) => (
                  <option key={f} value={`'${f}', system-ui, sans-serif`}>
                    {f}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Google Fonts">
              {GOOGLE_FONTS.map((f) => (
                <option key={f} value={`google:${f}`}>
                  {f}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      <div className="rounded-md border border-neutral-800 bg-neutral-950/40 p-2">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
          <TextInput value={importPath} onChange={setImportPath} placeholder="/path/to/font.woff2" disabled={disabled || busy} />
          <TextInput value={importFamily} onChange={setImportFamily} placeholder="Family (optional)" disabled={disabled || busy} />
          <button
            type="button"
            className="h-7 px-2 rounded-md bg-neutral-900 border border-neutral-700 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
            disabled={disabled || busy || !importPath.trim()}
            onClick={handleInstall}
            title={canImport ? 'Copy into project/public/fonts and register @font-face' : 'Requires an Electron project tab'}
          >
            {busy ? 'Installing…' : 'Install'}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <Checkbox
            label="Copy into project"
            checked={copyToProject}
            onChange={setCopyToProject}
            disabled={disabled || busy || !canImport}
            compact
          />
          {!canImport && (
            <span className="text-[11px] text-neutral-500">
              Paste a font file path; install works in Electron project tabs.
            </span>
          )}
        </div>
        {error && <div className="mt-2 text-[11px] text-red-300">{error}</div>}
      </div>
    </div>
  )
}

const Checkbox: React.FC<{ label: string; checked?: boolean; onChange?: (checked: boolean) => void; disabled?: boolean; compact?: boolean }> = ({ label, checked, onChange, disabled, compact }) => (
  <label className={['flex items-center gap-2 select-none', disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group'].join(' ')}>
    <input
      type="checkbox"
      className="sr-only"
      checked={!!checked}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.checked)}
    />
    <div
      className={[
        'w-3 h-3 rounded-[2px] border flex items-center justify-center',
        checked ? 'bg-blue-600 border-blue-600' : 'border-neutral-600 bg-neutral-900 group-hover:border-neutral-500',
      ].join(' ')}
    >
      {checked && <ChevronDown size={10} className="text-white rotate-0" strokeWidth={4} />}
    </div>
    <span className={[compact ? 'text-[11px]' : 'text-xs', 'text-neutral-400 group-hover:text-neutral-200'].join(' ')}>{label}</span>
  </label>
)

const CssRow: React.FC<{
  prop: string
  value: string
  computed: string
  overridden: boolean
  onChange: (value: string) => void
  onClear?: () => void
}> = ({ prop, value, computed, overridden, onChange, onClear }) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  return (
    <div className="grid grid-cols-[160px_1fr_auto] gap-3 items-start">
      <div className="text-[11px] text-amber-400 break-words">{prop}</div>
      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            onChange(draft)
            setEditing(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onChange(draft)
              setEditing(false)
            }
            if (e.key === 'Escape') {
              setDraft(value)
              setEditing(false)
            }
          }}
          className="h-7 px-2 rounded bg-neutral-900 border border-neutral-700 text-xs text-neutral-200 outline-none focus:border-blue-500"
          autoFocus
        />
      ) : (
        <button
          type="button"
          className="text-left text-[11px] text-neutral-200 hover:text-white"
          onClick={() => {
            setDraft(value || computed)
            setEditing(true)
          }}
          title={overridden ? `Overridden (computed: ${computed})` : computed}
        >
          {value || computed || <span className="text-neutral-500">—</span>}
        </button>
      )}
      {onClear ? (
        <button type="button" className="h-7 w-7 flex items-center justify-center rounded hover:bg-neutral-900" onClick={onClear} title="Clear override">
          <X size={12} className="text-neutral-500 hover:text-white" />
        </button>
      ) : (
        <div className="h-7 w-7" />
      )}
    </div>
  )
}

type ShadowBlurAddKind = 'drop-shadow' | 'inner-shadow' | 'layer-blur' | 'backdrop-blur'

const ShadowBlurAddButton: React.FC<{
  disabled?: boolean
  onAdd: (kind: ShadowBlurAddKind) => void
}> = ({ disabled, onAdd }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        className="p-1 -m-1 rounded hover:bg-neutral-800 disabled:opacity-50"
        title="Add effect"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={12} className="text-neutral-500 hover:text-white" />
      </button>
      {open && !disabled && (
        <div className="absolute right-0 mt-2 w-56 rounded-md border border-neutral-700 bg-neutral-900 shadow-lg z-50 overflow-hidden">
          {([
            { id: 'drop-shadow', label: 'Drop shadow' },
            { id: 'inner-shadow', label: 'Inner shadow' },
            { id: 'layer-blur', label: 'Layer Blur' },
            { id: 'backdrop-blur', label: 'Backdrop Blur' },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-neutral-200 hover:bg-neutral-800"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onAdd(item.id)
                setOpen(false)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const EffectRow: React.FC<{
  checked: boolean
  onChecked: (checked: boolean) => void
  kind: 'shadow' | 'blur'
  title: string
  onKindChange: (value: any) => void
  visible: boolean
  onVisible: (visible: boolean) => void
  onRemove: () => void
  disabled?: boolean
}> = ({ checked, onChecked, kind, title, onKindChange, visible, onVisible, onRemove, disabled }) => {
  const selectValue =
    kind === 'shadow'
      ? (title.toLowerCase().includes('inner') ? 'inner' : 'drop')
      : (title.toLowerCase().includes('backdrop') ? 'backdrop' : 'layer')

  return (
    <div className="grid grid-cols-[26px_1fr_34px_34px] gap-2 items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChecked(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 accent-blue-600"
        title={checked ? 'Disable' : 'Enable'}
      />
      <div className="h-9 bg-neutral-900 border border-neutral-700 rounded-md flex items-center px-2">
        <select
          value={selectValue}
          onChange={(e) => onKindChange(e.target.value)}
          disabled={disabled}
          className="bg-transparent w-full text-sm text-neutral-200 outline-none"
        >
          {kind === 'shadow' ? (
            <>
              <option value="drop">Drop shadow</option>
              <option value="inner">Inner shadow</option>
            </>
          ) : (
            <>
              <option value="layer">Layer Blur</option>
              <option value="backdrop">Backdrop Blur</option>
            </>
          )}
        </select>
      </div>
      <button
        type="button"
        className="h-9 w-9 rounded-md border border-neutral-700 bg-neutral-900 flex items-center justify-center hover:bg-neutral-800 disabled:opacity-50"
        onClick={() => onVisible(!visible)}
        disabled={disabled}
        title={visible ? 'Hide' : 'Show'}
      >
        {visible ? <Eye size={16} className="text-neutral-300" /> : <EyeOff size={16} className="text-neutral-500" />}
      </button>
      <button
        type="button"
        className="h-9 w-9 rounded-md border border-neutral-700 bg-neutral-900 flex items-center justify-center hover:bg-neutral-800 disabled:opacity-50"
        onClick={onRemove}
        disabled={disabled}
        title="Remove"
      >
        <Minus size={16} className="text-neutral-400" />
      </button>
    </div>
  )
}

const KeyValueRow: React.FC<{
  k: string
  v: string
  overridden: boolean
  onChange: (value: string) => void
  onClear?: () => void
  disabled?: boolean
}> = ({ k, v, overridden, onChange, onClear, disabled }) => (
  <div className="grid grid-cols-[140px_1fr_auto] gap-2 items-center">
    <div className={`text-[11px] ${overridden ? 'text-blue-300' : 'text-neutral-400'} break-words`}>{k}</div>
    <TextInput value={v} onChange={onChange} disabled={disabled} />
    {onClear ? (
      <button type="button" className="h-7 w-7 flex items-center justify-center rounded hover:bg-neutral-900 disabled:opacity-50" onClick={onClear} title="Clear override" disabled={disabled}>
        <X size={12} className="text-neutral-500 hover:text-white" />
      </button>
    ) : (
      <div className="h-7 w-7" />
    )}
  </div>
)

export default PropertiesPanel
