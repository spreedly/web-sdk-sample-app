#!/bin/bash

# Exit on any error
set -e

echo "Building TypeScript files..."
tsc

echo "✓ TypeScript compiled"

echo "Copying static files from src/static to dist/static..."

# Clean dist/static to prevent stale files (e.g. old monorepo/ folder)
rm -rf dist/static
mkdir -p dist/static

# Copy all static files recursively
cp -r src/static/. dist/static/

echo "✓ Static files copied to dist/static/"
echo "Build completed successfully!"
