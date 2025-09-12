'use client';

import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';

interface ChartDataItem {
  name: string;
  prebidjs: number;
  prebidserver: number;
  prebidserverjava: number;
  prebidmobileios: number;
  prebidmobileandroid: number;
  prebiddocs: number;
}

interface HorizontalBarChartProps {
  data: ChartDataItem[];
}

export function HorizontalBarChart({ data }: HorizontalBarChartProps) {
  console.log('HorizontalBarChart received data:', data);
  console.log('Data length:', data.length);
  if (data.length > 0) {
    console.log('First item:', data[0]);
  }
  
  // Use provided data, no fallback for empty data
  const chartData = data;
  
  // Show message when no data
  if (chartData.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        color: '#666'
      }}>
        <p>No data available for the selected time period</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart 
        data={chartData}
        margin={{ top: 40, right: 30, bottom: 60, left: 150 }}
        layout="vertical"
      >
        <CartesianGrid 
          strokeDasharray="3 3" 
          strokeOpacity={0.3}
        />
        {/* X-axis at top */}
        <XAxis 
          type="number"
          orientation="top"
          tick={{ fontSize: 11 }}
          stroke="#888"
        />
        <YAxis 
          type="category" 
          dataKey="name"
          width={140}
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => {
            // Truncate long names
            return value.length > 20 ? value.substring(0, 20) + '...' : value;
          }}
        />
        <Tooltip 
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
          }}
        />
        <Legend 
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ 
            paddingLeft: '20px',
          }}
          content={(props) => {
            const { payload } = props;
            return (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {payload?.map((entry, index) => (
                  <li key={`item-${index}`} style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '20px',
                        height: '20px',
                        backgroundColor: entry.color,
                        marginRight: '12px',
                      }}
                    />
                    <span style={{ fontSize: '16px' }}>{entry.value}</span>
                  </li>
                ))}
              </ul>
            );
          }}
        />
        <Bar dataKey="prebidjs" stackId="a" fill="#10B981" name="Prebid.js" />
        <Bar dataKey="prebidserver" stackId="a" fill="#8B5CF6" name="Prebid Server" />
        <Bar dataKey="prebidserverjava" stackId="a" fill="#EF4444" name="Prebid Server Java" />
        <Bar dataKey="prebidmobileios" stackId="a" fill="#F59E0B" name="Prebid Mobile iOS" />
        <Bar dataKey="prebidmobileandroid" stackId="a" fill="#3B82F6" name="Prebid Mobile Android" />
        <Bar dataKey="prebiddocs" stackId="a" fill="#EC4899" name="Prebid Docs" />
      </BarChart>
    </ResponsiveContainer>
  );
}