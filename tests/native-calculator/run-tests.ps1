[CmdletBinding()]
param([string]$JavaDirectory)
$ErrorActionPreference = 'Stop'
$projectDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if (-not $JavaDirectory) {
    $localJava = Get-ChildItem -LiteralPath "$projectDirectory/.tools/java" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($localJava) { $JavaDirectory = $localJava.FullName }
    elseif ($env:JAVA_HOME) { $JavaDirectory = $env:JAVA_HOME }
}
$compiler = Join-Path $JavaDirectory 'bin/javac.exe'
$runtime = Join-Path $JavaDirectory 'bin/java.exe'
if (-not (Test-Path -LiteralPath $compiler) -or -not (Test-Path -LiteralPath $runtime)) {
    throw 'A JDK is required. Pass -JavaDirectory or set JAVA_HOME.'
}
$runId = [Guid]::NewGuid().ToString('N')
$classesDirectory = Join-Path $projectDirectory "app/build/native-calculator-tests/$runId"
New-Item -ItemType Directory -Force -Path $classesDirectory | Out-Null
& $compiler -encoding UTF-8 -source 8 -target 8 -d $classesDirectory `
    "$projectDirectory/app/src/main/java/com/ehsably/app/NativeCalculator.java" `
    "$PSScriptRoot/NativeCalculatorTest.java"
if ($LASTEXITCODE -ne 0) { throw 'Native calculator test compilation failed.' }
& $runtime -cp $classesDirectory com.ehsably.app.NativeCalculatorTest
if ($LASTEXITCODE -ne 0) { throw 'Native calculator regression tests failed.' }
