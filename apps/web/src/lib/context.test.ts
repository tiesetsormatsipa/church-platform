import { describe, expect, it } from 'vitest';
import { branchParam, href, withBranch } from './context';

describe('branch context helpers', () => {
  it('accepts only slug-shaped branch parameters', () => {
    expect(branchParam({ branch: 'cape-town' })).toBe('cape-town');
    expect(branchParam({ branch: ['durban', 'x'] })).toBe('durban');
    expect(branchParam({ branch: '../etc' })).toBeUndefined();
    expect(branchParam({})).toBeUndefined();
  });

  it('builds links that keep the context', () => {
    expect(withBranch('/events', 'cape-town')).toBe('/events?branch=cape-town');
    expect(withBranch('/events', null, { when: 'past' })).toBe('/events?when=past');
    expect(href('/feed', { types: 'news', cursor: '' })).toBe('/feed?types=news');
  });
});
