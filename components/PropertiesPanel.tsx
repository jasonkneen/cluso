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
  FlipHorizontal2,
  FlipVertical2,
  Grid3X3,
  LayoutTemplate,
  Plus,
  RotateCcw,
  ChevronDown,
} from 'lucide-react'
import type { ElementStyles } from '../types/elementStyles'
import { Textarea } from './ui/textarea'

interface PropertiesPanelProps {
  styles: ElementStyles
  onChange: (key: keyof ElementStyles, value: ElementStyles[keyof ElementStyles]) => void
  isDarkMode: boolean
  panelBg: string
  panelBorder: string
  embedded?: boolean
  selectedElementName?: string | null
  selectedElementNumber?: number | null
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
}) => {
  const [activeTab, setActiveTab] = useState<'design' | 'css' | 'tailwind'>('design')
  const hasSelection = !!selectedElementNumber

  const cssContent = useMemo(() => {
    const transform = `translate(${styles.x}px, ${styles.y}px) rotate(${styles.rotation}deg)`
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

  /* Appearance */
  background-color: ${styles.backgroundColor};
  opacity: ${styles.opacity / 100};
  border-radius: ${styles.borderRadius}px;
}
`.trim()
  }, [styles])

  const handleNumber = (key: keyof ElementStyles) => (value: number) => {
    onChange(key, value as ElementStyles[keyof ElementStyles])
  }

  const handleText = (key: keyof ElementStyles) => (value: string) => {
    onChange(key, value as ElementStyles[keyof ElementStyles])
  }

  return (
    <div
      className={[
        'flex flex-col h-full',
        embedded ? '' : 'border rounded-xl overflow-hidden',
      ].join(' ')}
      style={embedded ? undefined : { backgroundColor: panelBg, borderColor: panelBorder }}
    >
      {/* Tab Header */}
      <div className="p-2 border-b" style={{ borderColor: panelBorder }}>
        <div
          className={[
            'flex items-center p-1 rounded-md border',
            isDarkMode ? 'bg-neutral-900' : 'bg-stone-100',
          ].join(' ')}
          style={{ borderColor: panelBorder }}
        >
          {(['Design', 'CSS', 'Tailwind'] as const).map((tab) => {
            const tabKey = tab.toLowerCase() as 'design' | 'css' | 'tailwind'
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
                <ToggleButton className="w-7 h-7" title="Rotate" disabled>
                  <RotateCcw size={12} />
                </ToggleButton>
                <ToggleButton className="w-7 h-7" title="Flip horizontal" disabled>
                  <FlipHorizontal2 size={12} />
                </ToggleButton>
                <ToggleButton className="w-7 h-7" title="Flip vertical" disabled>
                  <FlipVertical2 size={12} />
                </ToggleButton>
              </div>
            </div>
          </Section>

          <Section title="Layout" defaultOpen isDarkMode={isDarkMode} panelBorder={panelBorder}>
            <div className="mb-3">
              <div className="text-[10px] text-neutral-500 font-medium uppercase mb-1.5">Flow</div>
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
              <div className="text-[10px] text-neutral-500 font-medium uppercase mb-1.5">Dimensions</div>
              <div className="grid grid-cols-2 gap-2">
                <NumberInput label="W" value={styles.width} onChange={handleNumber('width')} suffix="px" disabled={!hasSelection} />
                <NumberInput label="H" value={styles.height} onChange={handleNumber('height')} suffix="px" disabled={!hasSelection} />
              </div>
            </div>

            {styles.display === 'flex' && (
              <div className="mb-3">
                <div className="text-[10px] text-neutral-500 font-medium uppercase mb-1.5">Align</div>
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
                  <span className="text-[10px] text-neutral-500 font-medium uppercase w-8">Gap</span>
                  <NumberInput value={styles.gap} onChange={handleNumber('gap')} suffix="px" disabled={!hasSelection} />
                </div>
              </div>
            )}

            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] text-neutral-500 font-medium uppercase">Padding</div>
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
              <Checkbox label="Clip content" />
              <Checkbox label="Border box" checked />
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
                <div className="text-[10px] text-neutral-500 font-medium uppercase mb-1.5">Opacity</div>
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
                <div className="text-[10px] text-neutral-500 font-medium uppercase mb-1.5">Corner Radius</div>
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
            actions={<Plus size={12} className="text-neutral-500 hover:text-white cursor-pointer" />}
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
            <div className="text-xs text-neutral-500 p-1">Text properties available for text nodes.</div>
          </Section>

          <Section title="Border" isDarkMode={isDarkMode} panelBorder={panelBorder} actions={<Plus size={12} className="text-neutral-500 hover:text-white cursor-pointer" />} />
          <Section title="Shadow & Blur" isDarkMode={isDarkMode} panelBorder={panelBorder} actions={<Plus size={12} className="text-neutral-500 hover:text-white cursor-pointer" />} />
        </div>
      ) : activeTab === 'tailwind' ? (
        <div className="flex-1 p-3 overflow-auto">
          <div className={`text-xs mb-2 ${isDarkMode ? 'text-neutral-500' : 'text-stone-500'}`}>
            Edits `className` on the selected element (live in the webview).
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
        <div className="flex-1 p-3 font-mono text-xs text-blue-300 overflow-auto select-text">
          <pre className="whitespace-pre-wrap">{cssContent}</pre>
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
    {label && <div className="text-neutral-500">{label}</div>}
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

const Checkbox: React.FC<{ label: string; checked?: boolean }> = ({ label, checked }) => (
  <label className="flex items-center gap-2 cursor-pointer group select-none">
    <div
      className={[
        'w-3 h-3 rounded-[2px] border flex items-center justify-center',
        checked ? 'bg-blue-600 border-blue-600' : 'border-neutral-600 bg-neutral-900 group-hover:border-neutral-500',
      ].join(' ')}
    >
      {checked && <ChevronDown size={10} className="text-white rotate-0" strokeWidth={4} />}
    </div>
    <span className="text-xs text-neutral-400 group-hover:text-neutral-200">{label}</span>
  </label>
)

export default PropertiesPanel
