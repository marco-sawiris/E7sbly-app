#!/usr/bin/env bash
set -e

echo "=== 1. Building React app ==="
npm run build
cp -rf dist/* app/src/main/assets/
rm -f app/src/main/assets/*.apk app/src/main/assets/*.zip app/src/main/assets/*.tar.gz

ANDROID_JAR="/usr/lib/android-sdk/platforms/android-23/android.jar"
BUILD_DIR="/tmp/e7sbly_build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/gen" "$BUILD_DIR/classes" "$BUILD_DIR/dex"

echo "=== 2. Packaging resources and assets with aapt ==="
aapt package -f -m \
    -J "$BUILD_DIR/gen" \
    -M app/src/main/AndroidManifest.xml \
    -S app/src/main/res \
    -A app/src/main/assets \
    -I "$ANDROID_JAR" \
    -F "$BUILD_DIR/unaligned.apk"

echo "=== 3. Compiling Java sources ==="
javac -encoding UTF-8 -source 8 -target 8 \
    -bootclasspath "$ANDROID_JAR" \
    -d "$BUILD_DIR/classes" \
    app/src/main/java/com/ehsably/app/MainActivity.java "$BUILD_DIR/gen/com/ehsably/app/R.java"

echo "=== 4. Creating classes.dex ==="
dalvik-exchange --dex --output="$BUILD_DIR/classes.dex" "$BUILD_DIR/classes"

echo "=== 5. Adding classes.dex to APK ==="
cd "$BUILD_DIR"
aapt add unaligned.apk classes.dex
cd /app/applet

echo "=== 6. Aligning APK ==="
zipalign -f -p 4 "$BUILD_DIR/unaligned.apk" "$BUILD_DIR/aligned.apk"

echo "=== 7. Signing APK ==="
KEYSTORE="release.keystore"
if [ ! -f "$KEYSTORE" ]; then
    keytool -genkeypair -keystore "$KEYSTORE" -storepass ehsably123 -keypass ehsably123 \
        -alias ehsably -keyalg RSA -keysize 2048 -validity 10000 \
        -dname "CN=E7sbly,O=E7sbly Apps,C=EG" -noprompt
fi

apksigner sign --ks "$KEYSTORE" --ks-pass pass:ehsably123 --key-pass pass:ehsably123 \
    --ks-key-alias ehsably --out public/E7sbly-release.apk "$BUILD_DIR/aligned.apk"

# Also produce debug apk
cp public/E7sbly-release.apk public/E7sbly-debug.apk

echo "=== 8. Verifying APK signature ==="
apksigner verify --verbose public/E7sbly-release.apk

echo "=== APK build completed successfully! ==="
ls -lh public/E7sbly-release.apk
