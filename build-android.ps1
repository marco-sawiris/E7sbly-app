[CmdletBinding()]
param(
    [string]$JavaDirectory,
    [string]$BuildToolsDirectory,
    [string]$AndroidJar
)
$ErrorActionPreference = 'Stop'
$projectDirectory = $PSScriptRoot

# Uses the official JDK / Android SDK tools; no global installation is needed.
if (-not $JavaDirectory) {
    $localJava = Get-ChildItem -LiteralPath "$projectDirectory/.tools/java" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($localJava) { $JavaDirectory = $localJava.FullName }
    elseif ($env:JAVA_HOME) { $JavaDirectory = $env:JAVA_HOME }
}
if (-not $BuildToolsDirectory) {
    $localTools = Get-ChildItem -LiteralPath "$projectDirectory/.tools/android-build-tools" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($localTools) { $BuildToolsDirectory = $localTools.FullName }
    elseif ($env:ANDROID_HOME) { $BuildToolsDirectory = Join-Path $env:ANDROID_HOME 'build-tools/35.0.0' }
}
if (-not $AndroidJar) {
    $localPlatform = Get-ChildItem -LiteralPath "$projectDirectory/.tools/android-platform" -Filter 'android.jar' -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($localPlatform) { $AndroidJar = $localPlatform.FullName }
    elseif ($env:ANDROID_HOME) { $AndroidJar = Join-Path $env:ANDROID_HOME 'platforms/android-35/android.jar' }
}

foreach ($required in @(
    "$JavaDirectory/bin/javac.exe", "$JavaDirectory/bin/java.exe", "$JavaDirectory/bin/jar.exe",
    "$BuildToolsDirectory/aapt2.exe", "$BuildToolsDirectory/zipalign.exe",
    "$BuildToolsDirectory/lib/d8.jar", "$BuildToolsDirectory/lib/apksigner.jar", $AndroidJar
)) {
    if (-not $required -or -not (Test-Path -LiteralPath $required)) {
        throw "Missing build tool: $required. Set JavaDirectory, BuildToolsDirectory and AndroidJar, or use Android Studio."
    }
}
foreach ($asset in @('index.html', 'styles.css', 'app.js', 'calculator.js')) {
    if (-not (Test-Path -LiteralPath "$projectDirectory/app/src/main/assets/$asset")) {
        throw "Missing app asset: $asset"
    }
}

function Invoke-BuildTool([string]$ToolPath, [string[]]$Arguments) {
    & $ToolPath @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Build tool failed ($LASTEXITCODE): $ToolPath" }
}

# Each build gets an isolated directory. Existing files are never deleted.
$buildTag = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 6)
$workDirectory = Join-Path $projectDirectory "app/build/manual/$buildTag"
$classesDirectory = Join-Path $workDirectory 'classes'
$generatedDirectory = Join-Path $workDirectory 'generated'
$dexDirectory = Join-Path $workDirectory 'dex'
$outputDirectory = Join-Path $projectDirectory 'app/build/outputs/apk/debug'
$deliveryDirectory = Join-Path $projectDirectory 'dist'
New-Item -ItemType Directory -Force -Path $workDirectory, $classesDirectory, $generatedDirectory, $dexDirectory, $outputDirectory, $deliveryDirectory | Out-Null

$manifest = [IO.File]::ReadAllText((Join-Path $projectDirectory 'app/src/main/AndroidManifest.xml'))
$manifest = $manifest.Replace('<manifest ', '<manifest package="com.ehsably.app" ')
$buildManifest = Join-Path $workDirectory 'AndroidManifest.xml'
[IO.File]::WriteAllText($buildManifest, $manifest, [Text.UTF8Encoding]::new($false))

Write-Host 'Compiling Android resources...'
Invoke-BuildTool "$BuildToolsDirectory/aapt2.exe" @(
    'compile', '--dir', "$projectDirectory/app/src/main/res", '-o', "$workDirectory/resources.zip"
)
Invoke-BuildTool "$BuildToolsDirectory/aapt2.exe" @(
    'link', '-I', $AndroidJar, '--manifest', $buildManifest, '--java', $generatedDirectory,
    '--debug-mode', '-A', "$projectDirectory/app/src/main/assets", '-o', "$workDirectory/unsigned.apk", "$workDirectory/resources.zip"
)

Write-Host 'Compiling Java and DEX...'
$javaSources = @(Get-ChildItem -LiteralPath "$projectDirectory/app/src/main/java", $generatedDirectory -Filter '*.java' -Recurse -File | ForEach-Object { $_.FullName })
Invoke-BuildTool "$JavaDirectory/bin/javac.exe" (@('-encoding', 'UTF-8', '-source', '8', '-target', '8', '-bootclasspath', $AndroidJar, '-d', $classesDirectory) + $javaSources)
Invoke-BuildTool "$JavaDirectory/bin/jar.exe" @('cf', "$workDirectory/classes.jar", '-C', $classesDirectory, '.')
Invoke-BuildTool "$JavaDirectory/bin/java.exe" @('-cp', "$BuildToolsDirectory/lib/d8.jar", 'com.android.tools.r8.D8', '--lib', $AndroidJar, '--min-api', '29', '--output', $dexDirectory, "$workDirectory/classes.jar")

