---
title: "Drag and Drop Image Attachments"
slug: "drag-drop-image-attachments"
category: "ui-features"
tags: ["drag-drop", "images", "attachments", "chat", "react", "file-handling"]
severity: "enhancement"
component: "App.tsx"
status: "completed"
date_documented: "2025-12-01"
commit_hash: "667e43e"
---

# Drag and Drop Image Attachments

## Problem

The chat interface only supported single image attachment via file picker button. Users could not:
- Drag and drop images directly onto the chat area
- Attach multiple images at once
- See visual feedback when dragging files

## Solution

Implemented multi-image drag-and-drop with a max of 5 images per message.

### State Changes

```typescript
// Before: Single image
const [attachedImage, setAttachedImage] = useState<string | null>(null);

// After: Multiple images with drag state
const [attachedImages, setAttachedImages] = useState<string[]>([]);
const [isDraggingOver, setIsDraggingOver] = useState(false);
```

### Event Handlers

#### Drag Over Handler
```typescript
const handleDragOver = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer.types.includes('Files')) {
    setIsDraggingOver(true);
  }
}, []);
```

#### Drop Handler
```typescript
const handleDrop = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDraggingOver(false);

  const files = Array.from(e.dataTransfer.files);
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  const filesToProcess = imageFiles.slice(0, 5 - attachedImages.length);

  filesToProcess.forEach(file => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setAttachedImages(prev => {
        if (prev.length >= 5) return prev;
        return [...prev, base64];
      });
    };
    reader.readAsDataURL(file);
  });
}, [attachedImages.length]);
```

#### Remove Image Handler
```typescript
const removeAttachedImage = useCallback((index: number) => {
  setAttachedImages(prev => prev.filter((_, i) => i !== index));
}, []);
```

### UI Components

#### Drop Zone Container
```tsx
<div
  className={`rounded-2xl border relative ${isDraggingOver ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
>
  {/* Drop zone overlay */}
  {isDraggingOver && (
    <div className="absolute inset-0 bg-blue-500/10 rounded-2xl flex items-center justify-center z-10 pointer-events-none">
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-100 text-blue-600">
        <Image size={20} />
        <span className="font-medium">Drop images here (max 5)</span>
      </div>
    </div>
  )}
```

#### Image Previews
```tsx
{attachedImages.length > 0 && (
  <div className="px-3 pt-2 flex flex-wrap gap-2">
    {attachedImages.map((img, idx) => (
      <div key={idx} className="relative group rounded-lg overflow-hidden border">
        <img src={img} alt={`Attachment ${idx + 1}`} className="h-16 w-16 object-cover" />
        <button
          onClick={() => removeAttachedImage(idx)}
          className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100"
        >
          <X size={12} />
        </button>
      </div>
    ))}
  </div>
)}
```

### Message Processing

All attached images are included in the message content:

```typescript
attachedImages.forEach(img => {
  const base64Data = img.split(',')[1];
  const mimeType = img.split(';')[0].split(':')[1] || 'image/png';
  userContentParts.push({
    type: 'image',
    image: { base64Data, mimeType },
  });
});

// Clear after sending
setAttachedImages([]);
```

## Key Patterns

### Max Image Enforcement
- Pre-slice before processing: `files.slice(0, 5 - attachedImages.length)`
- Double-check in state update: `if (prev.length >= 5) return prev`

### Drag and Drop Events
```typescript
e.preventDefault();      // Required to enable drop
e.stopPropagation();     // Stop bubbling to parent
e.dataTransfer.files;    // Access dropped files
```

### Base64 Data URL Parsing
```typescript
// Format: data:image/png;base64,iVBORw0KGgo...
const mimeType = img.split(';')[0].split(':')[1];  // image/png
const base64Data = img.split(',')[1];               // iVBORw0KGgo...
```

## Prevention Strategies

1. **Validate file types** - Only accept `image/*` MIME types
2. **Enforce limits early** - Check max 5 before processing
3. **Visual feedback** - Ring effect and overlay during drag
4. **Clean up state** - Clear images array after message submission

## Test Cases

| Scenario | Expected Result |
|----------|-----------------|
| Drop single image | Appears in preview |
| Drop 6 images | Only first 5 accepted |
| Drop non-image file | Ignored |
| Remove image | Updates array correctly |
| Submit message | All images included, then cleared |
| Drag while at max 5 | No new images added |

## Files Modified

- `App.tsx`: +115 lines, -18 lines (net +97)

## Related Documentation

- `components/tabs/NotesTab.tsx` - Similar image paste/drop pattern
- `components/tabs/KanbanTab.tsx` - Drag and drop for cards
- `utils/iframe-injection.ts` - Screenshot capture system
