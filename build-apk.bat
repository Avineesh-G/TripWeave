@echo off
setlocal
echo ============================================================
echo [TripWeave] Production Release APK Build Pipeline
echo ============================================================

echo [1/3] Building web assets with Vite...
call npm.cmd run build
if %errorlevel% neq 0 (
    echo [ERROR] npm run build failed.
    exit /b %errorlevel%
)

echo [2/3] Synchronizing assets to Android container...
python scripts/sync_assets.py
if %errorlevel% neq 0 (
    echo [ERROR] Asset sync failed.
    exit /b %errorlevel%
)

echo [3/3] Compiling signed Android Release APK...
call gradlew.bat assembleRelease
if %errorlevel% neq 0 (
    echo [ERROR] Gradle assembleRelease failed.
    exit /b %errorlevel%
)

if not exist releases mkdir releases
copy /y app\build\outputs\apk\release\app-release.apk TripWeave-v1.7.1.apk
copy /y app\build\outputs\apk\release\app-release.apk TripWeave.apk
copy /y app\build\outputs\apk\release\app-release.apk releases\TripWeave-v1.7.1.apk
copy /y app\build\outputs\apk\release\app-release.apk releases\TripWeave.apk

echo.
echo ============================================================
echo [TripWeave] Release Build Successful!
echo Primary APK : TripWeave-v1.7.1.apk (and TripWeave.apk)
echo Archive Copy: releases\TripWeave-v1.7.1.apk
echo ============================================================
endlocal
