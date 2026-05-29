import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

// Regression guard for the white-screen bug: JobDetailModal used to call hooks
// (useRunningTimeNow) AFTER an `if (!job) return null` guard. When the modal
// closed, selectedJobId became null, the guard returned early, the hook count
// dropped, and React threw "Rendered fewer hooks than expected" — blanking the
// whole app (no ErrorBoundary at the time). The fix split it into an outer
// guard (stable 2 hooks) + JobDetailModalInner (all job hooks, only mounts when
// a job exists). This test locks that in: it passes with the split, and throws
// on the old single-component shape.

const mocks = vi.hoisted(() => {
  const job = {
    id: 'job-1',
    jobName: 'AC Install',
    client: 'Acme Pty Ltd',
    status: 'scheduled',
    priority: 'medium',
    startDate: '2026-06-01',
    deadline: '2026-06-10',
    estimatedHours: 40,
    assignedStaffIds: [],
    dailyStaffOverrides: {},
    colour: '#f59e0b',
    notes: '',
  };
  return {
    job,
    app: {
      state: { jobs: [job], staff: [], scheduleEntries: [], staffEvents: [] },
      updateJob: vi.fn(),
    },
    jobModal: { selectedJobId: 'job-1' as string | null, closeJob: vi.fn() },
  };
});

vi.mock('../context/AppContext', () => ({ useApp: () => mocks.app }));
vi.mock('../context/JobModalContext', () => ({ useJobModal: () => mocks.jobModal }));
// Strip framer-motion animation wrappers down to plain divs so render/unmount
// is deterministic and free of animation timing.
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children?: unknown }) => children,
  motion: new Proxy(
    {},
    { get: () => ({ children }: { children?: unknown }) => <div>{children}</div> },
  ),
}));

import { JobDetailModal } from './JobDetailModal';

afterEach(() => {
  cleanup();
  mocks.jobModal.selectedJobId = 'job-1';
});

describe('JobDetailModal — hook-order regression (white-screen on close)', () => {
  it('renders when a job is selected, then unmounts cleanly when closed', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container, rerender } = render(<JobDetailModal />);
    // Inner mounted -> the modal rendered real content.
    expect(container.childElementCount).toBeGreaterThan(0);

    // closeJob(): selectedJobId -> null while still mounted. This is the exact
    // transition that crashed the old structure.
    mocks.jobModal.selectedJobId = null;
    expect(() => rerender(<JobDetailModal />)).not.toThrow();

    // Outer guard returns null -> nothing rendered, no hook-order error logged.
    expect(container.childElementCount).toBe(0);
    const hookError = errorSpy.mock.calls.find(
      (c) =>
        String(c[0]).includes('Rendered fewer hooks') ||
        String(c[0]).includes('order of Hooks'),
    );
    expect(hookError).toBeUndefined();

    errorSpy.mockRestore();
  });
});
