$file = "c:\Users\hp\Desktop\CALQULUS-RMS\supabase\migrations\20230101000000_base_schema.sql"
$content = Get-Content $file
$newContent = @()

for ($i = 0; $i -lt $content.Count; $i++) {
    $newContent += $content[$i]
    if ($content[$i] -match 'FOREIGN KEY \(manager_id\) REFERENCES public\.profiles\(id\) ON DELETE CASCADE;') {
        $newContent += "  END IF;"
        $newContent += "END $$;"
    }
}

$newContent | Set-Content $file
Write-Host "Fixed migration file"
