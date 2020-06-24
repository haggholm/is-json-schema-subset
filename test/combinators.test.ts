import './common';

describe('Schema combinators', () => {
  it('should accept oneOf', () =>
    expect({
      title: 'child',
      type: 'object',
      properties: {
        foo: { type: 'boolean' },
      },
      // @ts-ignore TS2339
    }).toSatisfy({
      title: 'parent',
      type: 'object',
      oneOf: [
        {
          type: 'object',
          properties: {
            foo: { type: 'boolean' },
          },
        },
        {
          type: 'object',
          properties: {
            foo: { type: 'string' },
          },
        },
      ],
    }));

  it('should reject oneOf: no match', () =>
    expect({
      title: 'child',
      type: 'object',
      properties: {
        foo: { type: 'number' },
      },
      // @ts-ignore TS2339
    }).toViolate({
      title: 'parent',
      type: 'object',
      oneOf: [
        {
          type: 'object',
          properties: {
            foo: { type: 'boolean' },
          },
        },
        {
          type: 'object',
          properties: {
            foo: { type: 'string' },
          },
        },
      ],
    }));

  it('should reject oneOf with multiple matches', () =>
    expect({
      title: 'child',
      type: 'object',
      // @ts-ignore TS2339
    }).toViolate({
      title: 'parent',
      type: 'object',
      oneOf: [
        {
          type: 'object',
          properties: {
            foo: { type: 'boolean' },
          },
        },
        {
          type: 'object',
          properties: {
            foo: { type: 'string' },
          },
        },
      ],
    }));

  it('should accept anyOf', () =>
    expect({
      title: 'child',
      type: 'object',
      properties: {
        foo: { type: 'boolean' },
      },
      // @ts-ignore TS2339
    }).toSatisfy({
      title: 'parent',
      type: 'object',
      anyOf: [
        {
          type: 'object',
          properties: {
            foo: { type: 'boolean' },
          },
        },
        {
          type: 'object',
          properties: {
            foo: { type: 'string' },
          },
        },
      ],
    }));

  it('should reject anyOf: no match', () =>
    expect({
      title: 'child',
      type: 'object',
      properties: {
        foo: { type: 'number' },
      },
      // @ts-ignore TS2339
    }).toViolate({
      title: 'parent',
      type: 'object',
      anyOf: [
        {
          type: 'object',
          properties: {
            foo: { type: 'boolean' },
          },
        },
        {
          type: 'object',
          properties: {
            foo: { type: 'string' },
          },
        },
      ],
    }));

  it('should accept anyOf: multiple matches', () =>
    expect({
      title: 'child',
      type: 'object',
      // @ts-ignore TS2339
    }).toSatisfy({
      title: 'parent',
      type: 'object',
      anyOf: [
        {
          type: 'object',
          properties: {
            foo: { type: 'boolean' },
          },
        },
        {
          type: 'object',
          properties: {
            foo: { type: 'string' },
          },
        },
      ],
    }));
});
