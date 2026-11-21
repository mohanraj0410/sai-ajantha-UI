Add-Type -AssemblyName System.IO.Compression.FileSystem

function Read-DocxText($filePath) {
    $zip = [System.IO.Compression.ZipFile]::OpenRead($filePath)
    $entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' }
    if (-not $entry) {
        $zip.Dispose()
        return "No document.xml found"
    }
    $stream = $entry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $xml = $reader.ReadToEnd()
    $reader.Close()
    $stream.Close()
    $zip.Dispose()
    
    # Simple regex cleaning of word xml tags
    $text = $xml -replace '<w:p[ >]', "`n" -replace '<w:tab/>', "`t" -replace '<[^>]+>', ''
    return [System.Net.WebUtility]::HtmlDecode($text)
}

$files = @(
    "docs/Sai_Ajantha_Website_UI_Checklist.docx",
    "docs/Sai_Ajantha_Website_Product_Presentation_SOP.docx",
    "docs/Sai_Ajantha_Website_Flow_for_Owner_Approval.docx",
    "docs/Sai Ajanta e-commerce website instructions guide to the developer.docx"
)

foreach ($f in $files) {
    if (Test-Path $f) {
        Write-Host "================================================="
        Write-Host "FILE: $f"
        Write-Host "================================================="
        $content = Read-DocxText (Resolve-Path $f)
        $outPath = $f -replace '\.docx$', '.txt'
        $content | Out-File -FilePath $outPath -Encoding utf8
        Write-Host "Saved text summary to $outPath (Length: $($content.Length))"
        Write-Host ($content.Substring(0, [Math]::Min(500, $content.Length)))
    }
}
