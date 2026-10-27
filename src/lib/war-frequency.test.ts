import { describe, expect, it } from 'vitest';
import { WAR_FREQUENCY_LABELS, warFrequencyLabel } from './war-frequency';

describe('warFrequencyLabel', () => {
  it('labels every frequency the labels know', () => {
    for (const [value, label] of Object.entries(WAR_FREQUENCY_LABELS)) {
      expect(warFrequencyLabel(value)).toBe(label);
    }
  });

  it('says Unknown when the API omits the field', () => {
    expect(warFrequencyLabel(undefined)).toBe('Unknown');
  });

  it('passes a value the labels do not know through untouched', () => {
    expect(warFrequencyLabel('someNewFrequency')).toBe('someNewFrequency');
  });
});
