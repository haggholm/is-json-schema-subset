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
});
