#!/usr/bin/env bash
# Construit et signe l'APK sans Gradle : aapt2 + javac + d8 + zipalign + apksigner.
# Prérequis : JDK 17 et Android SDK (platforms;android-36, build-tools;36.0.0).
# Version: VERSION_CODE / VERSION_NAME (défaut 100000 / 1.0.0-dev). Signature: KEYSTORE / KEYSTORE_PASS.
# Variables : ANDROID_HOME (défaut ~/droid/sdk), JAVA_HOME (défaut : java du PATH).
set -euo pipefail
cd "$(dirname "$0")/.."
SDK="${ANDROID_HOME:-$HOME/droid/sdk}"
API="${ANDROID_API:-36}"; BTV="${BUILD_TOOLS:-36.0.0}"
BT="$SDK/build-tools/$BTV"
PLAT="$SDK/platforms/android-$API/android.jar"
VERSION_CODE="${VERSION_CODE:-100000}"; VERSION_NAME="${VERSION_NAME:-1.0.0-dev}"
OUT=build; PKG=app.tourdeparole
rm -rf "$OUT"; mkdir -p "$OUT/classes" "$OUT/res-compiled" "$OUT/dex"

"$BT/aapt2" compile --dir app/src/main/res -o "$OUT/res-compiled"
"$BT/aapt2" link -o "$OUT/base.apk" -I "$PLAT" \
  --manifest app/src/main/AndroidManifest.xml -A app/src/main/assets \
  --min-sdk-version 24 --target-sdk-version "$API" --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  --java "$OUT/gen" "$OUT/res-compiled"/*.flat
javac -encoding UTF-8 -source 8 -target 8 -Xlint:-options -classpath "$PLAT" -d "$OUT/classes" \
  $(find app/src/main/java "$OUT/gen" -name '*.java')
"$BT/d8" --lib "$PLAT" --min-api 24 --output "$OUT/dex" $(find "$OUT/classes" -name '*.class')
cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT/dex" && zip -q -j ../unsigned.apk classes.dex)
"$BT/zipalign" -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

# Clé de débogage locale, jamais commitée (voir .gitignore).
KS="${KEYSTORE:-keystore/debug.jks}"
KPASS="${KEYSTORE_PASS:-android}"
if [ ! -f "$KS" ]; then
  mkdir -p "$(dirname "$KS")"
  keytool -genkeypair -keystore "$KS" -storepass android -keypass android -alias tdp \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Tour de parole debug"
fi
export KPASS
"$BT/apksigner" sign --ks "$KS" --ks-pass env:KPASS --key-pass env:KPASS \
  --out "$OUT/tour-de-parole.apk" "$OUT/aligned.apk"
"$BT/apksigner" verify --verbose "$OUT/tour-de-parole.apk" | head -5
"$BT/aapt2" dump badging "$OUT/tour-de-parole.apk" | grep -E "^(package|sdkVersion|targetSdk|application-label|launchable)"
ls -l "$OUT/tour-de-parole.apk"
