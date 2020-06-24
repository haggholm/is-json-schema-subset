import './common';

describe('Basic object properties', () => {
  it('should match simple types', () =>
    expect({
      title: 'child',
      type: 'object',
      properties: {
        boolean: { type: 'boolean' },
        string: { type: 'string' },
        integer: { type: 'integer' },
        number: { type: 'number' },
        array: { type: 'array', items: { type: 'number' } },
        extra: { type: 'integer' },
      },
      // @ts-ignore TS2339
    }).toSatisfy({
      title: 'parent',
      type: 'object',
      properties: {
        boolean: { type: 'boolean' },
        string: { type: 'string' },
        integer: { type: 'integer' },
        number: { type: 'number' },
        array: { type: 'array', items: { type: 'number' } },
      },
    }));

  it('should reject additional properties', () =>
    expect({
      title: 'child',
      type: 'object',
      properties: {
        boolean: { type: 'boolean' },
        string: { type: 'string' },
        integer: { type: 'integer' },
        number: { type: 'number' },
        array: { type: 'array', items: { type: 'number' } },
        extra: { type: 'integer' },
      },
      // @ts-ignore TS2339
    }).toViolate({
      title: 'parent',
      type: 'object',
      additionalProperties: false,
      properties: {
        boolean: { type: 'boolean' },
        string: { type: 'string' },
        integer: { type: 'integer' },
        number: { type: 'number' },
        array: { type: 'array', items: { type: 'number' } },
      },
    }));

  it('should accept arbitrary object schema when unspecified', () =>
    expect({
      title: 'child',
      type: 'object',
      properties: {
        boolean: { type: 'boolean' },
        string: { type: 'string' },
        integer: { type: 'integer' },
        number: { type: 'number' },
        array: { type: 'array', items: { type: 'number' } },
        extra: { type: 'integer' },
      },
      // @ts-ignore TS2339
    }).toSatisfy({
      title: 'parent',
      type: 'object',
    }));

  it('should accept arbitrary schema when unspecified', () =>
    Promise.all(
      [
        {},
        { type: 'boolean' },
        { type: 'string' },
        { type: 'integer' },
        { type: 'number' },
        { type: 'array', items: { type: 'number' } },
        { type: 'integer' },
        // @ts-ignore TS2339
      ].map((child) => expect(child).toSatisfy({}))
    ));
});
