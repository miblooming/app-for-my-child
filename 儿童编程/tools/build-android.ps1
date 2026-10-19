param([switch]$SkipWeb)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if (-not $SkipWeb) {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
}
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed' }
$townJdk = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'java17') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if ($townJdk) { $env:JAVA_HOME = $townJdk.FullName }
if (-not $env:JAVA_HOME) { throw 'Set JAVA_HOME to JDK 17, or put a JDK in tools/java17.' }
$townSdk = if ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { 'K:\ai-model\toolchains\android\sdk' }
if (-not (Test-Path -LiteralPath $townSdk)) { throw 'Set ANDROID_SDK_ROOT to your Android SDK.' }
$env:ANDROID_HOME = $townSdk
$env:ANDROID_SDK_ROOT = $townSdk
$env:GRADLE_USER_HOME = Join-Path $PSScriptRoot 'gradle-cache'
$townSigning = Join-Path (Get-Location) 'signing'
New-Item -ItemType Directory -Path $townSigning -Force | Out-Null
$townKey = Join-Path $townSigning 'wonder-town.jks'
$townSigningProperties = Join-Path $townSigning 'signing.properties'
if (-not (Test-Path -LiteralPath $townKey)) {
    $townRandom = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Fill($townRandom)
    $env:TOWN_KEY_PASSWORD = [Convert]::ToHexString($townRandom).ToLowerInvariant()
    try {
        & (Join-Path $env:JAVA_HOME 'bin\keytool.exe') -genkeypair -noprompt -keystore $townKey -storepass:env TOWN_KEY_PASSWORD -keypass:env TOWN_KEY_PASSWORD -alias wondertown -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Wonder Town Local Distribution, O=Wonder Academy, C=CN'
        if ($LASTEXITCODE -ne 0) { throw 'Signing key generation failed' }
        $townProperties = "storePassword=$env:TOWN_KEY_PASSWORD`nkeyPassword=$env:TOWN_KEY_PASSWORD`nkeyAlias=wondertown`n"
        [IO.File]::WriteAllText($townSigningProperties, $townProperties, [Text.Encoding]::ASCII)
    } finally { Remove-Item Env:TOWN_KEY_PASSWORD -ErrorAction SilentlyContinue }
}
if (-not (Test-Path -LiteralPath $townSigningProperties)) { throw 'Signing properties missing; restore the matching signing backup.' }
$townSdkProperty = $townSdk.Replace('\','/').Replace(':','\:')
[IO.File]::WriteAllText((Join-Path (Get-Location) 'android\local.properties'), "sdk.dir=$townSdkProperty`n", [Text.Encoding]::ASCII)
Push-Location -LiteralPath 'android'
try {
    & '.\gradlew.bat' assembleRelease --no-daemon --console=plain '-Dorg.gradle.java.installations.auto-download=false'
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed' }
} finally { Pop-Location }
New-Item -ItemType Directory -Path '交付文件' -Force | Out-Null
$townVersion = (Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).version
$townApk = Join-Path (Get-Location) ("交付文件\奇想编程小镇-v$townVersion.apk")
Copy-Item -LiteralPath 'android\app\build\outputs\apk\release\app-release.apk' -Destination $townApk -Force
& (Join-Path $env:JAVA_HOME 'bin\java.exe') -jar (Join-Path $townSdk 'build-tools\35.0.0\lib\apksigner.jar') verify --verbose $townApk
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
$townHash = (Get-FileHash -LiteralPath $townApk -Algorithm SHA256).Hash.ToLowerInvariant()
$townChecksums = Join-Path (Get-Location) '开发资料\校验'
New-Item -ItemType Directory -Path $townChecksums -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $townChecksums 'APK-SHA256.txt'), "$townHash  奇想编程小镇-v$townVersion.apk`n", [Text.UTF8Encoding]::new($false))
$townDelivery = (Resolve-Path -LiteralPath (Join-Path (Get-Location) '交付文件')).Path
foreach ($townOld in Get-ChildItem -LiteralPath $townDelivery -File) {
    if ($townOld.Name -notmatch '^奇想编程小镇-v.+(?:\.apk|-网页版\.zip)$') { continue }
    if ($townOld.Name -in @("奇想编程小镇-v$townVersion.apk", "奇想编程小镇-v$townVersion-网页版.zip")) { continue }
    if ($townOld.DirectoryName -ne $townDelivery -or $townOld.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unsafe release cleanup path' }
    Remove-Item -LiteralPath $townOld.FullName
}
Write-Output "APK ready: $townApk"
