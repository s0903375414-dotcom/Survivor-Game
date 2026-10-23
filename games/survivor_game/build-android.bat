@echo off
setlocal
if not defined JAVA_HOME set "JAVA_HOME=%LOCALAPPDATA%\Android\jdk-21"
if not defined ANDROID_HOME set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"
if not exist "%JAVA_HOME%\bin\java.exe" (
  echo Java 21 not found at "%JAVA_HOME%".
  exit /b 1
)
if not exist "%ANDROID_HOME%\platforms\android-36\android.jar" (
  echo Android SDK platform 36 not found at "%ANDROID_HOME%".
  exit /b 1
)
call npm run android:sync
if errorlevel 1 exit /b %errorlevel%
pushd android
call gradlew.bat assembleDebug
set "BUILD_RESULT=%errorlevel%"
popd
if not "%BUILD_RESULT%"=="0" exit /b %BUILD_RESULT%
echo APK created: android\app\build\outputs\apk\debug\app-debug.apk
