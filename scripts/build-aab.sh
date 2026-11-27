#!/usr/bin/env bash
# Construit l'Android App Bundle (.aab) pour Google Play, signé avec la clé d'envoi.
# À lancer après scripts/build-apk.sh (réutilise build/dex et build/res-compiled).
# Variables: ANDROID_HOME, JAVA_HOME, BUNDLETOOL (jar), VERSION_CODE, VERSION_NAME, KEYSTORE, KEYSTORE_PASS.
set -euo pipefail
cd "$(dirname "$0")/.."
SDK="${ANDROID_HOME:-$HOME/droid/sdk}"
API="${ANDROID_API:-36}"; BTV="${BUILD_TOOLS:-36.0.0}"
BT="$SDK/build-tools/$BTV"; PLAT="$SDK/platforms/android-$API/android.jar"
VERSION_CODE="${VERSION_CODE:-100000}"; VERSION_NAME="${VERSION_NAME:-1.0.0-dev}"
BUNDLETOOL="${BUNDLETOOL:-$HOME/droid/bundletool.jar}"
OUT=build; AAB="$OUT/tour-a-tour.aab"
test -f "$OUT/dex/classes.dex" || { echo "Lancer d'abord scripts/build-apk.sh"; exit 1; }
rm -rf "$OUT/aab" "$AAB"; mkdir -p "$OUT/aab/base"
"$BT/aapt2" link --proto-format -o "$OUT/aab/base-proto.apk" -I "$PLAT" \
  --manifest app/src/main/AndroidManifest.xml -A app/src/main/assets \
  --min-sdk-version 24 --target-sdk-version "$API" --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  "$OUT/res-compiled"/*.flat
( cd "$OUT/aab" && unzip -q base-proto.apk -d x && mkdir -p base/manifest base/dex \
  && mv x/AndroidManifest.xml base/manifest/AndroidManifest.xml && mv x/resources.pb base/ \
  && { [ -d x/res ] && mv x/res base/res || true; } && { [ -d x/assets ] && mv x/assets base/assets || true; } \
  && cp ../dex/classes.dex base/dex/classes.dex && (cd base && zip -qr ../base.zip .) )
java -jar "$BUNDLETOOL" build-bundle --modules="$OUT/aab/base.zip" --output="$AAB"
KS="${KEYSTORE:-keystore/debug.jks}"; KPASS="${KEYSTORE_PASS:-android}"
ALIAS=$(keytool -list -keystore "$KS" -storepass "$KPASS" 2>/dev/null | awk -F, '/PrivateKeyEntry|trustedCertEntry/{print $1; exit}')
export KPASS
jarsigner -keystore "$KS" -storepass:env KPASS -keypass:env KPASS -sigalg SHA256withRSA -digestalg SHA-256 "$AAB" "$ALIAS" >/dev/null
java -jar "$BUNDLETOOL" validate --bundle="$AAB"
jarsigner -verify "$AAB" | head -1
ls -l "$AAB"
