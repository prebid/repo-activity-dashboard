'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Repository list
const repositories = [
  'Prebid.js',
  'Prebid Server',
  'Prebid Server Java',
  'Prebid Mobile iOS',
  'Prebid Mobile Android',
  'Prebid Docs',
];

// Dummy data for the chart
const chartData = [
  { month: 'Jan', value: 186 },
  { month: 'Feb', value: 305 },
  { month: 'Mar', value: 237 },
  { month: 'Apr', value: 73 },
  { month: 'May', value: 209 },
  { month: 'Jun', value: 214 },
];

export default function Home() {
  const [activeMetric, setActiveMetric] = useState('open');
  const [timeRange, setTimeRange] = useState('This Week');

  return (
    <div className="w-full py-8" style={{ paddingLeft: '0.1rem', paddingRight: '0.1rem', paddingTop: '2rem' }}>
      {/* Time Range Selector */}
      <div style={{ paddingLeft: '1rem', paddingRight: '1rem', marginBottom: '2rem' }}>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="This Week">This Week</SelectItem>
            <SelectItem value="Last Week">Last Week</SelectItem>
            <SelectItem value="This Month">This Month</SelectItem>
            <SelectItem value="Last Month">Last Month</SelectItem>
            <SelectItem value="This Year">This Year</SelectItem>
            <SelectItem value="Last Year">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex flex-row justify-between" style={{ gap: '0.75rem' }}>
        {/* First Chart */}
        <div style={{ width: 'calc(33.333% - 0.5rem)' }}>
          <Card>
          <div className="flex flex-row items-stretch space-y-0 border-b p-0">
            <div className="flex flex-1 flex-col justify-center gap-1 py-3" style={{ paddingLeft: '1.5rem' }}>
              <h3 className="text-base font-semibold" style={{ transform: 'scale(1.5) translate(1rem, 0.5rem)', transformOrigin: 'left center' }}>
                {repositories[0]}
              </h3>
              <p className="text-xs text-muted-foreground" style={{ visibility: 'hidden' }}>
                Showing total activity for the last 6 months
              </p>
            </div>
            <div className="flex">
              <button
                type="button"
                data-active={activeMetric === 'open'}
                onClick={() => setActiveMetric('open')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'open' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Open PRs</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>234</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'merged'}
                onClick={() => setActiveMetric('merged')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'merged' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Merged PRs</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>1,429</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'openIssues'}
                onClick={() => setActiveMetric('openIssues')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'openIssues' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Open Issues</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>87</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'closedIssues'}
                onClick={() => setActiveMetric('closedIssues')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'closedIssues' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Closed Issues</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>542</span>
              </button>
            </div>
          </div>
          
          <CardContent className="pt-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false}
                    horizontal={true}
                    strokeOpacity={0.3}
                  />
                  <XAxis 
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    stroke="#888888"
                  />
                  <YAxis 
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    stroke="#888888"
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Second Chart (Duplicate) */}
        <div style={{ width: 'calc(33.333% - 0.5rem)' }}>
          <Card>
          <div className="flex flex-row items-stretch space-y-0 border-b p-0">
            <div className="flex flex-1 flex-col justify-center gap-1 py-3" style={{ paddingLeft: '1.5rem' }}>
              <h3 className="text-base font-semibold" style={{ transform: 'scale(1.5) translate(1rem, 0.5rem)', transformOrigin: 'left center' }}>
                {repositories[1]}
              </h3>
              <p className="text-xs text-muted-foreground" style={{ visibility: 'hidden' }}>
                Showing total activity for the last 6 months
              </p>
            </div>
            <div className="flex">
              <button
                type="button"
                data-active={activeMetric === 'open'}
                onClick={() => setActiveMetric('open')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'open' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Open PRs</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>234</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'merged'}
                onClick={() => setActiveMetric('merged')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'merged' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Merged PRs</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>1,429</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'openIssues'}
                onClick={() => setActiveMetric('openIssues')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'openIssues' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Open Issues</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>87</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'closedIssues'}
                onClick={() => setActiveMetric('closedIssues')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'closedIssues' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Closed Issues</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>542</span>
              </button>
            </div>
          </div>
          
          <CardContent className="pt-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false}
                    horizontal={true}
                    strokeOpacity={0.3}
                  />
                  <XAxis 
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    stroke="#888888"
                  />
                  <YAxis 
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    stroke="#888888"
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Third Chart (Duplicate) */}
        <div style={{ width: 'calc(33.333% - 0.5rem)' }}>
          <Card>
          <div className="flex flex-row items-stretch space-y-0 border-b p-0">
            <div className="flex flex-1 flex-col justify-center gap-1 py-3" style={{ paddingLeft: '1.5rem' }}>
              <h3 className="text-base font-semibold" style={{ transform: 'scale(1.5) translate(1rem, 0.5rem)', transformOrigin: 'left center' }}>
                {repositories[2]}
              </h3>
              <p className="text-xs text-muted-foreground" style={{ visibility: 'hidden' }}>
                Showing total activity for the last 6 months
              </p>
            </div>
            <div className="flex">
              <button
                type="button"
                data-active={activeMetric === 'open'}
                onClick={() => setActiveMetric('open')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'open' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Open PRs</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>234</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'merged'}
                onClick={() => setActiveMetric('merged')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'merged' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Merged PRs</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>1,429</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'openIssues'}
                onClick={() => setActiveMetric('openIssues')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'openIssues' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Open Issues</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>87</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'closedIssues'}
                onClick={() => setActiveMetric('closedIssues')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'closedIssues' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Closed Issues</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>542</span>
              </button>
            </div>
          </div>
          
          <CardContent className="pt-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false}
                    horizontal={true}
                    strokeOpacity={0.3}
                  />
                  <XAxis 
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    stroke="#888888"
                  />
                  <YAxis 
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    stroke="#888888"
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Second Row of Charts */}
      <div className="flex flex-row justify-between" style={{ gap: '0.75rem', marginTop: '4rem' }}>
        {/* Fourth Chart */}
        <div style={{ width: 'calc(33.333% - 0.5rem)' }}>
          <Card>
          <div className="flex flex-row items-stretch space-y-0 border-b p-0">
            <div className="flex flex-1 flex-col justify-center gap-1 py-3" style={{ paddingLeft: '1.5rem' }}>
              <h3 className="text-base font-semibold" style={{ transform: 'scale(1.5) translate(1rem, 0.5rem)', transformOrigin: 'left center' }}>
                {repositories[3]}
              </h3>
              <p className="text-xs text-muted-foreground" style={{ visibility: 'hidden' }}>
                Showing total activity for the last 6 months
              </p>
            </div>
            <div className="flex">
              <button
                type="button"
                data-active={activeMetric === 'open'}
                onClick={() => setActiveMetric('open')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'open' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Open PRs</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>234</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'merged'}
                onClick={() => setActiveMetric('merged')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'merged' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Merged PRs</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>1,429</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'openIssues'}
                onClick={() => setActiveMetric('openIssues')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'openIssues' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Open Issues</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>87</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'closedIssues'}
                onClick={() => setActiveMetric('closedIssues')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'closedIssues' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Closed Issues</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>542</span>
              </button>
            </div>
          </div>
          
          <CardContent className="pt-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false}
                    horizontal={true}
                    strokeOpacity={0.3}
                  />
                  <XAxis 
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    stroke="#888888"
                  />
                  <YAxis 
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    stroke="#888888"
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Fifth Chart */}
        <div style={{ width: 'calc(33.333% - 0.5rem)' }}>
          <Card>
          <div className="flex flex-row items-stretch space-y-0 border-b p-0">
            <div className="flex flex-1 flex-col justify-center gap-1 py-3" style={{ paddingLeft: '1.5rem' }}>
              <h3 className="text-base font-semibold" style={{ transform: 'scale(1.5) translate(1rem, 0.5rem)', transformOrigin: 'left center' }}>
                {repositories[4]}
              </h3>
              <p className="text-xs text-muted-foreground" style={{ visibility: 'hidden' }}>
                Showing total activity for the last 6 months
              </p>
            </div>
            <div className="flex">
              <button
                type="button"
                data-active={activeMetric === 'open'}
                onClick={() => setActiveMetric('open')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'open' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Open PRs</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>234</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'merged'}
                onClick={() => setActiveMetric('merged')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'merged' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Merged PRs</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>1,429</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'openIssues'}
                onClick={() => setActiveMetric('openIssues')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'openIssues' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Open Issues</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>87</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'closedIssues'}
                onClick={() => setActiveMetric('closedIssues')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'closedIssues' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Closed Issues</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>542</span>
              </button>
            </div>
          </div>
          
          <CardContent className="pt-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false}
                    horizontal={true}
                    strokeOpacity={0.3}
                  />
                  <XAxis 
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    stroke="#888888"
                  />
                  <YAxis 
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    stroke="#888888"
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Sixth Chart */}
        <div style={{ width: 'calc(33.333% - 0.5rem)' }}>
          <Card>
          <div className="flex flex-row items-stretch space-y-0 border-b p-0">
            <div className="flex flex-1 flex-col justify-center gap-1 py-3" style={{ paddingLeft: '1.5rem' }}>
              <h3 className="text-base font-semibold" style={{ transform: 'scale(1.5) translate(1rem, 0.5rem)', transformOrigin: 'left center' }}>
                {repositories[5]}
              </h3>
              <p className="text-xs text-muted-foreground" style={{ visibility: 'hidden' }}>
                Showing total activity for the last 6 months
              </p>
            </div>
            <div className="flex">
              <button
                type="button"
                data-active={activeMetric === 'open'}
                onClick={() => setActiveMetric('open')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'open' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Open PRs</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>234</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'merged'}
                onClick={() => setActiveMetric('merged')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'merged' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Merged PRs</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>1,429</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'openIssues'}
                onClick={() => setActiveMetric('openIssues')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'openIssues' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Open Issues</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>87</span>
              </button>
              
              <button
                type="button"
                data-active={activeMetric === 'closedIssues'}
                onClick={() => setActiveMetric('closedIssues')}
                className={`relative z-30 flex flex-col items-center justify-center border-l px-5 py-5 bg-muted/50 hover:bg-muted/70 ${
                  activeMetric === 'closedIssues' ? 'ring-2 ring-primary/20' : ''
                }`}
              >
                <span style={{ fontSize: '12px', marginBottom: '6px' }} className="text-muted-foreground">Closed Issues</span>
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1, color: '#FF9500' }}>542</span>
              </button>
            </div>
          </div>
          
          <CardContent className="pt-6">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    vertical={false}
                    horizontal={true}
                    strokeOpacity={0.3}
                  />
                  <XAxis 
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    stroke="#888888"
                  />
                  <YAxis 
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                    stroke="#888888"
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 'var(--radius)',
                    }}
                  />
                  <Bar 
                    dataKey="value" 
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

    </div>
  );
}