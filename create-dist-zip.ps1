Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$distPath = (Get-Item -Path ".\dist").FullName
$zipPath = (Get-Item -Path ".").FullName + "\dist.zip"

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

$zipFile = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)

Get-ChildItem -Path $distPath -Recurse -Force | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
    $rel = $_.FullName.Substring($distPath.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipFile, $_.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    Write-Host "Added: $rel"
}

$zipFile.Dispose()
Write-Host "Successfully generated dist.zip with forward-slash paths!"
