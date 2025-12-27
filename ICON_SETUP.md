# Icon Setup Guide

## Current Status
❌ No icons configured
❌ No `public/` directory
❌ No `build/` directory

## What You Need

### 1. Create Directories
```bash
mkdir -p public
mkdir -p build
```

### 2. Icon Files Required

#### For Development & macOS App
- **`public/icon.png`** - 1024x1024 PNG (for dock icon)
- **`build/icon.icns`** - macOS icon set (for .app bundle)

#### For Windows
- **`build/icon.ico`** - Windows icon (256x256 or 512x512)

#### For Linux
- **`build/icon.png`** - 512x512 PNG

### 3. Generate Icons

#### Option 1: Use electron-icon-builder
```bash
npm install -g electron-icon-builder

# Create a 1024x1024 source image first (icon.png)
electron-icon-builder --input=./icon.png --output=./build --flatten
```

This generates:
- `build/icons/mac/icon.icns`
- `build/icons/win/icon.ico`
- `build/icons/png/*.png` (various sizes)

#### Option 2: Use Online Tool
- https://cloudconvert.com/png-to-icns (for macOS)
- https://cloudconvert.com/png-to-ico (for Windows)

#### Option 3: Manual (macOS)
```bash
# Create iconset
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png

# Generate .icns
iconutil -c icns icon.iconset -o build/icon.icns
```

### 4. Update package.json

Add icon paths to electron-builder config:

```json
{
  "build": {
    "mac": {
      "icon": "build/icon.icns"
    },
    "win": {
      "icon": "build/icon.ico"
    },
    "linux": {
      "icon": "build/icon.png"
    }
  }
}
```

### 5. File Structure

```
ai-cluso/
├── public/
│   └── icon.png          # 1024x1024 PNG (for development)
├── build/
│   ├── icon.icns         # macOS
│   ├── icon.ico          # Windows
│   └── icon.png          # Linux (512x512)
└── package.json
```

## Quick Start

1. **Create a 1024x1024 PNG icon** (your app logo)
2. **Save as `public/icon.png`**
3. **Run icon generator** (option 1 above)
4. **Update package.json** with icon paths
5. **Rebuild**: `npm run electron:build:mac`

## Design Recommendations

- **Simple & Bold** - Icons are small, keep design simple
- **High Contrast** - Works in both light/dark mode
- **No Text** - Text becomes unreadable at small sizes
- **Square Canvas** - 1024x1024 with padding
- **Transparent Background** - For better OS integration

## Testing

After adding icons:

```bash
# Development
npm run electron:dev
# Check dock icon appears

# Production Build
npm run electron:build:mac
# Open .app and check icon in Finder/Dock
```

## Resources

- [Electron Icon Guide](https://www.electron.build/icons)
- [macOS Icon Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Icon Generator Tools](https://www.electronforge.io/guides/create-and-add-icons)
