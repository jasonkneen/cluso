# Cluso

Cluso is an AI coding assistant with intelligent element selection and automation capabilities.

## Features

- 🎯 **Intelligent Element Selection** - Smart element picker for web interfaces
- 🤖 **AI-Powered Code Assistant** - Integrated Claude AI for coding assistance
- 🖥️ **Multiple Platforms** - Desktop (Electron), Web browser support
- 🔧 **Developer Tools** - Built-in inspector, code editor, and terminal
- 📦 **npx Support** - Run directly with `npx cluso`

## Installation

### NPX (Recommended - All Platforms)

```bash
npx cluso
```

**Supported Platforms:**
- macOS (Intel & Apple Silicon)
- Windows (x64, arm64)
- Linux (x64, arm64, armv7l)

The first run will automatically download the correct Electron binary for your platform (~100MB), then launch the application. Subsequent runs use the cached binary.

### From Source

```bash
git clone https://github.com/jkneen/flows.git
cd flows/cluso/ai-cluso
npm install
npm run electron:dev
```

## Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Available Scripts

```bash
# Development
npm run dev                # Web development server
npm run electron:dev       # Electron development mode

# Building
npm run build              # Build web app
npm run build:prod         # Production build
npm run electron:build     # Build Electron app
npm run electron:build:mac # Build for macOS only

# Testing
npm run test               # Run tests
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage
```

## Platform Support

- **Electron** (macOS, Windows, Linux) - Desktop application
- **Web** - Browser-based PWA

## Project Structure

```
ai-cluso/
├── src/           # React frontend
├── electron/      # Electron backend
├── packages/      # Workspace packages
│   ├── fast-apply/        # Fast code editing
│   ├── mgrep-local/       # Local code search
│   ├── shared-audio/      # Audio utilities
│   ├── shared-inspector/  # Element inspector
│   ├── shared-tools/      # Shared utilities
│   └── shared-types/      # TypeScript types
├── bin/           # CLI executables
└── public/        # Static assets
```

## License

Cluso uses a dual-licensing model:

- **Default**: AGPL-3.0 + Commons Clause (free for personal/internal use)
- **Commercial**: Available for commercial use (contact for licensing)

See [LICENSE](./LICENSE), [LICENSING.md](./LICENSING.md), and [COMMERCIAL_LICENSE](./COMMERCIAL_LICENSE) for details.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Author

Jason Kneen

## Support

- **Issues**: [GitHub Issues](https://github.com/jkneen/flows/issues)
- **License Inquiries**: Open an issue on GitHub

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
