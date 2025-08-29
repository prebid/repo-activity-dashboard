# Repository Activity Dashboard

A TypeScript Node.js application for tracking and analyzing GitHub repository activity using the GitHub API.

## Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Environment configuration:**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and add your GitHub personal access token:
   ```
   GITHUB_TOKEN=your_github_personal_access_token_here
   ```

3. **Create a GitHub Personal Access Token:**
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate a new token with appropriate repository permissions

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run the compiled application
- `npm run clean` - Remove build artifacts

## Tech Stack

- **TypeScript** - Primary language
- **Node.js** - Runtime environment
- **@octokit/rest** - GitHub API client
- **dotenv** - Environment variable management