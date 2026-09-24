import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api/client';
import { applyApiError } from './forms';

describe('applyApiError', () => {
  it('maps field errors onto the form', () => {
    const setError = vi.fn();
    const error = new ApiError(400, { detail: 'Some fields need attention.', errors: [{ path: 'email', message: 'Enter a valid e-mail address' }] });
    expect(applyApiError(error, setError, ['email', 'fullName'])).toBe('Please check the highlighted fields.');
    expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'Enter a valid e-mail address' });
  });

  it('keeps the API message when an error has no matching field', () => {
    const setError = vi.fn();
    const error = new ApiError(400, { detail: 'That branch could not be found.', errors: [{ path: 'branch', message: 'Unknown' }] });
    expect(applyApiError(error, setError, ['email'])).toBe('That branch could not be found.');
    expect(setError).not.toHaveBeenCalled();
  });

  it('explains rate limits and network failures', () => {
    expect(applyApiError(new ApiError(429, { detail: 'x' }), vi.fn(), [])).toMatch(/too many times/);
    expect(applyApiError(new TypeError('Failed to fetch'), vi.fn(), [])).toMatch(/connection/);
  });
});
