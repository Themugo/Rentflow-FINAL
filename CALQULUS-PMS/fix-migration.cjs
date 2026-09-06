const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'supabase/migrations/20230101000000_base_schema.sql');

let content = fs.readFileSync(filePath, 'utf-8');

// Fix END $; to END $$ - use a simpler pattern
content = content.replace(/END \$;/g, 'END $$;');

// Replace all ADD CONSTRAINT IF NOT EXISTS with DO blocks using regex
// Pattern matches the 4-line pattern of foreign key constraints (with _fkey suffix)
const constraintPattern = /(-- [^\n]+\nALTER TABLE public\.\w+\n  ADD CONSTRAINT IF NOT EXISTS \w+_fkey\n  FOREIGN KEY \([^)]+\) REFERENCES [^;]+;)/g;

content = content.replace(constraintPattern, (match) => {
  const lines = match.split('\n');
  const comment = lines[0];
  const tableLine = lines[1];
  const constraintLine = lines[2];
  const fkLine = lines[3];
  
  // Extract constraint name
  const constraintName = constraintLine.match(/ADD CONSTRAINT IF NOT EXISTS (\w+_fkey)/)[1];
  
  return `${comment}
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = '${constraintName}'
  ) THEN
    ${tableLine}
      ADD CONSTRAINT ${constraintName}
      ${fkLine}
  END IF;
END $$;`;
});

// Replace 3-line pattern (without comment) with _fkey suffix
const constraintPattern3 = /(ALTER TABLE public\.\w+\n  ADD CONSTRAINT IF NOT EXISTS \w+_fkey\n  FOREIGN KEY \([^)]+\) REFERENCES [^;]+;)/g;

content = content.replace(constraintPattern3, (match) => {
  const lines = match.split('\n');
  const tableLine = lines[0];
  const constraintLine = lines[1];
  const fkLine = lines[2];
  
  // Extract constraint name
  const constraintName = constraintLine.match(/ADD CONSTRAINT IF NOT EXISTS (\w+_fkey)/)[1];
  
  return `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = '${constraintName}'
  ) THEN
    ${tableLine}
      ADD CONSTRAINT ${constraintName}
      ${fkLine}
  END IF;
END $$;`;
});

// Replace all other ADD CONSTRAINT IF NOT EXISTS patterns (without _fkey suffix)
// Pattern matches 3-line pattern for any constraint name
const constraintPatternAny = /(ALTER TABLE public\.\w+\n  ADD CONSTRAINT IF NOT EXISTS \w+\n  FOREIGN KEY \([^)]+\) REFERENCES [^;]+;)/g;

content = content.replace(constraintPatternAny, (match) => {
  const lines = match.split('\n');
  const tableLine = lines[0];
  const constraintLine = lines[1];
  const fkLine = lines[2];
  
  // Extract constraint name
  const constraintName = constraintLine.match(/ADD CONSTRAINT IF NOT EXISTS (\w+)/)[1];
  
  return `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = '${constraintName}'
  ) THEN
    ${tableLine}
      ADD CONSTRAINT ${constraintName}
      ${fkLine}
  END IF;
END $$;`;
});

// Replace any remaining ADD CONSTRAINT (without IF NOT EXISTS) with DO blocks
// Pattern matches 3-line pattern for any constraint name
const constraintPatternSimple = /(ALTER TABLE public\.\w+\n  ADD CONSTRAINT \w+\n  FOREIGN KEY \([^)]+\) REFERENCES [^;]+;)/g;

content = content.replace(constraintPatternSimple, (match) => {
  const lines = match.split('\n');
  const tableLine = lines[0];
  const constraintLine = lines[1];
  const fkLine = lines[2];
  
  // Extract constraint name
  const constraintName = constraintLine.match(/ADD CONSTRAINT (\w+)/)[1];
  
  return `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = '${constraintName}'
  ) THEN
    ${tableLine}
      ADD CONSTRAINT ${constraintName}
      ${fkLine}
  END IF;
END $$;`;
});

// Replace any remaining ADD CONSTRAINT with comment pattern
// Pattern matches 4-line pattern with comment
const constraintPatternComment = /(-- [^\n]+\nALTER TABLE public\.\w+\n  ADD CONSTRAINT \w+\n  FOREIGN KEY \([^)]+\) REFERENCES [^;]+;)/g;

content = content.replace(constraintPatternComment, (match) => {
  const lines = match.split('\n');
  const comment = lines[0];
  const tableLine = lines[1];
  const constraintLine = lines[2];
  const fkLine = lines[3];
  
  // Extract constraint name
  const constraintName = constraintLine.match(/ADD CONSTRAINT (\w+)/)[1];
  
  return `${comment}
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = '${constraintName}'
  ) THEN
    ${tableLine}
      ADD CONSTRAINT ${constraintName}
      ${fkLine}
  END IF;
END $$;`;
});

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed all ADD CONSTRAINT statements to use DO blocks and END $; to END $$;');
