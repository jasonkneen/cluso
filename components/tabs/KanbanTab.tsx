import React, { useState, useCallback } from 'react'
import { Plus, X, GripVertical, Pencil } from 'lucide-react'
import { KanbanColumn, KanbanCard } from '../../types/tab'

interface KanbanTabProps {
  columns: KanbanColumn[]
  boardTitle: string
  isDarkMode: boolean
  onUpdateColumns: (columns: KanbanColumn[]) => void
  onUpdateTitle: (title: string) => void
}

export function KanbanTab({ columns, boardTitle, isDarkMode, onUpdateColumns, onUpdateTitle }: KanbanTabProps) {
  const [draggedCard, setDraggedCard] = useState<{ card: KanbanCard; fromColumnId: string } | null>(null)
  const [editingColumnTitle, setEditingColumnTitle] = useState<string | null>(null)
  const [editingBoardTitle, setEditingBoardTitle] = useState(false)
  const [newCardColumn, setNewCardColumn] = useState<string | null>(null)
  const [newCardTitle, setNewCardTitle] = useState('')

  // Add a new card to a column
  const handleAddCard = useCallback((columnId: string) => {
    if (!newCardTitle.trim()) {
      setNewCardColumn(null)
      return
    }

    const newCard: KanbanCard = {
      id: `card-${Date.now()}`,
      title: newCardTitle.trim(),
      createdAt: new Date().toISOString(),
    }

    const updatedColumns = columns.map(col =>
      col.id === columnId
        ? { ...col, cards: [...col.cards, newCard] }
        : col
    )

    onUpdateColumns(updatedColumns)
    setNewCardTitle('')
    setNewCardColumn(null)
  }, [columns, newCardTitle, onUpdateColumns])

  // Delete a card
  const handleDeleteCard = useCallback((columnId: string, cardId: string) => {
    const updatedColumns = columns.map(col =>
      col.id === columnId
        ? { ...col, cards: col.cards.filter(c => c.id !== cardId) }
        : col
    )
    onUpdateColumns(updatedColumns)
  }, [columns, onUpdateColumns])

  // Update column title
  const handleUpdateColumnTitle = useCallback((columnId: string, title: string) => {
    const updatedColumns = columns.map(col =>
      col.id === columnId ? { ...col, title } : col
    )
    onUpdateColumns(updatedColumns)
    setEditingColumnTitle(null)
  }, [columns, onUpdateColumns])

  // Update board title
  const handleUpdateBoardTitle = useCallback((title: string) => {
    if (title.trim()) {
      onUpdateTitle(title.trim())
    }
    setEditingBoardTitle(false)
  }, [onUpdateTitle])

  // Drag and drop handlers
  const handleDragStart = useCallback((card: KanbanCard, fromColumnId: string) => {
    setDraggedCard({ card, fromColumnId })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback((toColumnId: string) => {
    if (!draggedCard) return

    if (draggedCard.fromColumnId === toColumnId) {
      setDraggedCard(null)
      return
    }

    const updatedColumns = columns.map(col => {
      if (col.id === draggedCard.fromColumnId) {
        return { ...col, cards: col.cards.filter(c => c.id !== draggedCard.card.id) }
      }
      if (col.id === toColumnId) {
        return { ...col, cards: [...col.cards, draggedCard.card] }
      }
      return col
    })

    onUpdateColumns(updatedColumns)
    setDraggedCard(null)
  }, [columns, draggedCard, onUpdateColumns])

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden ${isDarkMode ? 'bg-neutral-800' : 'bg-white'}`}>
      {/* Header with editable board title */}
      <div className={`px-4 py-3 border-b ${isDarkMode ? 'border-neutral-700' : 'border-stone-200'}`}>
        {editingBoardTitle ? (
          <input
            type="text"
            defaultValue={boardTitle}
            autoFocus
            onBlur={(e) => handleUpdateBoardTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleUpdateBoardTitle(e.currentTarget.value)
              }
              if (e.key === 'Escape') {
                setEditingBoardTitle(false)
              }
            }}
            className={`text-lg font-semibold px-2 py-1 rounded w-full max-w-md ${
              isDarkMode
                ? 'bg-neutral-700 text-white border-neutral-600'
                : 'bg-stone-50 text-stone-800 border-stone-200'
            } border outline-none focus:ring-2 focus:ring-blue-500`}
          />
        ) : (
          <div className="flex items-center gap-2 group">
            <h2
              className={`text-lg font-semibold cursor-pointer ${isDarkMode ? 'text-white' : 'text-stone-800'}`}
              onClick={() => setEditingBoardTitle(true)}
            >
              {boardTitle}
            </h2>
            <button
              onClick={() => setEditingBoardTitle(true)}
              className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                isDarkMode ? 'hover:bg-neutral-700 text-neutral-400' : 'hover:bg-stone-200 text-stone-400'
              }`}
              title="Edit board name"
            >
              <Pencil size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Columns */}
      <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
        {columns.map(column => (
          <div
            key={column.id}
            className={`flex-shrink-0 w-72 flex flex-col rounded-xl ${
              isDarkMode ? 'bg-neutral-700' : 'bg-stone-100'
            } shadow-sm`}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(column.id)}
          >
            {/* Column Header */}
            <div className={`px-3 py-2 border-b ${isDarkMode ? 'border-neutral-700' : 'border-stone-100'}`}>
              {editingColumnTitle === column.id ? (
                <input
                  type="text"
                  defaultValue={column.title}
                  autoFocus
                  onBlur={(e) => handleUpdateColumnTitle(column.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateColumnTitle(column.id, e.currentTarget.value)
                    }
                    if (e.key === 'Escape') {
                      setEditingColumnTitle(null)
                    }
                  }}
                  className={`w-full px-2 py-1 text-sm font-semibold rounded ${
                    isDarkMode
                      ? 'bg-neutral-700 text-white border-neutral-600'
                      : 'bg-stone-50 text-stone-800 border-stone-200'
                  } border outline-none focus:ring-2 focus:ring-blue-500`}
                />
              ) : (
                <div className="flex items-center justify-between">
                  <h3
                    className={`text-sm font-semibold cursor-pointer ${isDarkMode ? 'text-neutral-200' : 'text-stone-700'}`}
                    onClick={() => setEditingColumnTitle(column.id)}
                  >
                    {column.title}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    isDarkMode ? 'bg-neutral-700 text-neutral-400' : 'bg-stone-100 text-stone-500'
                  }`}>
                    {column.cards.length}
                  </span>
                </div>
              )}
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-250px)]">
              {column.cards.map(card => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={() => handleDragStart(card, column.id)}
                  className={`group p-3 rounded-lg cursor-grab active:cursor-grabbing transition-all ${
                    isDarkMode
                      ? 'bg-neutral-700 hover:bg-neutral-650 border border-neutral-600'
                      : 'bg-stone-50 hover:bg-stone-100 border border-stone-200'
                  } ${draggedCard?.card.id === card.id ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical size={14} className={`mt-0.5 opacity-0 group-hover:opacity-50 ${isDarkMode ? 'text-neutral-400' : 'text-stone-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${isDarkMode ? 'text-neutral-100' : 'text-stone-800'}`}>
                        {card.title}
                      </p>
                      {card.description && (
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-neutral-400' : 'text-stone-500'}`}>
                          {card.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteCard(column.id, card.id)}
                      className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity ${
                        isDarkMode ? 'hover:bg-neutral-600 text-neutral-400' : 'hover:bg-stone-200 text-stone-400'
                      }`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}

              {/* New Card Input */}
              {newCardColumn === column.id ? (
                <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-neutral-700' : 'bg-stone-50'}`}>
                  <textarea
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    placeholder="Enter card title..."
                    autoFocus
                    className={`w-full px-2 py-1.5 text-sm rounded resize-none ${
                      isDarkMode
                        ? 'bg-neutral-600 text-white placeholder-neutral-400 border-neutral-500'
                        : 'bg-white text-stone-800 placeholder-stone-400 border-stone-200'
                    } border outline-none focus:ring-2 focus:ring-blue-500`}
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleAddCard(column.id)
                      }
                      if (e.key === 'Escape') {
                        setNewCardColumn(null)
                        setNewCardTitle('')
                      }
                    }}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleAddCard(column.id)}
                      className="px-3 py-1 text-xs font-medium text-white bg-blue-500 rounded hover:bg-blue-600"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setNewCardColumn(null)
                        setNewCardTitle('')
                      }}
                      className={`px-3 py-1 text-xs font-medium rounded ${
                        isDarkMode ? 'text-neutral-300 hover:bg-neutral-600' : 'text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setNewCardColumn(column.id)}
                  className={`w-full p-2 text-sm flex items-center gap-2 rounded-lg transition-colors ${
                    isDarkMode
                      ? 'text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200'
                      : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'
                  }`}
                >
                  <Plus size={14} />
                  Add card
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