# Add DEX with ZipArchive rather than jar, which can introduce manifest entries.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$apkArchive = [IO.Compression.ZipFile]::Open("$workDirectory/unsigned.apk", [IO.Compression.ZipArchiveMode]::Update)
try {
    # Windows aapt2 can package nested assets with backslash names. Android's
    # AssetManager expects forward slashes (fonts/foo.otf), so normalize every
    # affected entry before signing. Preserve the exact uncompressed bytes.
    $windowsEntries = @($apkArchive.Entries | Where-Object { $_.FullName.Contains('\') })
    foreach ($entry in $windowsEntries) {
        $normalizedName = $entry.FullName.Replace('\', '/')
        if ($apkArchive.GetEntry($normalizedName)) { throw "Conflicting APK entry: $normalizedName" }
        $buffer = [IO.MemoryStream]::new()
        $entryStream = $entry.Open()
        try { $entryStream.CopyTo($buffer) } finally { $entryStream.Dispose() }
        $newEntry = $apkArchive.CreateEntry($normalizedName, [IO.Compression.CompressionLevel]::Optimal)
        $newStream = $newEntry.Open()
        try { $buffer.Position = 0; $buffer.CopyTo($newStream) } finally { $newStream.Dispose(); $buffer.Dispose() }
        $entry.Delete()
    }
    foreach ($dexFile in Get-ChildItem -LiteralPath $dexDirectory -Filter '*.dex' -File) {
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($apkArchive, $dexFile.FullName, $dexFile.Name, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $apkArchive.Dispose() }

# Font paths are runtime dependencies for the native interface. Check the exact
# paths and bytes in the APK, not just their presence on the development disk.
$assetArchive = [IO.Compression.ZipFile]::OpenRead("$workDirectory/unsigned.apk")
try {
    if (@($assetArchive.Entries | Where-Object { $_.FullName.Contains('\') }).Count -gt 0) {
        throw 'An APK entry still contains a Windows path separator.'
    }
    $assetDirectory = Join-Path $projectDirectory 'app/src/main/assets'
    foreach ($assetFile in Get-ChildItem -LiteralPath $assetDirectory -Recurse -File) {
        $relativePath = $assetFile.FullName.Substring($assetDirectory.Length).TrimStart([char[]]'\/').Replace('\', '/')
        $assetEntry = $assetArchive.GetEntry('assets/' + $relativePath)
        if (-not $assetEntry) { throw "APK is missing asset: $relativePath" }
        $assetStream = $assetEntry.Open()
        $hashAlgorithm = [Security.Cryptography.SHA256]::Create()
        try { $entryHash = [BitConverter]::ToString($hashAlgorithm.ComputeHash($assetStream)).Replace('-', '') }
        finally { $assetStream.Dispose(); $hashAlgorithm.Dispose() }
        if ($entryHash -ne (Get-FileHash -LiteralPath $assetFile.FullName -Algorithm SHA256).Hash) {
            throw "APK asset bytes differ: $relativePath"
        }
    }
} finally { $assetArchive.Dispose() }

Write-Host 'Aligning and signing a development APK...'
Invoke-BuildTool "$BuildToolsDirectory/zipalign.exe" @('-f', '-p', '4', "$workDirectory/unsigned.apk", "$workDirectory/aligned.apk")
$debugKey = Join-Path $projectDirectory '.tools/ehsably-debug.keystore'
if (-not (Test-Path -LiteralPath $debugKey)) {
    New-Item -ItemType Directory -Force -Path "$projectDirectory/.tools" | Out-Null
    Invoke-BuildTool "$JavaDirectory/bin/keytool.exe" @(
        '-genkeypair', '-keystore', $debugKey, '-storepass', 'android', '-keypass', 'android',
        '-alias', 'androiddebugkey', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
        '-dname', 'CN=Android Debug,O=Ehsably Development,C=EG', '-noprompt'
    )
}
$apkPath = Join-Path $workDirectory 'app-debug.apk'
Invoke-BuildTool "$JavaDirectory/bin/java.exe" @('-jar', "$BuildToolsDirectory/lib/apksigner.jar", 'sign', '--ks', $debugKey, '--ks-key-alias', 'androiddebugkey', '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', $apkPath, "$workDirectory/aligned.apk")
Invoke-BuildTool "$JavaDirectory/bin/java.exe" @('-jar', "$BuildToolsDirectory/lib/apksigner.jar", 'verify', '--verbose', $apkPath)
Invoke-BuildTool "$BuildToolsDirectory/zipalign.exe" @('-c', '-p', '4', $apkPath)
Copy-Item -LiteralPath $apkPath -Destination "$outputDirectory/app-debug.apk" -Force
Copy-Item -LiteralPath $apkPath -Destination "$deliveryDirectory/ehsably-debug.apk" -Force
[xml]$versionManifest = $manifest
$appVersion = $versionManifest.DocumentElement.GetAttribute('versionName', 'http://schemas.android.com/apk/res/android')
if ($appVersion -match '^[0-9]+(\.[0-9]+){0,3}$') {
    Copy-Item -LiteralPath $apkPath -Destination "$deliveryDirectory/ehsably-$appVersion.apk" -Force
}
Get-FileHash -LiteralPath "$deliveryDirectory/ehsably-debug.apk" -Algorithm SHA256 | Format-List
Write-Host "APK ready: $deliveryDirectory/ehsably-debug.apk"
