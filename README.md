# Prebid Repository Activity Dashboard

A comprehensive Next.js web application for visualizing GitHub repository activity across the Prebid ecosystem. Track contributors, companies, pull requests, issues, and development trends with interactive charts and real-time statistics.

## 🚀 Features

### Dashboard Overview
- **Real-time repository statistics** for 6 Prebid repositories
- **Interactive time-series charts** with automatic granularity
- **Dark/Light theme** support with system preference detection
- **Responsive design** optimized for all screen sizes

### Three Main Views

#### 1. Main Dashboard (`/`)
- Repository cards showing Open PRs, Merged PRs, Opened Issues, and Contributors
- Time-series bar charts with merged PRs, contributors, and issues
- Automatic chart granularity based on time range selection
- Smart date filtering (no future dates shown)
- Dual Y-axes for better scale visualization

#### 2. Contributors Page (`/contributors`)
- Horizontal stacked bar charts showing top contributors
- Filter by repository, metric, and time range
- Adjustable result limit (5-1000 contributors)
- Metrics: Open PRs, Merged PRs, Reviewed PRs, Commits, Issues
- X-axis positioned at top for better visibility

#### 3. Companies Page (`/companies`)
- Company-level aggregation of contributor data
- Member/Non-member filtering
- Shows contributor count per company
- Same powerful filtering as Contributors page
- Automatic mapping from GitHub usernames to company affiliations

## 📊 Data Sources

The dashboard aggregates data from multiple sources:

- **GitHub API Data**: Open PRs, merged PRs, issues stored in `store/repos/`
- **Contributor Statistics**: Time-series data aggregated by week/month/year
- **Company Mapping**: GitHub username to company affiliation mapping

## 🛠️ Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- GitHub personal access token (for data fetching)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/repo-activity-dashboard.git
cd repo-activity-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Add your GitHub token and other configs
```

4. Generate initial data:
```bash
npm run generate:stats
npm run process:mapping
```

5. Start the development server:
```bash
npm run dev
```

Visit `http://localhost:3000` to see the dashboard.

## 📁 Project Structure

```
src/
├── app/                      # Next.js App Router pages
│   ├── page.tsx             # Main dashboard
│   ├── contributors/        # Contributors view
│   └── companies/           # Companies view
├── components/              # React components
│   ├── HorizontalBarChart.tsx
│   └── layout/toolbar.tsx
├── scripts/                 # Data processing scripts
│   ├── generateContributorStats.ts
│   └── processGithubMapping.ts
└── services/               # GitHub API services
store/                      # Data storage
├── repos/                  # Repository data
└── sheets/                 # Company mappings
```

## 🎯 Key Features Explained

### Time Range Filtering
- **This Week/Last Week**: Daily granularity
- **This Month/Last Month**: Weekly granularity  
- **This Year/Last Year**: Monthly granularity
- **All Time**: Yearly granularity

### Metrics Tracked
- **Open PRs**: Currently open pull requests
- **Merged PRs**: Pull requests merged in the time period
- **Opened Issues**: Issues created in the time period
- **Contributors**: Unique contributors (PR authors + issue creators)
- **Commits**: Total commits in merged PRs
- **Reviewed PRs**: Pull requests reviewed by contributors

### Company Affiliation
- Automatically maps GitHub usernames to companies
- Distinguishes between member and non-member organizations
- Aggregates statistics at the company level

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server with Turbopack
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # TypeScript checking

# Data generation
npm run generate:stats     # Generate contributor statistics
npm run process:mapping    # Process company mappings
```

### Technology Stack

- **Framework**: Next.js 14 with App Router and Turbopack
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Charts**: Recharts with custom configurations
- **State**: React hooks
- **Theme**: next-themes
- **Data Processing**: Node.js scripts with csv-parse

## 📈 Data Pipeline

### Current Implementation
1. GitHub API data fetched and stored in JSON files
2. Contributor statistics generated from stored data (tracks PR authors, not mergers)
3. Company mappings processed from CSV (Google Sheets export)
4. Dashboard reads and visualizes the processed data
5. Time-series aggregation at weekly/monthly/yearly levels

### Data Storage Structure
```
store/
├── index.json                    # Master index
└── repos/
    ├── prebid-js/
    │   ├── open-prs.json         # Currently open PRs
    │   ├── open-issues.json      # Currently open issues
    │   ├── merged/               # Merged PRs by month
    │   │   └── YYYY-MM.json
    │   └── closed/               # Closed issues by month
    │       └── YYYY-MM.json
    └── [other-repos]/
```

### Future Improvements
- [ ] Automated data refresh via GitHub Actions
- [ ] Real-time updates via webhooks
- [ ] Database integration for better performance
- [ ] API endpoints for external consumption

## 🚦 Production Deployment

### Prerequisites for Production
1. Set up automated data refresh (GitHub Actions or cron)
2. Implement authentication for sensitive data
3. Configure environment variables
4. Set up monitoring and analytics
5. Optimize data loading for large datasets
6. Add caching layer for improved performance

### Deployment Options
- **Vercel**: Optimized for Next.js (recommended)
- **AWS**: Using Amplify or EC2
- **Docker**: Containerized deployment

### Environment Variables
```env
GITHUB_TOKEN=your_github_token
NEXT_PUBLIC_API_URL=your_api_url
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Known Issues

1. **Real-time Updates**: Data requires manual regeneration
2. **Daily Data**: Limited availability for recent periods
3. **Large Datasets**: Performance optimization needed for repositories with 1000+ items

## 🔮 Roadmap

### Phase 1: Data Quality (Completed)
- ✅ Fixed contributor tracking (now tracks PR authors)
- ✅ Added company mapping integration
- ✅ Improved date handling and filtering

### Phase 2: Production Ready (Current)
- Authentication system
- Automated data pipeline
- Performance optimizations
- Deployment configuration
- Caching implementation

### Phase 3: Enhanced Features
- Real-time updates
- Advanced filtering
- Export functionality
- API for external access

### Phase 4: Scale
- Multi-organization support
- Custom dashboards
- Alerting system
- Historical comparisons

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Prebid.org community for the ecosystem
- Contributors and maintainers
- Open source libraries used in this project

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

Built with ❤️ for the Prebid community