import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

interface UserMapping {
  Username: string;
  Name: string;
  Company: string;
  Notes: string;
  Member: 'Yes' | 'No' | 'Unknown' | 'Prebid' | '';
  'PMC Reviewer': string;
  'PMC Reviewer Notes': string;
}

interface CompanyMapping {
  [username: string]: {
    company: string;
    category: 'member' | 'non-member' | 'prebid';
    isMember: boolean;
    name?: string;
  };
}

function cleanCompanyName(company: string): string {
  if (!company) return '';
  
  // Remove content in parentheses and trim
  let cleaned = company.replace(/\s*\([^)]*\)/g, '').trim();
  
  return cleaned;
}

function processMapping(): void {
  console.log('🔄 Processing GitHub mapping CSV...\n');
  
  // Read and parse CSV
  const csvContent = readFileSync('./store/sheets/Github Mapping - User List.csv', 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as UserMapping[];
  
  console.log(`📊 Found ${records.length} users in CSV`);
  
  // Create mapping
  const mapping: CompanyMapping = {};
  
  // Process CSV records
  let memberCount = 0;
  let nonMemberCount = 0;
  let unknownCount = 0;
  const companies = new Set<string>();
  
  records.forEach(record => {
    const username = record.Username?.toLowerCase();
    if (!username) return;

    const company = cleanCompanyName(record.Company) || 'Unknown Organization';
    const isPrebid = record.Member === 'Prebid';
    const isMember = record.Member === 'Yes' || isPrebid;
    const category = isPrebid ? 'prebid' : (record.Member === 'Yes' ? 'member' : 'non-member');

    mapping[username] = {
      company,
      category,
      isMember,
      name: record.Name || undefined
    };

    companies.add(company);

    if (record.Member === 'Yes') memberCount++;
    else if (record.Member === 'No') nonMemberCount++;
    else unknownCount++;
  });
  
  // Save mapping to JSON
  const outputPath = './store/sheets/github-mapping.json';
  writeFileSync(outputPath, JSON.stringify({
    metadata: {
      generated: new Date().toISOString(),
      totalUsers: Object.keys(mapping).length,
      memberCount: memberCount,
      nonMemberCount,
      unknownCount,
      uniqueCompanies: companies.size
    },
    mapping
  }, null, 2));
  
  console.log(`\n📈 Statistics:`);
  console.log(`  - Total users: ${Object.keys(mapping).length}`);
  console.log(`  - Members: ${memberCount}`);
  console.log(`  - Non-members: ${nonMemberCount}`);
  console.log(`  - Unknown status: ${unknownCount}`);
  console.log(`  - Unique companies: ${companies.size}`);
  console.log(`\n💾 Saved mapping to ${outputPath}`);
  
  // Show sample of companies
  console.log(`\n🏢 Sample companies:`);
  Array.from(companies).slice(0, 10).forEach(company => {
    console.log(`  - ${company}`);
  });
}

// Run the processing
processMapping();