import 'dotenv/config';
import { Octokit } from '@octokit/rest';

function validateEnvironment() {
  const requiredEnvVars = ['GITHUB_TOKEN'];
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('💡 Copy .env.example to .env and fill in your values');
    process.exit(1);
  }
}

function createOctokitClient() {
  validateEnvironment();
  
  return new Octokit({
    auth: process.env.GITHUB_TOKEN,
    baseUrl: process.env.GITHUB_API_URL || 'https://api.github.com',
  });
}

async function main() {
  console.log('🚀 Repository Activity Dashboard');
  
  const octokit = createOctokitClient();
  
  try {
    const { data: user } = await octokit.rest.users.getAuthenticated();
    console.log(`👋 Hello, ${user.login}!`);
    console.log(`📧 Email: ${user.email || 'Not public'}`);
    console.log(`📊 Public repos: ${user.public_repos}`);
  } catch (error) {
    console.error('❌ Error accessing GitHub API:', error);
    process.exit(1);
  }
}

main().catch(console.error);