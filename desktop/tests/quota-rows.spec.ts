import { describe, expect, it } from 'vitest';
import { showSessionRow, showWeeklyRow } from '../src/renderer/format';

const reading = (utilization: number | null) => ({ utilization, resetAt: null, seenAt: null });

describe('quota rows, by the server rules', () => {
  it('hides the weekly row only for a plan that meters no shared weekly window and has no reading', () => {
    expect(showWeeklyRow({ weekly: reading(null), weeklyWindowStated: false })).toBe(false);
    expect(showWeeklyRow({ weekly: reading(0.2), weeklyWindowStated: false })).toBe(true);
    expect(showWeeklyRow({ weekly: reading(null), weeklyWindowStated: true })).toBe(true);
    // An older backend says nothing either way: the row stays.
    expect(showWeeklyRow({ weekly: reading(null), weeklyWindowStated: null })).toBe(true);
  });

  it('applies the same rule to the 5-hour row', () => {
    expect(showSessionRow({ fiveHour: reading(null), sessionWindowStated: false })).toBe(false);
    expect(showSessionRow({ fiveHour: reading(0.5), sessionWindowStated: false })).toBe(true);
    expect(showSessionRow({ fiveHour: reading(null), sessionWindowStated: null })).toBe(true);
  });
});
