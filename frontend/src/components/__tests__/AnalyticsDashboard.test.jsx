import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AnalyticsDashboard } from '../AnalyticsDashboard';

// Mock Recharts responsive container & bar chart to avoid jsdom layout errors
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => <div className="responsive-container">{children}</div>,
    BarChart: ({ children }) => <div className="bar-chart">{children}</div>,
    Bar: () => <div className="bar" />,
    XAxis: () => <div className="x-axis" />,
    YAxis: () => <div className="y-axis" />,
    Tooltip: () => <div className="tooltip" />,
    Cell: () => <div className="cell" />,
  };
});

describe('AnalyticsDashboard Component', () => {
  const mockTrackedJobs = [
    {
      id: 'job-1',
      title: 'Senior DevOps Engineer',
      company: 'Atlassian',
      status: 'Applied',
      source: 'seek',
      applied_at: '2026-09-01T10:00:00Z',
    },
    {
      id: 'job-2',
      title: 'Platform Engineer',
      company: 'Canva',
      status: 'Interview Scheduled',
      source: 'linkedin',
      applied_at: '2026-09-02T11:00:00Z',
    },
    {
      id: 'job-3',
      title: 'Site Reliability Engineer',
      company: 'AWS',
      status: 'Offer Received',
      source: 'seek',
      applied_at: '2026-09-03T12:00:00Z',
    },
  ];

  it('renders overall metrics and stage conversions accurately', () => {
    render(<AnalyticsDashboard jobs={mockTrackedJobs} />);

    expect(screen.getByText(/APPLIED POSITIONS INTELLIGENCE/i)).toBeInTheDocument();
    expect(screen.getByText(/3 APPLICATIONS/i)).toBeInTheDocument();
    expect(screen.getByText(/Conversion by Sourcing Channel/i)).toBeInTheDocument();
    expect(screen.getByText(/Seek/i)).toBeInTheDocument();
    expect(screen.getByText(/LinkedIn/i)).toBeInTheDocument();
  });

  it('renders zero-state cleanly when no tracked jobs exist', () => {
    render(<AnalyticsDashboard jobs={[]} />);

    expect(screen.getByText(/0 APPLICATIONS/i)).toBeInTheDocument();
  });
});

