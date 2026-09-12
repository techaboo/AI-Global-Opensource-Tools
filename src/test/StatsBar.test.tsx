import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatsBar } from '@/components/StatsBar';
import { TOOLS } from '@/data/tools';

const emptyLive = {};

describe('StatsBar', () => {
  it('shows a valid zero percentage for an empty result set', () => {
    render(<StatsBar tools={[]} liveMap={emptyLive} syncedCount={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.queryByText('NaN%')).not.toBeInTheDocument();
  });

  it('reports the supplied tool count', () => {
    render(<StatsBar tools={TOOLS.slice(0, 3)} liveMap={emptyLive} syncedCount={0} />);
    const label = screen.getByText('Tools tracked');
    expect(label.previousElementSibling).toHaveTextContent('3');
  });
});
