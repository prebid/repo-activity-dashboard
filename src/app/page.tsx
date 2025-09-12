'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
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
  const [selectedRepo, setSelectedRepo] = useState(repositories[0]);
  const [activeMetric, setActiveMetric] = useState('open');

  return (
    <div className="w-full py-8" style={{ paddingLeft: '0.1rem', paddingRight: '0.1rem', paddingTop: '2rem' }}>
      <div className="flex flex-row justify-between" style={{ gap: '0.75rem' }}>
        {/* First Chart */}
        <div style={{ width: 'calc(33.333% - 0.5rem)' }}>
          <Card>
          <div className="flex flex-row items-stretch space-y-0 border-b p-0">
            <div className="flex flex-1 flex-col justify-center gap-1 py-4" style={{ paddingLeft: '1.5rem' }}>
              <h3 className="text-xl font-semibold leading-none tracking-tight">
                {repositories[0]}
              </h3>
              <p className="text-xs text-muted-foreground">
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">234</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">1,429</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">87</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">542</span>
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
            <div className="flex flex-1 flex-col justify-center gap-1 py-4" style={{ paddingLeft: '1.5rem' }}>
              <h3 className="text-xl font-semibold leading-none tracking-tight">
                {repositories[1]}
              </h3>
              <p className="text-xs text-muted-foreground">
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">234</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">1,429</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">87</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">542</span>
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
            <div className="flex flex-1 flex-col justify-center gap-1 py-4" style={{ paddingLeft: '1.5rem' }}>
              <h3 className="text-xl font-semibold leading-none tracking-tight">
                {repositories[2]}
              </h3>
              <p className="text-xs text-muted-foreground">
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">234</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">1,429</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">87</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">542</span>
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
            <div className="flex flex-1 flex-col justify-center gap-1 py-4" style={{ paddingLeft: '1.5rem' }}>
              <h3 className="text-xl font-semibold leading-none tracking-tight">
                {repositories[3]}
              </h3>
              <p className="text-xs text-muted-foreground">
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">234</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">1,429</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">87</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">542</span>
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
            <div className="flex flex-1 flex-col justify-center gap-1 py-4" style={{ paddingLeft: '1.5rem' }}>
              <h3 className="text-xl font-semibold leading-none tracking-tight">
                {repositories[4]}
              </h3>
              <p className="text-xs text-muted-foreground">
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">234</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">1,429</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">87</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">542</span>
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
            <div className="flex flex-1 flex-col justify-center gap-1 py-4" style={{ paddingLeft: '1.5rem' }}>
              <h3 className="text-xl font-semibold leading-none tracking-tight">
                {repositories[5]}
              </h3>
              <p className="text-xs text-muted-foreground">
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">234</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">1,429</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">87</span>
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
                <span style={{ fontSize: '36px', fontWeight: 'bold', lineHeight: 1 }} className="text-foreground">542</span>
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

      {/* Repository Selector */}
      <div className="mt-6">
        <div className="flex flex-wrap gap-2">
          {repositories.map((repo) => (
            <button
              key={repo}
              onClick={() => setSelectedRepo(repo)}
              className={`px-4 py-2 rounded-lg border transition-all text-sm ${
                selectedRepo === repo
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-accent'
              }`}
            >
              {repo}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}