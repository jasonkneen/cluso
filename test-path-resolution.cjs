
const path = require('path');

// Mock data
const projectPath = '/Users/user/projects/my-app';
const sourceFileRelative = 'src/App.tsx';
const sourceFileAbsolute = '/Users/user/projects/my-app/src/App.tsx';
const sourceFileSourceMap = 'webpack:///src/App.tsx'; // Common source map format

function resolvePath(filePath, projectPath) {
  console.log('Resolving:', filePath, 'with project:', projectPath);
  
  const isAbsoluteFilesystemPath = filePath.startsWith('/Users/') || 
                                   filePath.startsWith('/home/') || 
                                   filePath.startsWith('/var/') ||
                                   /^[A-Z]:\\/.test(filePath);

  if (!isAbsoluteFilesystemPath && projectPath) {
    let relativePath = filePath;
    
    // Remove localhost URL prefix if present
    const urlMatch = relativePath.match(/localhost:\d+\/(.+)$/);
    if (urlMatch) {
      relativePath = urlMatch[1];
    }
    
    // Remove leading slashes
    relativePath = relativePath.replace(/^\/+/, '');
    
    // Remove query strings
    relativePath = relativePath.split('?')[0];
    
    // Remove webpack prefix
    if (relativePath.startsWith('webpack:///')) {
        relativePath = relativePath.replace('webpack:///', '');
    }
    
    const finalPath = `${projectPath}/${relativePath}`;
    console.log('Resolved to:', finalPath);
    return finalPath;
  }
  
  console.log('Kept as absolute:', filePath);
  return filePath;
}

console.log('--- Test Cases ---');
resolvePath(sourceFileRelative, projectPath);
resolvePath(sourceFileAbsolute, projectPath);
resolvePath('/src/App.tsx', projectPath);
resolvePath('http://localhost:3000/src/App.tsx', projectPath);
resolvePath('webpack:///src/App.tsx', projectPath); // This case might fail in current App.tsx logic!
