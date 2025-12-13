const assert = require('assert');

// NOTE: This file is intentionally node-side (CommonJS). It mirrors the host-side
// `resolveSourceFilePath()` logic in [`App.tsx`](App.tsx:1159) to provide lightweight
// regression coverage without pulling TS/React into the test runner.

function resolveSourceFilePath(projectPath, raw) {
  let file = String(raw || '').trim();
  if (!file) return { absPath: '', displayPath: '' };

  let fromHttpUrl = false;
  let fromFileUrl = false;
  try {
    if (file.startsWith('http://') || file.startsWith('https://')) {
      const u = new URL(file);
      file = u.pathname;
      fromHttpUrl = true;
    } else if (file.startsWith('file://')) {
      const u = new URL(file);
      file = u.pathname;
      fromFileUrl = true;
    }
  } catch (e) {
    // ignore
  }

  file = file.split('?')[0].split('#')[0];
  file = file.replace(/^webpack-internal:\/\//, '');
  file = file.replace(/^webpack:\/{3}/, '');
  file = file.replace(/^webpack:\/\//, '');
  file = file.replace(/^file:\/\//, '');
  file = file.replace(/^\/@fs\//, '/');

  const displayPath = fromHttpUrl ? file.replace(/^\/+/, '') : file;

  const isWindowsAbs = /^[A-Z]:\\/.test(file);
  const isPosixAbs = file.startsWith('/');
  const treatPosixAbsAsProjectRelative =
    !!projectPath &&
    isPosixAbs &&
    !fromFileUrl &&
    (fromHttpUrl || file.startsWith('/src/'));

  const absPath =
    isWindowsAbs || (isPosixAbs && !treatPosixAbsAsProjectRelative)
      ? file
      : `${projectPath}/${file.replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/');

  return { absPath, displayPath };
}

function parseClusoId(clusoId) {
  if (!clusoId) return { sourceFile: null, sourceLine: null, sourceColumn: null };
  const parts = String(clusoId).split(':');
  const colStr = parts.pop();
  const lineStr = parts.pop();
  const col = colStr ? parseInt(colStr, 10) : NaN;
  const line = lineStr ? parseInt(lineStr, 10) : NaN;
  const sourceColumn = Number.isFinite(col) ? col : null;
  const sourceLine = Number.isFinite(line) ? line : null;
  const sf = parts.join(':');
  const sourceFile = sf || null;
  return { sourceFile, sourceLine, sourceColumn };
}

// --------------------------
// Path resolution regression
// --------------------------
{
  const projectPath = '/Users/user/projects/my-app';

  assert.deepStrictEqual(
    resolveSourceFilePath(projectPath, 'http://localhost:5173/src/App.tsx?t=123'),
    { absPath: '/Users/user/projects/my-app/src/App.tsx', displayPath: 'src/App.tsx' }
  );

  assert.deepStrictEqual(
    resolveSourceFilePath(projectPath, 'https://example.com/src/Foo.tsx?import'),
    { absPath: '/Users/user/projects/my-app/src/Foo.tsx', displayPath: 'src/Foo.tsx' }
  );

  // URL pathname-like sources should be treated as project-relative, not OS-absolute.
  assert.deepStrictEqual(
    resolveSourceFilePath(projectPath, '/src/Bar.tsx'),
    { absPath: '/Users/user/projects/my-app/src/Bar.tsx', displayPath: '/src/Bar.tsx' }
  );

  // Preserve behavior for true filesystem absolute paths.
  assert.deepStrictEqual(
    resolveSourceFilePath(projectPath, '/Users/user/projects/my-app/src/App.tsx'),
    { absPath: '/Users/user/projects/my-app/src/App.tsx', displayPath: '/Users/user/projects/my-app/src/App.tsx' }
  );

  // Preserve behavior for file:// URLs.
  assert.deepStrictEqual(
    resolveSourceFilePath(projectPath, 'file:///Users/user/projects/my-app/src/App.tsx'),
    { absPath: '/Users/user/projects/my-app/src/App.tsx', displayPath: '/Users/user/projects/my-app/src/App.tsx' }
  );

  // Common sourcemap format.
  assert.deepStrictEqual(
    resolveSourceFilePath(projectPath, 'webpack:///src/App.tsx'),
    { absPath: '/Users/user/projects/my-app/src/App.tsx', displayPath: 'src/App.tsx' }
  );
}

// --------------------------
// Layers metadata regression
// --------------------------
{
  assert.deepStrictEqual(parseClusoId('src/App.tsx:45:12'), {
    sourceFile: 'src/App.tsx',
    sourceLine: 45,
    sourceColumn: 12,
  });

  // Windows paths contain a ':' after the drive letter; ensure we keep it.
  assert.deepStrictEqual(parseClusoId('C:\\proj\\src\\App.tsx:45:12'), {
    sourceFile: 'C:\\proj\\src\\App.tsx',
    sourceLine: 45,
    sourceColumn: 12,
  });
}

console.log('OK: path resolution + data-cluso-id parsing regressions');
