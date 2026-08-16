import { describe, expect, it, vi } from 'vitest';
import { allowRoles } from '../middleware/roleMiddleware.js';

describe('role authorization', () => {
  it('prevents students from entering admin routes', () => {
    const next = vi.fn();
    allowRoles('admin')({ user: { role: 'student' } }, {}, next);
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it('allows an administrator through', () => {
    const next = vi.fn();
    allowRoles('admin')({ user: { role: 'admin' } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});
