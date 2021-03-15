import './common';

describe('Empirical problem cases', () => {
  it('should resolve emails', async () => {
    await expect({
      properties: {
        emails: {
          items: {
            properties: {
              type: {
                enum: ['other', 'personal', 'work'],
                type: 'string',
              },
              value: {
                format: 'email',
                minLength: 6,
                type: 'string',
              },
            },
            required: ['type', 'value'],
            title: 'Email',
            type: 'object',
          },
          type: 'array',
        },
      },
      required: ['emails'],
      type: 'object',
      // @ts-ignore TS2339
    }).toSatisfy({
      type: 'object',
      required: ['emails'],
      properties: {
        emails: {
          items: {
            properties: {
              type: {
                enum: ['other', 'personal', 'work'],
                type: 'string',
              },
              value: {
                format: 'email',
                minLength: 6,
                type: 'string',
              },
            },
            required: ['type', 'value'],
            title: 'Email',
            type: 'object',
          },
          type: 'array',
        },
      },
    });
  });

  it('should resolve anyOf', async () => {
    await expect({
      type: 'object',
      required: ['foo'],
      properties: { foo: { type: 'string' }, baz: { type: 'boolean' } },
      // @ts-ignore TS2339
    }).toSatisfy({
      type: 'object',
      required: ['foo'],
      properties: {
        foo: { type: 'string' },
      },
    });

    await expect({
      anyOf: [
        {
          type: 'object',
          required: ['foo'],
          properties: { foo: { type: 'string' }, baz: { type: 'boolean' } },
        },
      ],
      // @ts-ignore TS2339
    }).toSatisfy({
      type: 'object',
      required: ['foo'],
      properties: {
        foo: { type: 'string' },
      },
    });

    await expect({
      anyOf: [
        {
          type: 'object',
          required: ['foo'],
          properties: { foo: { type: 'string' }, baz: { type: 'boolean' } },
        },
        {
          type: 'object',
          required: ['foo'],
          properties: { foo: { type: 'string' }, bar: { type: 'number' } },
        },
      ],
      // @ts-ignore TS2339
    }).toSatisfy({
      type: 'object',
      required: ['foo'],
      properties: {
        foo: { type: 'string' },
      },
    });
  });

  it('should resolve an anyOf with arrays', async () => {
    await expect(
      {
        type: 'object',
        required: ['additions'],
        properties: {
          additions: {
            type: 'array',
            items: {
              additionalProperties: false,
              required: ['op', 'path', 'value'],
              type: 'object',
              properties: {
                op: { enum: ['add'], type: 'string' },
                path: { format: 'json-pointer', type: 'string' },
                value: {
                  type: 'object',
                  properties: {
                    addresses: {
                      items: {},
                      type: 'array',
                    },
                    faceIds: { items: { type: 'string' }, type: 'array' },
                    urls: {
                      properties: {
                        fb: {
                          items: { format: 'uri', type: 'string' },
                          type: 'array',
                        },
                        li: {
                          items: { format: 'uri', type: 'string' },
                          type: 'array',
                        },
                      },
                      required: ['fb', 'li'],
                      type: 'object',
                    },
                  },
                  required: ['urls', 'faceIds', 'addresses'],
                },
              },
            },
          },
        },
      }
      // @ts-ignore TS2339
    ).toSatisfy({
      type: 'object',
      required: ['additions'],
      properties: {
        additions: {
          anyOf: [
            {
              type: 'array',
              items: {
                type: 'object',
                required: ['path', 'value'],
                properties: {
                  op: { enum: ['add'], type: 'string' },
                  path: { format: 'json-pointer', type: 'string' },
                  value: {},
                },
              },
            },
            {
              type: 'object',
              required: ['path', 'value'],
              properties: {
                op: { enum: ['add'], type: 'string' },
                path: { format: 'json-pointer', type: 'string' },
                value: {},
              },
            },
          ],
        },
      },
    });
  });

  it('should resolve SSN', () =>
    expect({
      maximum: 899999999,
      minimum: 1010001,
      type: 'integer',
      title: 'SSN',
      // @ts-ignore TS2339
    }).toSatisfy({
      maximum: 899999999,
      minimum: 1010001,
      type: 'number',
    }));

  it('should manage zero-length arrays', () =>
    expect({
      $schema: 'http://json-schema.org/draft-07/schema#',
      allOf: [
        {
          type: 'object',
          required: ['searchString'],
          properties: { searchString: { type: 'string' } },
        },
        {
          type: 'object',
          required: ['resultCategory', 'searchKeywords'],
          properties: {
            resultCategory: { type: 'string', enum: ['ggg'] },
            searchKeywords: {
              type: 'array',
              minItems: 0,
              maxItems: 0,
              items: [],
            },
          },
          additionalProperties: false,
        },
      ],
      // @ts-ignore
    }).toSatisfy({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      required: ['searchString'],
      properties: {
        passthrough: {},
        resultCategory: { type: 'string' },
        searchKeywords: { items: { type: 'string' }, type: 'array' },
        searchSites: { items: { type: 'string' }, type: 'array' },
        searchString: { type: 'string' },
      },
    }));

  it('should handle partial allOf/anyOf combinations', async () => {
    const input = {
      allOf: [
        {
          properties: {
            array: { type: 'array' },
            filter: {
              anyOf: [
                {
                  properties: { searchString: { type: 'string' } },
                  required: ['searchString'],
                  type: 'object',
                },
                {
                  properties: {
                    searchStrings: { items: { type: 'string' }, type: 'array' },
                  },
                  required: ['searchStrings'],
                  type: 'object',
                },
              ],
            },
          },
          required: ['array', 'filter'],
          type: 'object',
        },
        {
          type: 'object',
          required: ['filter'],
          properties: {
            filter: {
              type: 'object',
              required: ['searchStrings'],
              properties: {
                searchStrings: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 1,
                  items: { type: 'string', enum: ['test'] },
                },
              },
            },
          },
        },
      ],
    };
    const target = {
      properties: {
        array: { type: 'array' },
        filter: {
          anyOf: [
            {
              properties: { searchString: { type: 'string' } },
              required: ['searchString'],
              type: 'object',
            },
            {
              properties: {
                searchStrings: { items: { type: 'string' }, type: 'array' },
              },
              required: ['searchStrings'],
              type: 'object',
            },
          ],
        },
      },
      required: ['array', 'filter'],
      type: 'object',
    };
    // @ts-ignore TS2339
    await expect(input.allOf[0]).toSatisfy(target);
    // @ts-ignore TS2339
    await expect(input.allOf[1]).toSatisfy(target, {
      allowPartial: true,
      allowAdditionalProps: true,
    });
    // @ts-ignore TS2339
    await expect(input).toSatisfy(target);
  });

  it('should merge enums if at least one matches', async () => {
    // Tests for a problem with the way merge-allof merges some values
    await expect({
      anyOf: [
        {
          enum: ['1', '2', '3'],
          type: 'string',
        },
        {
          enum: ['one', 'two', 'three'],
          type: 'string',
        },
      ],
      enum: ['one'],
      type: 'string',
      // @ts-ignore TS2339
    }).toSatisfy({
      anyOf: [
        {
          enum: ['1', '2', '3'],
          type: 'string',
        },
        {
          enum: ['one', 'two', 'three'],
          type: 'string',
        },
      ],
    });
  });
});
