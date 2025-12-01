# Drag-and-Drop Image Attachments Feature
## Prevention Strategies and Testing Guide

---

## Part 1: Prevention Strategies

### 1. File Type Validation

#### Best Practice: Whitelist Known Safe Types
```typescript
// Valid image MIME types to accept
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml'
])

// Validate file MIME type before processing
const validateFileType = (file: File): boolean => {
  return ALLOWED_IMAGE_TYPES.has(file.type)
}

// Double-check with file extension (MIME type can be spoofed)
const validateFileExtension = (file: File): boolean => {
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  return validExtensions.includes(extension)
}
```

#### Prevention Focus: Reject at Drag-Over Stage
```typescript
const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault()
  e.stopPropagation()

  // Check if dropped items are files (not other draggable content)
  const hasFiles = e.dataTransfer.types.includes('Files')

  if (hasFiles) {
    setIsDragging(true)
    e.dataTransfer.dropEffect = 'copy'
  } else {
    // Don't allow drag on non-file content
    e.dataTransfer.dropEffect = 'none'
    setIsDragging(false)
  }
}
```

#### Prevention: Validate Each File Immediately on Drop
```typescript
const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault()
  e.stopPropagation()
  setIsDragging(false)

  const droppedFiles = Array.from(e.dataTransfer.files)
  const validFiles: File[] = []
  const rejectedFiles: { name: string; reason: string }[] = []

  for (const file of droppedFiles) {
    // Reject non-images immediately
    if (!validateFileType(file)) {
      rejectedFiles.push({
        name: file.name,
        reason: `Invalid type: ${file.type || 'unknown'}`
      })
      continue
    }

    // Reject if extension doesn't match MIME type
    if (!validateFileExtension(file)) {
      rejectedFiles.push({
        name: file.name,
        reason: 'File extension does not match image type'
      })
      continue
    }

    validFiles.push(file)
  }

  // Report rejected files to user
  if (rejectedFiles.length > 0) {
    showNotification(`${rejectedFiles.length} file(s) rejected: ${rejectedFiles.map(f => f.name).join(', ')}`)
  }

  processValidFiles(validFiles)
}
```

---

### 2. Image Limit Enforcement (Max 5 Images)

#### Best Practice: Enforce Before Processing
```typescript
interface ImageAttachment {
  id: string
  file: File
  base64: string // Only after processing
  name: string
  size: number
  type: string
  preview?: string
  status: 'loading' | 'ready' | 'error'
  error?: string
}

const MAX_IMAGES = 5
const MAX_IMAGE_SIZE_MB = 10 // Per image

const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([])

const canAddMoreImages = (): boolean => {
  return attachedImages.length < MAX_IMAGES
}

const getRemainingSlots = (): number => {
  return Math.max(0, MAX_IMAGES - attachedImages.length)
}

// Check limit BEFORE processing files
const processValidFiles = (files: File[]) => {
  if (!canAddMoreImages()) {
    const remaining = getRemainingSlots()
    showError(`Maximum ${MAX_IMAGES} images allowed. ${remaining} slot(s) remaining.`)
    return
  }

  // Only process as many files as we have room for
  const filesToProcess = files.slice(0, getRemainingSlots())

  if (filesToProcess.length < files.length) {
    const rejected = files.length - filesToProcess.length
    showWarning(`Only ${filesToProcess.length} of ${files.length} images can be added. Limit is ${MAX_IMAGES} images.`)
  }

  filesToProcess.forEach(file => {
    readImageFile(file)
  })
}
```

#### Best Practice: Show Clear Feedback
```typescript
// Visual indicator of remaining slots
const ImageDropZone = () => {
  const remaining = getRemainingSlots()

  return (
    <div className={`border-2 border-dashed rounded-lg p-4 ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
      <p className="text-gray-600 font-medium">
        Drag and drop images here
      </p>
      <p className="text-sm text-gray-500">
        {attachedImages.length}/{MAX_IMAGES} images ({remaining} slot{remaining !== 1 ? 's' : ''} available)
      </p>
      {remaining === 0 && (
        <p className="text-red-500 text-sm font-semibold">Maximum images reached</p>
      )}
      <p className="text-xs text-gray-400 mt-2">
        Supported: JPG, PNG, WebP, GIF | Max 10 MB each
      </p>
    </div>
  )
}
```

---

### 3. FileReader Memory Management

#### Prevention: Always Use Try-Catch with Cleanup
```typescript
interface FileReaderState {
  reader: FileReader | null
  timeout: number | null
}

