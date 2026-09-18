import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatsBar } from '@/components/StatsBar';
import { TOOLS } from '@/data/tools';

const emptyLive = {};

describe('StatsBar', () => {
  it('shows a valid zero percentage for an empty result set', () => {
    render(<StatsBar tools={[]} liveMap={emptyLive} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.queryByText('NaN%')).not.toBeInTheDocument();
  });

  it('reports the supplied tool count', () => {
    render(<StatsBar tools={TOOLS.slice(0, 3)} liveMap={emptyLive} />);
    const label = screen.getByText('Tools tracked');
    expect(label.previousElementSibling).toHaveTextContent('3');
  });

  it('counts live records only for the visible catalog tools', () => {
    const liveMap = {
      [TOOLS[0].id]: { stars: 1, forks: 0, openIssues: 0, pushedAt: '', fetchedAt: 1 },
      'removed-tool': { stars: 1, forks: 0, openIssues: 0, pushedAt: '', fetchedAt: 1 },
    };
    render(<StatsBar tools={TOOLS.slice(0, 3)} liveMap={liveMap} />);
    const label = screen.getByText('Live-synced');
    expect(label.previousElementSibling).toHaveTextContent('1');
  });
});
