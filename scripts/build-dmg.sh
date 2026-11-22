#!/bin/bash
set -e

PROJECT_DIR="/Users/sujaybarui/Desktop/Claude Code/room-314"
BUILD_DIR="$PROJECT_DIR/dist-macos"
APP_NAME="Room-314"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"
DMG_PATH="$PROJECT_DIR/$APP_NAME-macOS.dmg"

echo "=================================================="
echo "📦 Building macOS Native Desktop App & DMG for $APP_NAME"
echo "=================================================="

# 1. Clean previous builds
rm -rf "$BUILD_DIR"
rm -f "$DMG_PATH"
mkdir -p "$BUILD_DIR"

# 2. Build client production bundle
echo "1. Building React production bundle..."
cd "$PROJECT_DIR/client"
npm run build

# 3. Create .app bundle structure
echo "2. Creating macOS .app bundle directory structure..."
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources/app"

# 4. Copy application source files (server + client/dist + database + package.json)
echo "3. Bundling application files into .app package..."
cp -R "$PROJECT_DIR/server" "$APP_BUNDLE/Contents/Resources/app/"
mkdir -p "$APP_BUNDLE/Contents/Resources/app/client"
cp -R "$PROJECT_DIR/client/dist" "$APP_BUNDLE/Contents/Resources/app/client/"
cp -R "$PROJECT_DIR/database" "$APP_BUNDLE/Contents/Resources/app/"
cp "$PROJECT_DIR/.env" "$APP_BUNDLE/Contents/Resources/app/.env" 2>/dev/null || true
cp "$PROJECT_DIR/package.json" "$APP_BUNDLE/Contents/Resources/app/"

# 5. Copy AppIcon.icns
echo "4. Installing AppIcon.icns..."
cp "$PROJECT_DIR/scripts/AppIcon.icns" "$APP_BUNDLE/Contents/Resources/AppIcon.icns"

# 6. Create Info.plist
echo "5. Writing Info.plist..."
cat << 'EOF' > "$APP_BUNDLE/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>Room-314</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.room314.pos</string>
    <key>CFBundleName</key>
    <string>Room-314</string>
    <key>CFBundleDisplayName</key>
    <string>Room-314 POS</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

cat << 'EOF' > "$APP_BUNDLE/Contents/PkgInfo"
APPLR314
EOF

# 7. Compile pure native macOS Cocoa WebKit binary
echo "6. Compiling native Cocoa WebKit application binary..."
clang -O3 -fobjc-arc -framework Cocoa -framework WebKit \
  -o "$APP_BUNDLE/Contents/MacOS/Room-314" \
  "$PROJECT_DIR/scripts/Room314NativeApp.m"
chmod +x "$APP_BUNDLE/Contents/MacOS/Room-314"

# 8. Create DMG Staging folder
echo "7. Creating DMG staging folder..."
DMG_STAGE="$BUILD_DIR/dmg_stage"
mkdir -p "$DMG_STAGE"
cp -R "$APP_BUNDLE" "$DMG_STAGE/"
ln -s /Applications "$DMG_STAGE/Applications"

# Add README in DMG
cat << 'EOF' > "$DMG_STAGE/README.txt"
Room-314 POS & Inventory Management System for Mac
===================================================

INSTALLATION:
Drag "Room-314" into your Applications folder.

HOW TO RUN:
Double-click Room-314 in your Applications folder to launch.

PROGRESS & DATA PERSISTENCE:
All your sales, stock, categories, and settings are saved locally in:
~/Library/Application Support/Room-314/room314.db

TRANSFER TO ANOTHER MAC:
Open Settings inside the app > "Database & Backup" > "Download Shop Data".
AirDrop or send that file to any Mac and click "Restore / Import Shop Data"!
EOF

# 9. Create DMG using hdiutil
echo "8. Building DMG image with hdiutil..."
hdiutil create -volname "Room-314 POS" \
  -srcfolder "$DMG_STAGE" \
  -ov -format UDZO \
  "$DMG_PATH"

cp "$DMG_PATH" "$PROJECT_DIR/Room-314.dmg"

echo ""
echo "=================================================="
echo "🎉 DMG CREATED SUCCESSFULLY!"
echo "📍 Location: $DMG_PATH"
echo "📍 Convenience Link: $PROJECT_DIR/Room-314.dmg"
echo "📦 Size: $(ls -lh "$DMG_PATH" | awk '{print $5}')"
echo "=================================================="

