@echo off
echo [TripWeave] Building production web assets...
call npm.cmd run build
if %errorlevel% neq 0 (
    echo Error during npm run build.
    exit /b %errorlevel%
)

echo [TripWeave] Syncing assets to Android container...
python scratch/sync_assets_to_android.py
if %errorlevel% neq 0 (
    echo Error during asset sync.
    exit /b %errorlevel%
)

echo [TripWeave] Compiling Android APK...
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo Error during Gradle build.
    exit /b %errorlevel%
)

copy /y app\build\outputs\apk\debug\app-debug.apk TripWeave-v1.0.0.apk
echo.
echo ============================================================
echo [TripWeave] APK build successful!
echo Output: TripWeave-v1.0.0.apk
echo ============================================================
