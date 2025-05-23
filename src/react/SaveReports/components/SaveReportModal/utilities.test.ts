import { describe, it, expect } from 'vitest';
import { isValidChange, isValidSubmit } from './utilities';

describe('SaveModal > Utilities', () => {
  describe('isValidChange', () => {
    it("returns true for an object with a 'value' property", () => {
      const event = { value: 'test' };
      expect(isValidChange(event)).toBeTruthy();
    });

    it("returns false for an object without a 'value' property", () => {
      const event = { otherKey: 'test' };
      expect(isValidChange(event)).toBeFalsy();
    });

    it('returns false for a non-object input', () => {
      const event = null;
      expect(isValidChange(event)).toBeFalsy();
    });
  });

  describe('isValidSubmit', () => {
    it("returns true for an object with a 'name.value' property", () => {
      const event = { name: { value: 'test' } };
      expect(isValidSubmit(event)).toBeTruthy();
    });

    it("returns false for an object where 'name.value' is missing", () => {
      const event = { name: { otherKey: 'test' } };
      expect(isValidSubmit(event)).toBeFalsy();
    });

    it("returns false for an object without a 'name' property", () => {
      const event = { otherKey: 'test' };
      expect(isValidSubmit(event)).toBeFalsy();
    });

    it('returns false for a non-object input', () => {
      const event = undefined;
      expect(isValidSubmit(event)).toBeFalsy();
    });
  });
});
