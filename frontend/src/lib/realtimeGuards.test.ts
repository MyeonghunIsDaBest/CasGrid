import { describe, it, expect } from 'vitest';
import { shouldIgnoreRemoteEntryDelete } from './realtimeGuards';

const TODAY = '2026-06-10';

describe('shouldIgnoreRemoteEntryDelete', () => {
  // Full payloads (RLS off / legacy behaviour) — must match the old inline guard exactly.
  it('ignores a past auto-entry delete (full payload)', () => {
    expect(shouldIgnoreRemoteEntryDelete(
      { id: 'e1', date: '2026-06-09', is_manual_override: false }, undefined, TODAY,
    )).toBe(true);
  });

  it('applies a past MANUAL entry delete (full payload)', () => {
    expect(shouldIgnoreRemoteEntryDelete(
      { id: 'e1', date: '2026-06-09', is_manual_override: true }, undefined, TODAY,
    )).toBe(false);
  });

  it('applies a today/future auto-entry delete (full payload)', () => {
    expect(shouldIgnoreRemoteEntryDelete(
      { id: 'e1', date: '2026-06-10', is_manual_override: false }, undefined, TODAY,
    )).toBe(false);
    expect(shouldIgnoreRemoteEntryDelete(
      { id: 'e1', date: '2026-06-11', is_manual_override: false }, undefined, TODAY,
    )).toBe(false);
  });

  // PK-only payloads (RLS on) — fall back to the local copy of the row.
  it('ignores a past auto-entry delete using the local copy (PK-only payload)', () => {
    expect(shouldIgnoreRemoteEntryDelete(
      { id: 'e1' }, { date: '2026-06-09', isManualOverride: false }, TODAY,
    )).toBe(true);
  });

  it('applies a delete when the local copy is manual or not past (PK-only payload)', () => {
    expect(shouldIgnoreRemoteEntryDelete(
      { id: 'e1' }, { date: '2026-06-09', isManualOverride: true }, TODAY,
    )).toBe(false);
    expect(shouldIgnoreRemoteEntryDelete(
      { id: 'e1' }, { date: '2026-06-12', isManualOverride: false }, TODAY,
    )).toBe(false);
  });

  it('applies a delete when the row is unknown locally (PK-only payload)', () => {
    expect(shouldIgnoreRemoteEntryDelete({ id: 'e1' }, undefined, TODAY)).toBe(false);
  });

  it('prefers payload fields over the local copy when both exist', () => {
    // Payload says manual → apply, even though local copy says auto.
    expect(shouldIgnoreRemoteEntryDelete(
      { id: 'e1', date: '2026-06-09', is_manual_override: true },
      { date: '2026-06-09', isManualOverride: false },
      TODAY,
    )).toBe(false);
  });
});
