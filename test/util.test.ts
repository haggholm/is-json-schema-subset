import type { JSONSchema7 } from 'json-schema';
import { cloneRefs } from '../src/util';

describe('Utility functions', () => {
  it('should not copy objects with no $refs', () => {
    const ob = {
      type: 'object',
      properties: { one: {}, two: {} },
    } as JSONSchema7;
    expect(cloneRefs(ob)).toBe(ob);
  });

  it('should copy objects with $refs', () => {
    const ob = {
      definitions: { one: { type: 'integer', minimum: 1, maximum: 1 } },
      type: 'object',
      properties: { one: { $ref: '#/definitions/one' }, two: {} },
    } as JSONSchema7;
    expect(cloneRefs(ob)).not.toBe(ob);
  });
});
