import './common';

describe('Required properties', () => {
  it('should accept guaranteed required properties', () =>
    expect({
      type: 'object',
      required: ['foo'],
      properties: {
        foo: {},
      },
      // @ts-ignore TS2339
    }).toSatisfy({
      type: 'object',
      required: ['foo'],
      properties: {
        foo: {},
        bar: { type: 'string' },
      },
    }));

  it('should reject non-guaranteed required properties', () =>
    expect({
      type: 'object',
      properties: {
        foo: { type: 'string' },
      },
      // @ts-ignore TS2339
    }).toViolate({
      type: 'object',
      required: ['foo'],
      properties: {
        foo: { type: 'string' },
        bar: { type: 'string' },
      },
    }));

  it('should accept non-guaranteed required properties with defaults', () =>
    expect({
      type: 'object',
      properties: {
        foo: { type: 'string', default: 'bar' },
      },
      // @ts-ignore TS2339
    }).toViolate({
      type: 'object',
      required: ['foo'],
      properties: {
        foo: { type: 'string' },
        bar: { type: 'string' },
      },
    }));
});
