$file = "c:\Users\hp\Desktop\CALQULUS-RMS\supabase\migrations\20230101000000_base_schema.sql"
$content = Get-Content $file
$newContent = @()

$inDoBlock = $false
$doBlockContent = @()

for ($i = 0; $i -lt $content.Count; $i++) {
    $line = $content[$i]
    
    # Fix END ; to END $$
    if ($line -match '^\s*END\s*;$') {
        $line = $line -replace 'END\s*;$', 'END $$;'
    }
    
    # Convert ADD CONSTRAINT IF NOT EXISTS to DO blocks
    if ($line -match '^\s*ALTER TABLE public\.(\w+)\s*$') {
        $tableName = $matches[1]
        # Look ahead to see if this is an ADD CONSTRAINT IF NOT EXISTS
        if ($i + 1 -lt $content.Count -and $content[$i+1] -match '^\s*ADD CONSTRAINT IF NOT EXISTS (\w+)_fkey') {
            $constraintName = $matches[1]
            # Look ahead to get the full constraint definition
            $constraintLines = @()
            $j = $i + 1
            while ($j -lt $content.Count -and -not ($content[$j] -match '^--')) {
                $constraintLines += $content[$j]
                if ($content[$j] -match ';$') {
                    $j++
                    break
                }
                $j++
            }
            
            # Extract the foreign key definition
            $fkDefinition = $constraintLines -join ' '
            if ($fkDefinition -match 'ADD CONSTRAINT IF NOT EXISTS (\w+)_fkey\s+FOREIGN KEY \((\w+)\) REFERENCES (\w+)\((\w+)\)(.*)$') {
                $constraintName = $matches[1]
                $column = $matches[2]
                $refTable = $matches[3]
                $refColumn = $matches[4]
                $onDelete = $matches[5].Trim()
                
                # Generate DO block
                $newContent += "-- $tableName → $refTable"
                $newContent += "DO $$"
                $newContent += "BEGIN"
                $newContent += "  IF NOT EXISTS ("
                $newContent += "    SELECT 1 FROM pg_constraint"
                $newContent += "    WHERE conname = '$constraintName'"
                $newContent += "  ) THEN"
                $newContent += "    ALTER TABLE public.$tableName"
                $newContent += "      ADD CONSTRAINT $constraintName"
                $newContent += "      FOREIGN KEY ($column) REFERENCES public.$refTable($refColumn) $onDelete"
                $newContent += "  END IF;"
                $newContent += "END $$;"
                
                # Skip the original constraint lines
                $i = $j - 1
                continue
            }
        }
    }
    
    $newContent += $line
}

$newContent | Set-Content $file
Write-Host "Fixed all ADD CONSTRAINT IF NOT EXISTS statements"
