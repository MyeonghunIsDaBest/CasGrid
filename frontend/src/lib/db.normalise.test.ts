import { describe, it, expect, vi } from 'vitest';

// db.ts imports ./supabase, whose module throws if the env vars are unset.
// We only want the pure normaliser functions, so stub the client out.
vi.mock('./supabase', () => ({ supabase: {} }));

import { normaliseStatus, normalisePriority } from './db';

describe('normaliseStatus', () => {
  it('passes through the five allowed values unchanged', () => {
    for (const s of ['unscheduled', 'scheduled', 'inProgress', 'completed', 'onHold'] as const) {
      expect(normaliseStatus(s)).toBe(s);
    }
  });

  it("maps the Simpro 'Programmed' status (the bug) to 'scheduled'", () => {
    expect(normaliseStatus('Programmed')).toBe('scheduled');
    expect(normaliseStatus('programmed')).toBe('scheduled'); // case-insensitive
  });

  it('maps other known external statuses to the nearest allowed value', () => {
    expect(normaliseStatus('Pending')).toBe('unscheduled');
    expect(normaliseStatus('In Progress')).toBe('inProgress');
    expect(normaliseStatus('Completed')).toBe('completed');
    expect(normaliseStatus('Archived')).toBe('completed');
    expect(normaliseStatus('On Hold')).toBe('onHold');
  });

  it('falls back to scheduled for unknown / empty / null values', () => {
    expect(normaliseStatus('Whatever')).toBe('scheduled');
    expect(normaliseStatus('')).toBe('unscheduled');
    expect(normaliseStatus(null)).toBe('unscheduled');
    expect(normaliseStatus(undefined)).toBe('unscheduled');
  });
});

describe('normalisePriority', () => {
  it('passes through the four allowed values unchanged', () => {
    for (const p of ['low', 'medium', 'high', 'urgent'] as const) {
      expect(normalisePriority(p)).toBe(p);
    }
  });

  it('maps known synonyms and falls back to medium', () => {
    expect(normalisePriority('critical')).toBe('urgent');
    expect(normalisePriority('Normal')).toBe('medium');
    expect(normalisePriority('standard')).toBe('medium');
    expect(normalisePriority('Whatever')).toBe('medium');
    expect(normalisePriority(null)).toBe('medium');
  });
});
