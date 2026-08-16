import { describe, expect, it } from 'vitest';
import { calculateMatchScore } from '../services/matchingService.js';

describe('smart matching algorithm', () => {
  it('awards all configured points to a strong match', () => {
    const lost = { category: 'Wallet', colour: 'Black', brand: 'Fossil', location: 'Library', building: 'Block A', date: '2026-07-20', title: 'Black Fossil wallet', description: 'Leather wallet with a small coin pocket' };
    const found = { ...lost, date: '2026-07-22', title: 'Fossil leather wallet found' };
    const result = calculateMatchScore(lost, found);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.matchedFields).toEqual(expect.arrayContaining(['category', 'colour', 'brand', 'location', 'date', 'description']));
  });

  it('does not award identity points to unrelated items', () => {
    const result = calculateMatchScore(
      { category: 'Keys', colour: 'Silver', brand: '', location: 'Hostel', date: '2026-06-01', title: 'Room keys', description: 'two keys with a blue ring' },
      { category: 'Laptop', colour: 'Black', brand: 'Dell', location: 'Library', date: '2026-07-20', title: 'Dell laptop', description: 'computer in a padded sleeve' },
    );
    expect(result.score).toBeLessThan(30);
  });
});
