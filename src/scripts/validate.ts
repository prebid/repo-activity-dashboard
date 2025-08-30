import 'dotenv/config';
import { DataValidator } from '../validation/dataValidator.js';
import { loadRepositories } from '../utils/repoParser.js';

async function validateAllRepositories() {
  const token = process.env.GITHUB_TOKEN;
  const repositories = loadRepositories();
  const validator = new DataValidator('./store', token);
  
  console.log('🔍 Validating data for all repositories...\n');
  
  const results = {
    valid: [] as string[],
    invalid: [] as string[],
    warnings: [] as string[]
  };
  
  for (const repo of repositories) {
    console.log(`Validating ${repo.name}...`);
    
    try {
      const report = await validator.generateFullReport(repo);
      
      if (report.openPRsValidation.valid && report.openIssuesValidation.valid) {
        if (report.recommendations.length === 0) {
          results.valid.push(repo.name);
          console.log(`  ✅ Valid - ${report.completeness.openPRs.stored} PRs, ${report.completeness.openIssues.stored} issues`);
        } else {
          results.warnings.push(repo.name);
          console.log(`  ⚠️  Valid with warnings:`);
          report.recommendations.forEach(rec => console.log(`     - ${rec}`));
        }
      } else {
        results.invalid.push(repo.name);
        console.log(`  ❌ Invalid:`);
        
        if (!report.openPRsValidation.valid) {
          console.log(`     PR errors: ${report.openPRsValidation.errors.length}`);
        }
        if (!report.openIssuesValidation.valid) {
          console.log(`     Issue errors: ${report.openIssuesValidation.errors.length}`);
        }
      }
      
      if (report.completeness.dateUpdatedCheck.prsWithoutDateUpdated.length > 0) {
        console.log(`     Missing dateUpdated on PRs: ${report.completeness.dateUpdatedCheck.prsWithoutDateUpdated.join(', ')}`);
      }
      if (report.completeness.dateUpdatedCheck.issuesWithoutDateUpdated.length > 0) {
        console.log(`     Missing dateUpdated on issues: ${report.completeness.dateUpdatedCheck.issuesWithoutDateUpdated.join(', ')}`);
      }
    } catch (error) {
      results.invalid.push(repo.name);
      console.log(`  ❌ Error: ${error}`);
    }
    
    console.log();
  }
  
  console.log('=' .repeat(60));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Valid: ${results.valid.length} repositories`);
  if (results.valid.length > 0) {
    console.log(`   ${results.valid.join(', ')}`);
  }
  console.log(`⚠️  Warnings: ${results.warnings.length} repositories`);
  if (results.warnings.length > 0) {
    console.log(`   ${results.warnings.join(', ')}`);
  }
  console.log(`❌ Invalid: ${results.invalid.length} repositories`);
  if (results.invalid.length > 0) {
    console.log(`   ${results.invalid.join(', ')}`);
  }
  
  process.exit(results.invalid.length > 0 ? 1 : 0);
}

validateAllRepositories().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});