'use client';

import * as React from 'react';
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ChartProps {
  data: any[];
  index: string;
  categories: string[];
  colors?: string[];
  valueFormatter?: (value: number) => string;
  yAxisWidth?: number;
  showLegend?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showTooltip?: boolean;
  showGrid?: boolean;
  stack?: boolean;
  customTooltip?: React.ComponentType<any>;
}

// Simple line chart component
export function LineChart({
  data,
  index,
  categories,
  colors = ['#3b82f6', '#16a34a', '#ef4444'],
  valueFormatter = value => value.toString(),
  yAxisWidth = 56,
  showLegend = true,
  showXAxis = true,
  showYAxis = true,
  showTooltip = true,
  showGrid = true,
  customTooltip,
}: ChartProps) {
  return (
    <ResponsiveContainer width='100%' height='100%'>
      <RechartsLineChart
        data={data}
        margin={{ top: 5, right: 10, left: 5, bottom: 5 }}
      >
        {showGrid && <CartesianGrid strokeDasharray='3 3' stroke='#d4d4d8' />}
        {showXAxis && (
          <XAxis
            dataKey={index}
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
        )}
        {showYAxis && (
          <YAxis
            width={yAxisWidth}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={valueFormatter}
          />
        )}
        {showTooltip && (
          <Tooltip
            content={customTooltip}
            formatter={(value: number) => [valueFormatter(value), '']}
            cursor={{ stroke: '#d4d4d8', strokeDasharray: '3 3' }}
          />
        )}
        {showLegend && <Legend />}
        {categories.map((category, i) => (
          <Line
            key={`line-${category}`}
            type='monotone'
            dataKey={category}
            stroke={colors[i % colors.length]}
            strokeWidth={2}
            dot={{ r: 1 }}
            activeDot={{ r: 4 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}

// Bar chart component
export function BarChart({
  data,
  index,
  categories,
  colors = ['#3b82f6', '#16a34a', '#ef4444'],
  valueFormatter = value => value.toString(),
  yAxisWidth = 56,
  showLegend = true,
  showXAxis = true,
  showYAxis = true,
  showTooltip = true,
  showGrid = true,
  stack = false,
}: ChartProps) {
  return (
    <ResponsiveContainer width='100%' height='100%'>
      <RechartsBarChart
        data={data}
        margin={{ top: 10, right: 10, left: 5, bottom: 5 }}
      >
        {showGrid && <CartesianGrid strokeDasharray='3 3' stroke='#d4d4d8' />}
        {showXAxis && (
          <XAxis
            dataKey={index}
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
        )}
        {showYAxis && (
          <YAxis
            width={yAxisWidth}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={valueFormatter}
          />
        )}
        {showTooltip && (
          <Tooltip
            formatter={(value: number) => [valueFormatter(value), '']}
            cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
          />
        )}
        {showLegend && <Legend />}
        {categories.map((category, i) => (
          <Bar
            key={`bar-${category}`}
            dataKey={category}
            fill={colors[i % colors.length]}
            stackId={stack ? 'stack' : undefined}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

// Pie chart component
interface PieChartProps {
  data: any[];
  index: string;
  category: string;
  colors?: string[];
  valueFormatter?: (value: number) => string;
  showLegend?: boolean;
  showTooltip?: boolean;
  innerRadius?: number;
  outerRadius?: number;
}

export function PieChart({
  data,
  index,
  category,
  colors = ['#3b82f6', '#16a34a', '#ef4444', '#f59e0b', '#8b5cf6', '#14b8a6'],
  valueFormatter = value => value.toString(),
  showLegend = true,
  showTooltip = true,
  innerRadius = 0,
  outerRadius = 80,
}: PieChartProps) {
  return (
    <ResponsiveContainer width='100%' height='100%'>
      <RechartsPieChart>
        {showTooltip && (
          <Tooltip formatter={(value: number) => [valueFormatter(value), '']} />
        )}
        {showLegend && <Legend />}
        <Pie
          data={data}
          dataKey={category}
          nameKey={index}
          cx='50%'
          cy='50%'
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          label={({ name, percent }) =>
            `${name}: ${(percent * 100).toFixed(0)}%`
          }
          labelLine={true}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}
