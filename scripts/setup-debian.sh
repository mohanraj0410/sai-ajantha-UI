#!/usr/bin/env bash
set -e

echo "=== SAI AJANTHA — DEBIAN/LINUX ENVIRONMENT SETUP ==="

# 1. Verify Node.js version
NODE_VERSION=$(node -v 2>/dev/null || echo "none")
if [ "$NODE_VERSION" = "none" ]; then
  echo "Error: Node.js is not installed. Please install Node.js 22+."
  exit 1
fi

NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Error: Node.js version $NODE_VERSION is too old. Node.js >= 22.0.0 is strictly required."
  echo "Please upgrade via NVM: 'nvm install 22 && nvm use 22'"
  exit 1
fi
echo "✔ Node.js version: $NODE_VERSION (compatible)"

# 2. Install Linux native dependencies for backend and storefront
echo "Installing platform-specific native binaries for Linux (x64)..."
npm install -w @dtc/backend --save-optional @swc/core-linux-x64-gnu || true
npm install -w @sai-ajanta/storefront --save-optional lightningcss-linux-x64-gnu@1.32.0 @next/swc-linux-x64-gnu || true

# 3. Ensure native binaries are placed where loaders expect them
node scripts/ensure-native-binaries.mjs

echo "✔ Native binaries configured successfully."
echo "You can now run: npm run dev"
