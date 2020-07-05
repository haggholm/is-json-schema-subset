import './common';

describe('Arrays', () => {
  it('should accept a compatible array', () =>
    expect({
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: { type: 'string' },
      // @ts-ignore TS2339
    }).toSatisfy({
      type: 'array',
      minItems: 0,
      maxItems: 11,
      items: { type: 'string' },
    }));

  it('should reject incompatible items', () =>
    expect({
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: { type: 'string' },
      // @ts-ignore TS2339
    }).toViolate({
      type: 'array',
      minItems: 0,
      maxItems: 11,
      items: { type: 'number' },
    }));

  it('should reject minItems conflict', () =>
    expect({
      type: 'array',
      minItems: 1,
      maxItems: 10,
      // @ts-ignore TS2339
    }).toViolate({
      type: 'array',
      minItems: 2,
      maxItems: 11,
    }));

  it('should reject maxItems conflict', () =>
    expect({
      type: 'array',
      minItems: 1,
      maxItems: 12,
      // @ts-ignore TS2339
    }).toViolate({
      type: 'array',
      minItems: 0,
      maxItems: 11,
    }));

  it('should reject minItems exceeding maxItems', () =>
    expect({
      type: 'array',
      minItems: 12,
      // @ts-ignore TS2339
    }).toViolate({
      type: 'array',
      minItems: 0,
      maxItems: 11,
    }));

  it('should reject maxItems being below minItems', () =>
    expect({
      type: 'array',
      maxItems: 1,
      // @ts-ignore TS2339
    }).toViolate({
      type: 'array',
      minItems: 2,
      maxItems: 11,
    }));

  it('should reject missing maxItems', () =>
    expect({
      type: 'array',
      // @ts-ignore TS2339
    }).toViolate({
      type: 'array',
      maxItems: 11,
    }));

  it('should reject missing minItems', () =>
    expect({
      type: 'array',
      // @ts-ignore TS2339
    }).toViolate({
      type: 'array',
      minItems: 11,
    }));
});
