#!/bin/bash

# Exit on any error
set -e

echo "Building TypeScript files..."
tsc

echo "✓ TypeScript compiled"

echo "Copying HTML files from src/static to dist/static..."
# Copy all HTML files (excluding monorepo folder - handled separately)
find src/static -maxdepth 1 -name "*.html" -exec cp {} dist/static/ \;

# Copy CSS directory structure (remove existing to prevent nesting)
if [ -d "src/static/css" ]; then
  rm -rf dist/static/css
  cp -r src/static/css dist/static/
fi

# Copy monorepo folder (remove existing to prevent stale files)
if [ -d "src/static/monorepo" ]; then
  echo "Copying monorepo files..."
  rm -rf dist/static/monorepo
  cp -r src/static/monorepo dist/static/monorepo
  echo "✓ Monorepo files copied to dist/static/monorepo/"
fi

echo "✓ Static files copied to dist/static/"
echo "Build completed successfully!"