const fileReaderRef = useRef<FileReaderState>({ reader: null, timeout: null })

const readImageFile = async (file: File) => {
  // Check file size BEFORE reading
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    showError(`Image "${file.name}" exceeds ${MAX_IMAGE_SIZE_MB}MB limit`)
    return
  }

  const reader = new FileReader()

  // Store reader reference for cleanup
  fileReaderRef.current.reader = reader

  // Set timeout to prevent hanging reads
  fileReaderRef.current.timeout = window.setTimeout(() => {
    if (fileReaderRef.current.reader) {
      fileReaderRef.current.reader.abort()
      console.error('[FileReader] Read timeout for file:', file.name)
      setAttachedImages(prev => prev.filter(img => img.file.name !== file.name))
    }
  }, 30000) // 30 second timeout

  reader.onload = (e) => {
    try {
      // Clear timeout on success
      if (fileReaderRef.current.timeout) {
        clearTimeout(fileReaderRef.current.timeout)
        fileReaderRef.current.timeout = null
      }

      const base64 = e.target?.result as string

      if (!base64) {
        throw new Error('Failed to read file')
      }

      // Add with status 'ready'
      const attachment: ImageAttachment = {
        id: crypto.randomUUID(),
        file,
        base64,
        name: file.name,
        size: file.size,
        type: file.type,
        preview: base64,
        status: 'ready'
      }

      setAttachedImages(prev => [...prev, attachment])
    } catch (error) {
      console.error('[FileReader] Error reading file:', file.name, error)
      setAttachedImages(prev =>
        prev.map(img =>
          img.file.name === file.name
            ? { ...img, status: 'error', error: 'Failed to read file' }
            : img
        )
      )
    }
  }

  reader.onerror = () => {
    // Clear timeout on error
    if (fileReaderRef.current.timeout) {
      clearTimeout(fileReaderRef.current.timeout)
      fileReaderRef.current.timeout = null
    }

    console.error('[FileReader] Error reading file:', file.name, reader.error)
    setAttachedImages(prev =>
      prev.map(img =>
        img.file.name === file.name
          ? { ...img, status: 'error', error: reader.error?.message || 'Unknown error' }
          : img
      )
    )
  }

  reader.onabort = () => {
    console.warn('[FileReader] Read aborted for file:', file.name)
    setAttachedImages(prev =>
      prev.filter(img => img.file.name !== file.name)
    )
  }

  try {
    reader.readAsDataURL(file)
  } catch (error) {
    console.error('[FileReader] Failed to start reading:', file.name, error)
  }
}

// Cleanup on component unmount
useEffect(() => {
  return () => {
    // Abort any in-progress reads
    if (fileReaderRef.current.reader?.readyState === FileReader.LOADING) {
      fileReaderRef.current.reader.abort()
    }

    // Clear timeout
    if (fileReaderRef.current.timeout) {
      clearTimeout(fileReaderRef.current.timeout)
    }

    // Clear stored reference
    fileReaderRef.current = { reader: null, timeout: null }

    // Clear base64 data from state (garbage collection hint)
    setAttachedImages([])
  }
}, [])
```

#### Prevention: Monitor Memory During Reading
```typescript
// Add performance monitoring
const startMemoryMonitoring = () => {
  if (!performance.memory) return

  const initialMemory = performance.memory.usedJSHeapSize
  console.debug('[Memory] Initial heap:', (initialMemory / 1024 / 1024).toFixed(2) + 'MB')

  return () => {
    const finalMemory = performance.memory.usedJSHeapSize
    const increase = finalMemory - initialMemory
    console.debug('[Memory] Final heap:', (finalMemory / 1024 / 1024).toFixed(2) + 'MB')
    console.debug('[Memory] Increase:', (increase / 1024 / 1024).toFixed(2) + 'MB')
  }
}
```

---

### 4. Large Image Performance Prevention

#### Best Practice: Compress Before Sending
```typescript
const compressImage = (
  base64: string,
  maxWidth: number = 1280,
  maxHeight: number = 720,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      const canvas = document.createElement('canvas')

      // Calculate scaled dimensions
      let { width, height } = img
      const aspectRatio = width / height

      if (width > maxWidth) {
        width = maxWidth
        height = Math.round(width / aspectRatio)
      }
      if (height > maxHeight) {
        height = maxHeight
        width = Math.round(height * aspectRatio)
      }

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      // Convert to compressed base64
      const compressed = canvas.toDataURL('image/jpeg', quality)

      // Clean up
      canvas.width = 0
      canvas.height = 0

      resolve(compressed)
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    img.src = base64
  })
}

