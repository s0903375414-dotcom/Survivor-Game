#!/bin/bash
# _dl_android_tools.sh — 下載 Android 建置工具鏈(JDK17 + cmdline-tools)到 android-tools/
set -e
DEST="D:/trae_projects/android-tools"
mkdir -p "$DEST"
cd "$DEST"
echo "=== 下載 JDK 17 (Temurin) ==="
curl -L --retry 3 --connect-timeout 30 -o jdk17.zip "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse"
echo "=== 下載 Android cmdline-tools ==="
curl -L --retry 3 --connect-timeout 30 -o cmdtools.zip "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
echo "=== 解壓 ==="
mkdir -p jdk17 && tar -xf jdk17.zip -C jdk17 --strip-components=1 || (cd jdk17 && unzip -q ../jdk17.zip && mv */* .)
mkdir -p sdk/cmdline-tools && tar -xf cmdtools.zip -C sdk/cmdline-tools || (cd sdk/cmdline-tools && unzip -q ../../cmdtools.zip)
if [ -d sdk/cmdline-tools/cmdline-tools ]; then mkdir -p sdk/cmdline-tools/latest && mv sdk/cmdline-tools/cmdline-tools/* sdk/cmdline-tools/latest/ && rmdir sdk/cmdline-tools/cmdline-tools; fi
echo "=== 驗證 ==="
jdk17/bin/java -version 2>&1 | head -1
ls sdk/cmdline-tools/latest/bin | head -5
echo "=== DONE ==="
