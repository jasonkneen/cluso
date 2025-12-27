# Icons Setup - TODO

## ✅ Created
- `public/icons/icon.svg` - Placeholder SVG logo (gradient C with code brackets)
- `public/manifest.json` - PWA manifest

## ❌ Still Needed

### 1. PNG Icons for PWA
Create these from the SVG or your own design:
```bash
# Install imagemagick if needed
brew install imagemagick

# Convert SVG to PNGs
convert -background none -density 1200 public/icons/icon.svg -resize 192x192 public/icons/icon-192.png
convert -background none -density 1200 public/icons/icon.svg -resize 512x512 public/icons/icon-512.png
convert -background none -density 1200 public/icons/icon.svg -resize 1024x1024 public/icon.png
```

### 2. Electron Desktop Icons
```bash
# Create build directory
mkdir -p build

# Generate .icns for macOS
npm install -g electron-icon-builder
electron-icon-builder --input=./public/icon.png --output=./build --flatten

# Or use png2icons
npm install -g png2icons
png2icons public/icon.png build --icns --ico
```

This will create:
- `build/icon.icns` - macOS
- `build/icon.ico` - Windows
- `build/icon.png` - Linux

### 3. Quick Option - Use Online Converters
If you don't want to install tools:
1. Export the SVG to 1024x1024 PNG using Figma/Sketch/browser
2. Use https://cloudconvert.com/png-to-icns for macOS
3. Use https://cloudconvert.com/png-to-ico for Windows

## Files Structure
```
ai-cluso/
├── public/
│   ├── icon.png                # 1024x1024 (NEEDED)
│   ├── manifest.json           # ✅ Created
│   └── icons/
│       ├── icon.svg            # ✅ Created (placeholder)
│       ├── icon-192.png        # NEEDED
│       └── icon-512.png        # NEEDED
└── build/
    ├── icon.icns               # NEEDED (macOS)
    ├── icon.ico                # NEEDED (Windows)
    └── icon.png                # NEEDED (Linux 512x512)
```

## Design Tips for the Icon

The current SVG placeholder has:
- Blue-to-purple gradient background
- White "C" letter
- Code bracket symbols on sides

**Improve it by:**
- Making the "C" more distinctive
- Adding your brand colors
- Simplifying for small sizes
- Testing at 16x16 to ensure it's readable

## Alternative: Use AI to Generate
```bash
# Use DALL-E or Midjourney with prompt:
"Modern app icon for AI coding assistant, letter C,
code brackets, gradient blue purple, minimalist,
flat design, no text, square format"
```

## Once Icons Are Ready

Test them:
```bash
# Development
npm run electron:dev
# Check if dock icon appears

# Production build
npm run electron:build:mac
# Check app icon in Finder
```