// Use in image processing
const processImageForSending = async (attachment: ImageAttachment) => {
  try {
    const compressed = await compressImage(attachment.base64)
    const originalSize = (attachment.size / 1024 / 1024).toFixed(2)
    const compressedSize = (compressed.length / 1024 / 1024).toFixed(2)

    console.debug(`[Compression] ${originalSize}MB → ${compressedSize}MB`)

    return compressed
  } catch (error) {
    console.error('[Compression] Failed to compress image:', error)
    // Fall back to original
    return attachment.base64
  }
}
```

---

### 5. Message Submission Cleanup

#### Best Practice: Clear State After Sending
```typescript
interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  attachments?: Array<{
    id: string
    data: string // base64
    type: string
    name: string
  }>
}

const sendMessageWithImages = async () => {
  if (!messageText.trim() && attachedImages.length === 0) {
    showError('Enter a message or attach images')
    return
  }

  try {
    // Build message with attachments
    const attachmentData = await Promise.all(
      attachedImages.map(async (img) => ({
        id: img.id,
        data: await processImageForSending(img),
        type: img.type,
        name: img.name
      }))
    )

    const message: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      attachments: attachmentData.length > 0 ? attachmentData : undefined
    }

    // Send to API
    await sendMessage(message)

    // CRITICAL: Clear state ONLY after successful send
    setMessageText('')
    setAttachedImages([])

  } catch (error) {
    console.error('[Message] Failed to send:', error)
    showError('Failed to send message. Please try again.')
    // DO NOT clear state on error - user can retry
  }
}
```

#### Prevention: Handle Message Failures Gracefully
```typescript
// Never clear images if message fails to send
const handleSendError = (error: Error) => {
  console.error('[Message] Send failed:', error)

  // Images remain for user to retry
  setIsLoading(false)
  showError(`Failed to send message: ${error.message}`)

  // Offer retry option
  if (error.message.includes('network')) {
    showRetryButton(() => sendMessageWithImages())
  }
}
```

---

## Part 2: Comprehensive Test Cases

### Test Suite: Image Attachment Feature

#### Test 1: Basic Image Drop and Preview
```typescript
describe('Image Drop and Preview', () => {
  it('should add single dropped image to preview', async () => {
    const file = new File(['image content'], 'test.jpg', { type: 'image/jpeg' })

    // Simulate drag and drop
    fireEvent.dragOver(dropZone)
    expect(dropZone).toHaveClass('border-blue-500')

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] }
    })

    // Wait for FileReader
    await waitFor(() => {
      const preview = screen.getByAltText('test.jpg')
      expect(preview).toBeInTheDocument()
    })

    // Check attachment added to state
    expect(screen.getByText('1/5 images')).toBeInTheDocument()
  })

  it('should display image preview with dimensions', async () => {
    const file = new File(['image content'], 'test.png', { type: 'image/png' })

    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      const img = screen.getByAltText('test.png') as HTMLImageElement
      expect(img).toHaveAttribute('src')
      expect(img.src).toMatch(/^data:image/)
    })
  })

  it('should show file size in preview', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 1024 * 100 }) // 100 KB

    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('100.0 KB')).toBeInTheDocument()
    })
  })
})
```

#### Test 2: File Type Validation
```typescript
describe('File Type Validation', () => {
  it('should reject non-image files silently', async () => {
    const textFile = new File(['text content'], 'document.txt', { type: 'text/plain' })

    fireEvent.drop(dropZone, { dataTransfer: { files: [textFile] } })

    // No attachment should be added
    await waitFor(() => {
      expect(screen.getByText('0/5 images')).toBeInTheDocument()
    })

    // Error notification shown
    expect(screen.getByText(/document\.txt.*rejected/i)).toBeInTheDocument()
  })

  it('should reject files with spoofed MIME type', async () => {
    // File with .txt extension but image MIME type
    const file = new File(['text content'], 'fake.txt', { type: 'image/jpeg' })

    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/extension does not match/i)).toBeInTheDocument()
      expect(screen.getByText('0/5 images')).toBeInTheDocument()
    })
  })

  it('should accept all valid image types', async () => {
    const validTypes = [
      { name: 'test.jpg', type: 'image/jpeg' },
      { name: 'test.png', type: 'image/png' },
      { name: 'test.webp', type: 'image/webp' },
      { name: 'test.gif', type: 'image/gif' },
      { name: 'test.svg', type: 'image/svg+xml' }
    ]

    for (const { name, type } of validTypes) {
      const file = new File(['content'], name, { type })
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })
    }

    await waitFor(() => {
      expect(screen.getByText('5/5 images')).toBeInTheDocument()
    })
  })

  it('should not show drag effect for non-file drag operations', () => {
    fireEvent.dragOver(dropZone, {
      dataTransfer: { types: ['text/html'] }
    })

    expect(dropZone).not.toHaveClass('border-blue-500')
  })
})
```

#### Test 3: Image Limit Enforcement (Max 5)
```typescript
describe('Image Limit (Max 5)', () => {
  it('should accept up to 5 images', async () => {
    const files = Array.from({ length: 5 }).map((_, i) =>
      new File(['content'], `image${i}.jpg`, { type: 'image/jpeg' })
    )

    fireEvent.drop(dropZone, { dataTransfer: { files } })

    await waitFor(() => {
      expect(screen.getByText('5/5 images')).toBeInTheDocument()
    })
  })

  it('should reject 6th image and show error', async () => {
    // First add 5 images
    const firstFive = Array.from({ length: 5 }).map((_, i) =>
      new File(['content'], `image${i}.jpg`, { type: 'image/jpeg' })
    )
    fireEvent.drop(dropZone, { dataTransfer: { files: firstFive } })

    // Try to add 6th
    const sixthImage = new File(['content'], 'image5.jpg', { type: 'image/jpeg' })
    fireEvent.drop(dropZone, { dataTransfer: { files: [sixthImage] } })

    await waitFor(() => {
      expect(screen.getByText(/only 0 of 1 images/i)).toBeInTheDocument()
      expect(screen.getByText('5/5 images')).toBeInTheDocument()
    })
  })

  it('should show remaining slots accurately', async () => {
    const files = Array.from({ length: 2 }).map((_, i) =>
      new File(['content'], `image${i}.jpg`, { type: 'image/jpeg' })
    )

    fireEvent.drop(dropZone, { dataTransfer: { files } })

    await waitFor(() => {
      expect(screen.getByText('2/5 images')).toBeInTheDocument()
      expect(screen.getByText('3 slots available')).toBeInTheDocument()
    })
  })

  it('should cap dropped files when over limit', async () => {
    // Add 3 images first
    const firstThree = Array.from({ length: 3 }).map((_, i) =>
      new File(['content'], `image${i}.jpg`, { type: 'image/jpeg' })
    )
    fireEvent.drop(dropZone, { dataTransfer: { files: firstThree } })

    // Try to drop 5 more (should only take 2)
    const fiveImages = Array.from({ length: 5 }).map((_, i) =>
      new File(['content'], `image${i + 3}.jpg`, { type: 'image/jpeg' })
    )
    fireEvent.drop(dropZone, { dataTransfer: { files: fiveImages } })

    await waitFor(() => {
      expect(screen.getByText('5/5 images')).toBeInTheDocument()
      expect(screen.getByText(/only 2 of 5 images/i)).toBeInTheDocument()
    })
  })

  it('should disable drop zone when at max', async () => {
    const files = Array.from({ length: 5 }).map((_, i) =>
      new File(['content'], `image${i}.jpg`, { type: 'image/jpeg' })
    )

    fireEvent.drop(dropZone, { dataTransfer: { files } })

    await waitFor(() => {
      expect(screen.getByText('Maximum images reached')).toBeInTheDocument()
    })
  })
})
```

#### Test 4: Remove Image from Preview
```typescript
describe('Remove Image', () => {
  it('should remove image when delete button clicked', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })

    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      const deleteBtn = screen.getByAltText('Remove test.jpg')
      fireEvent.click(deleteBtn)
    })

    await waitFor(() => {
      expect(screen.getByText('0/5 images')).toBeInTheDocument()
      expect(screen.queryByAltText('test.jpg')).not.toBeInTheDocument()
    })
  })

  it('should update remaining slots after removal', async () => {
    const files = Array.from({ length: 5 }).map((_, i) =>
      new File(['content'], `image${i}.jpg`, { type: 'image/jpeg' })
    )

    fireEvent.drop(dropZone, { dataTransfer: { files } })

    await waitFor(() => {
      expect(screen.getByText('5/5 images')).toBeInTheDocument()
    })

    // Remove one
    const deleteBtn = screen.getAllByAltText(/Remove/)[0]
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(screen.getByText('4/5 images')).toBeInTheDocument()
      expect(screen.getByText('1 slot available')).toBeInTheDocument()
    })
  })

  it('should not break state when removing image during send', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('1/5 images')).toBeInTheDocument()
    })

    // Start sending
    const sendBtn = screen.getByText('Send')
    fireEvent.click(sendBtn)

    // Try to remove image during send
    const deleteBtn = screen.getByAltText('Remove test.jpg')
    fireEvent.click(deleteBtn)

    // Should prevent or handle gracefully
    await waitFor(() => {
      // Either image stays or removal is prevented
      const attachmentCount = screen.getByText(/^\d+\/5/)
      expect(attachmentCount).toBeInTheDocument()
    })
  })
})
```

#### Test 5: Message Submission with Images
```typescript
describe('Message Submission', () => {
  it('should clear images after successful message send', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })

    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('1/5 images')).toBeInTheDocument()
    })

    // Send message
    const sendBtn = screen.getByText('Send')
    fireEvent.click(sendBtn)

    // Wait for message to be sent
    await waitFor(() => {
      expect(screen.getByText('0/5 images')).toBeInTheDocument()
    })
  })

  it('should keep images if message send fails', async () => {
    const mockSendError = new Error('Network error')
    vi.mocked(sendMessage).mockRejectedValueOnce(mockSendError)

    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })

    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('1/5 images')).toBeInTheDocument()
    })

    // Try to send
    const sendBtn = screen.getByText('Send')
    fireEvent.click(sendBtn)

    // Images should remain so user can retry
    await waitFor(() => {
      expect(screen.getByText('1/5 images')).toBeInTheDocument()
      expect(screen.getByText(/failed to send/i)).toBeInTheDocument()
    })
  })

  it('should include attachments in message payload', async () => {
    const file = new File(['image data'], 'test.jpg', { type: 'image/jpeg' })

    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('1/5 images')).toBeInTheDocument()
    })

    const messageInput = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(messageInput, { target: { value: 'Check this image' } })

    const sendBtn = screen.getByText('Send')
    fireEvent.click(sendBtn)

    await waitFor(() => {
      const sentMessage = vi.mocked(sendMessage).mock.calls[0][0]
      expect(sentMessage.attachments).toBeDefined()
      expect(sentMessage.attachments?.[0].name).toBe('test.jpg')
      expect(sentMessage.attachments?.[0].data).toMatch(/^data:image/)
    })
  })

  it('should allow message without images', async () => {
    const messageInput = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(messageInput, { target: { value: 'Just a text message' } })

    const sendBtn = screen.getByText('Send')
    fireEvent.click(sendBtn)

    await waitFor(() => {
      const sentMessage = vi.mocked(sendMessage).mock.calls[0][0]
      expect(sentMessage.content).toBe('Just a text message')
      expect(sentMessage.attachments).toBeUndefined()
    })
  })
})
```

#### Test 6: FileReader Memory Management
```typescript
describe('FileReader Cleanup', () => {
  it('should abort reader if component unmounts during read', async () => {
    const { unmount } = render(<ChatInput />)

    const file = new File(['large content'], 'big.jpg', { type: 'image/jpeg' })
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    // Unmount before read completes
    unmount()

    // Reader should be aborted
    expect(FileReader.prototype.abort).toHaveBeenCalled()
  })

  it('should clear timeout if read completes', async () => {
    vi.useFakeTimers()

    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    // Read should complete and clear timeout
    await waitFor(() => {
      expect(screen.getByText('1/5 images')).toBeInTheDocument()
    })

    // Timeout should be cleared
    expect(clearTimeout).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('should timeout read if FileReader hangs', async () => {
    vi.useFakeTimers()

    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })

    // Mock FileReader to never complete
    const mockReader = {
      readAsDataURL: vi.fn(),
      abort: vi.fn(),
      readyState: FileReader.LOADING
    }
    vi.spyOn(window, 'FileReader').mockImplementation(() => mockReader as any)

    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    // Advance time past timeout
    vi.advanceTimersByTime(31000)

    // Reader should be aborted
    expect(mockReader.abort).toHaveBeenCalled()
    expect(screen.getByText('0/5 images')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('should clear base64 data from state on unmount', async () => {
    const { unmount, rerender } = render(<ChatInput />)

    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText('1/5 images')).toBeInTheDocument()
    })

    // Unmount
    unmount()

    // State should be cleared
    const { getByText } = render(<ChatInput />)
    expect(getByText('0/5 images')).toBeInTheDocument()
  })

  it('should handle FileReader errors gracefully', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' })

    const mockReader = {
      readAsDataURL: vi.fn(),
      onerror: null as any,
      onload: null as any,
      readyState: FileReader.LOADING,
      error: new DOMException('NotReadableError')
    }

    vi.spyOn(window, 'FileReader').mockImplementation(() => {
      setTimeout(() => mockReader.onerror?.(), 0)
      return mockReader as any
    })

    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/failed to read/i)).toBeInTheDocument()
    })
  })
})
```

#### Test 7: Performance with Large Images
```typescript
describe('Large Image Performance', () => {
  it('should compress large images before sending', async () => {
    const largeFile = new File(
      [new ArrayBuffer(5 * 1024 * 1024)],
      'large.jpg',
      { type: 'image/jpeg' }
    )

    fireEvent.drop(dropZone, { dataTransfer: { files: [largeFile] } })

    await waitFor(() => {
      expect(screen.getByText('1/5 images')).toBeInTheDocument()
    })

    const sendBtn = screen.getByText('Send')
    fireEvent.click(sendBtn)

    await waitFor(() => {
      const sentMessage = vi.mocked(sendMessage).mock.calls[0][0]
      // Compressed data should be smaller than original
      expect(sentMessage.attachments?.[0].data.length).toBeLessThan(
        largeFile.size * 1.5 // Allow some overhead for base64 encoding
      )
    })
  })

  it('should reject oversized individual images', async () => {
    const hugeFile = new File(
      [new ArrayBuffer(15 * 1024 * 1024)],
      'huge.jpg',
      { type: 'image/jpeg' }
    )
    Object.defineProperty(hugeFile, 'size', { value: 15 * 1024 * 1024 })

    fireEvent.drop(dropZone, { dataTransfer: { files: [hugeFile] } })

    await waitFor(() => {
      expect(screen.getByText(/exceeds.*10MB/i)).toBeInTheDocument()
      expect(screen.getByText('0/5 images')).toBeInTheDocument()
    })
  })
})
```

#### Test 8: Drag and Drop UX
```typescript
describe('Drag and Drop UX', () => {
  it('should show visual feedback during drag', () => {
    fireEvent.dragOver(dropZone)

    expect(dropZone).toHaveClass('border-blue-500')
    expect(dropZone).toHaveClass('bg-blue-50')
  })

  it('should remove visual feedback when leaving drop zone', () => {
    fireEvent.dragOver(dropZone)
    expect(dropZone).toHaveClass('border-blue-500')

    fireEvent.dragLeave(dropZone)
    expect(dropZone).not.toHaveClass('border-blue-500')
  })

  it('should show prevented drop effect for non-files', () => {
    const event = new DragEvent('dragover', {
      dataTransfer: new DataTransfer()
    })
    event.dataTransfer?.setData('text/html', '<div></div>')

    fireEvent.dragOver(dropZone, { dataTransfer: event.dataTransfer })

    expect(event.dataTransfer?.dropEffect).toBe('none')
  })

  it('should show copy drop effect for files', () => {
    const event = new DragEvent('dragover', {
      dataTransfer: new DataTransfer()
    })
    event.dataTransfer?.items.add(new File([''], 'test.jpg'))

    const handler = screen.getByTestId('dropzone').onDragOver as (e: DragEvent) => void
    handler(event)

    expect(event.dataTransfer?.dropEffect).toBe('copy')
  })
})
```

---

## Prevention Checklist

- [ ] **File Type Validation**
  - [ ] Whitelist allowed MIME types before processing
  - [ ] Double-check file extension matches MIME type
  - [ ] Reject files at drag-over stage if not valid
  - [ ] Show clear error messages for rejected files

- [ ] **Limit Enforcement**
  - [ ] Check MAX_IMAGES (5) before processing any files
  - [ ] Cap dropped files to available slots
  - [ ] Show remaining slots prominently
  - [ ] Disable drop zone at max capacity

- [ ] **FileReader Management**
  - [ ] Use try-catch for all FileReader operations
  - [ ] Set 30-second timeout on reads
  - [ ] Store reader reference for cleanup
  - [ ] Abort on component unmount
  - [ ] Clear timeout on success/error

- [ ] **Performance**
  - [ ] Enforce max 10 MB per image
  - [ ] Compress large images before sending
  - [ ] Monitor memory usage during reads
  - [ ] Dispose of canvas after compression

- [ ] **Message Submission**
  - [ ] Only clear state after successful send
  - [ ] Keep attachments on send failure for retry
  - [ ] Handle network errors gracefully
  - [ ] Show feedback during processing

---

## Testing Checklist

- [ ] **Acceptance Tests**
  - [ ] Single image drop and preview
  - [ ] File type validation (all valid types)
  - [ ] File type rejection (invalid types)
  - [ ] Max 5 images enforcement
  - [ ] 6th image rejection with error
  - [ ] Image removal from preview
  - [ ] Message send with attachments
  - [ ] Message send without attachments
  - [ ] Images cleared after successful send
  - [ ] Images retained after send failure

- [ ] **Edge Cases**
  - [ ] Drag non-file content (should not attach)
  - [ ] Drop 10 files (should cap to 5)
  - [ ] FileReader timeout (>30s)
  - [ ] Component unmount during read
  - [ ] Memory leak detection
  - [ ] Large image compression
  - [ ] 15 MB image rejection
  - [ ] Rapid drag-drop-drag cycles
  - [ ] Network error on send

- [ ] **Accessibility**
  - [ ] Keyboard navigation for remove buttons
  - [ ] ARIA labels on drop zone
  - [ ] Error messages announced
  - [ ] Loading states indicated
  - [ ] Remaining slots announced

- [ ] **Performance**
  - [ ] No memory growth after multiple uploads
  - [ ] Compression reduces file size by 60-80%
  - [ ] <2s processing time for 10 MB image
  - [ ] No frame drops during drag operations
  - [ ] Smooth preview rendering

---

## Implementation Order

1. **Phase 1: Core Drag-Drop** (Prevent issues first)
   - File type validation
   - Image limit enforcement (max 5)
   - Basic preview rendering

2. **Phase 2: Memory Safety** (Prevent leaks)
   - FileReader with timeout
   - Cleanup on unmount
   - State management

3. **Phase 3: Performance** (Prevent slowdowns)
   - Image compression
   - Size validation
   - Memory monitoring

4. **Phase 4: Polish** (Prevent UX issues)
   - Visual feedback
   - Error messages
   - Loading states

5. **Phase 5: Testing** (Prevent regressions)
   - Unit tests for all scenarios
   - Integration tests
   - Performance tests
   - Memory leak detection

