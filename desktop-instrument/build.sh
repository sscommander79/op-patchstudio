#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$HOME/Library/Caches/OP-PatchStudio/SerumIntegration/OP-PatchStudio Serum Integration.app"
cd "$ROOT"
npm run typecheck
./node_modules/.bin/vite build --base ./ --outDir dist-desktop-instrument
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
rsync -a --delete "$ROOT/dist-desktop-instrument/" "$APP/Contents/Resources/web/"
mkdir -p "$ROOT/desktop-instrument/build"
xcrun clang -fobjc-arc -c "$ROOT/desktop-instrument/Sources/InstrumentEditor.m" -o "$ROOT/desktop-instrument/build/InstrumentEditor.o"
xcrun swiftc -O -swift-version 5 -import-objc-header "$ROOT/desktop-instrument/Sources/InstrumentEditor.h" "$ROOT/desktop-instrument/build/InstrumentEditor.o" "$ROOT"/desktop-instrument/Sources/*.swift -o "$APP/Contents/MacOS/InstrumentProof"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>InstrumentProof</string><key>CFBundleIdentifier</key><string>studio.oppatchstudio.serumintegration</string><key>CFBundleName</key><string>OP-PatchStudio Serum Integration</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>LSMinimumSystemVersion</key><string>13.0</string><key>NSHighResolutionCapable</key><true/></dict></plist>
PLIST
xattr -dr com.apple.FinderInfo "$APP" 2>/dev/null || true
xattr -dr com.apple.ResourceFork "$APP" 2>/dev/null || true
codesign --force --sign - "$APP"
codesign --verify --deep --strict "$APP"
printf '%s\n' "$APP"
