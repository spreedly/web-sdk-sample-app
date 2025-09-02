#!/bin/bash

# Exit on any error
set -e

echo "Building TypeScript files..."
tsc

echo "✓ TypeScript compiled"

echo "Copying HTML files from src/static to dist/static..."
# Copy all HTML files
find src/static -name "*.html" -exec cp {} dist/static/ \;

# Copy CSS directory structure
if [ -d "src/static/css" ]; then
  cp -r src/static/css dist/static/css
fi

echo "✓ Static files copied to dist/static/"
echo "Build completed successfully!"

