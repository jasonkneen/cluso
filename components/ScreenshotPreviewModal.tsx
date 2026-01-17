import React from 'react'
import { X } from 'lucide-react'

interface ScreenshotPreviewModalProps {
  screenshot: string
  onClose: () => void
}

export function ScreenshotPreviewModal({
  screenshot,
  onClose,
}: ScreenshotPreviewModalProps): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] p-4">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
          title="Close preview"
        >
          <X size={24} />
        </button>
        <img
          src={screenshot}
          alt="Screenshot preview"
          className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  )
}
