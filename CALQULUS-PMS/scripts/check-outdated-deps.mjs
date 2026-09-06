/**
 * check-outdated-deps.mjs - Check for outdated major versions of dependencies
 * 
 * This script checks if any dependencies have major version updates available
 * and generates a report for the CI pipeline.
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

const CRITICAL_OUTDATED = [
  // Add packages that should always be up to date
];

async function main() {
  console.log('Checking for outdated dependencies...\n');
  
  try {
    // Get outdated packages
    const output = execSync('npm outdated --json', { encoding: 'utf8' });
    const outdated = JSON.parse(output);
    
    const majorUpdates = [];
    const minorUpdates = [];
    
    for (const [name, info] of Object.entries(outdated)) {
      if (info['major'] !== '0' && info['latest']) {
        majorUpdates.push({
          name,
          current: info['current'],
          latest: info['latest'],
          type: 'major'
        });
      } else if (info['minor'] !== '0') {
        minorUpdates.push({
          name,
          current: info['current'],
          latest: info['latest'],
          type: 'minor/patch'
        });
      }
    }
    
    // Generate report
    let report = '# Dependency Update Report\n\n';
    
    if (majorUpdates.length > 0) {
      report += '## ⚠️ Major Version Updates Available\n\n';
      report += '| Package | Current | Latest | Status |\n';
      report += '|---------|--------|--------|--------|\n';
      for (const dep of majorUpdates) {
        const status = CRITICAL_OUTDATED.includes(dep.name) ? '🔴 Critical' : '🟡 Review';
        report += `| ${dep.name} | ${dep.current} | ${dep.latest} | ${status} |\n`;
      }
      report += '\n';
    }
    
    if (minorUpdates.length > 0) {
      report += `## 📦 Minor/Patch Updates (${minorUpdates.length})\n\n`;
      for (const dep of minorUpdates.slice(0, 10)) {
        report += `- ${dep.name}: ${dep.current} → ${dep.latest}\n`;
      }
      if (minorUpdates.length > 10) {
        report += `\n*...and ${minorUpdates.length - 10} more*\n`;
      }
      report += '\n';
    }
    
    if (majorUpdates.length === 0 && minorUpdates.length === 0) {
      report += '✅ All dependencies are up to date!\n';
    }
    
    // Write report
    writeFileSync('outdated-summary.md', report);
    
    // Print to console
    console.log(report);
    
    // Exit with error if critical major updates
    const criticalCount = majorUpdates.filter(d => CRITICAL_OUTDATED.includes(d.name)).length;
    if (criticalCount > 0) {
      console.log(`\n❌ ${criticalCount} critical dependency updates available`);
      process.exit(1);
    }
    
    if (majorUpdates.length > 0) {
      console.log(`\n⚠️ ${majorUpdates.length} major version updates available - review recommended`);
    } else {
      console.log('\n✅ Dependencies are healthy');
    }
    
  } catch (error) {
    if (error.status === 0) {
      // npm outdated returns exit code 1 when there are outdated deps
      console.log('Dependencies are up to date');
      writeFileSync('outdated-summary.md', '# Dependencies Up to Date\n\n✅ All dependencies are current.\n');
    } else {
      console.error('Error checking dependencies:', error.message);
      process.exit(0); // Don't fail the build
    }
  }
}

main();
