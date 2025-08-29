# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Type
This is a TypeScript Node.js project for building a repository activity dashboard using the GitHub API.

## Development Commands
- `npm run dev` - Start development server with hot reload using ts-node
- `npm run build` - Compile TypeScript to JavaScript in dist/
- `npm run start` - Run the compiled JavaScript from dist/
- `npm run clean` - Remove the dist/ directory

## TypeScript Configuration
- **Primary Language**: TypeScript (always prefer .ts files over .js)
- **Source Directory**: `src/` - all TypeScript source files
- **Output Directory**: `dist/` - compiled JavaScript files
- **Module System**: ES modules with NodeNext resolution
- **Target**: ES2022

## Architecture
- Entry point: `src/index.ts`
- Uses @octokit/rest for GitHub API interactions
- Configured for ES modules with strict TypeScript checking
- Environment variables should be used for API tokens (GITHUB_TOKEN)

## Development Guidelines
- Always write TypeScript (.ts) files, not JavaScript
- Use ES module imports/exports
- Follow strict TypeScript configuration
- Use Octokit client for GitHub API calls
- Store sensitive data like tokens in environment variables