import type { JSONSchema7 } from 'json-schema';
import './common';

for (const type of [
  'boolean',
  'integer',
  'number',
  'string',
  'array',
  'object',
]) {
  test(`identity test for ${type}`, () =>
    expect({
      title: 'child',
      type,
      // @ts-ignore TS2339
    }).toSatisfy({
      title: 'parent',
      type,
    }));
  test(`array identity test for ${type}`, () =>
    expect({
      title: 'child',
      type: 'array',
      items: { type },
      // @ts-ignore TS2339
    }).toSatisfy({
      title: 'parent',
      type: 'array',
      items: { type },
    }));

  for (const type2 of [
    'boolean',
    'integer',
    'number',
    'string',
    'array',
    'object',
  ]) {
    if (type !== type2 && !(type === 'number' && type2 === 'integer')) {
      test(`type mismatch test for ${type2} satisfying ${type}`, () =>
        expect({
          title: 'child',
          type: type2,
          // @ts-ignore TS2339
        }).toViolate({
          title: 'parent',
          type,
        }));
      test(`array type mismatch test for ${type2} satisfying ${type}`, () =>
        expect({
          title: 'child',
          type: 'array',
          items: { type: type2 },
          // @ts-ignore TS2339
        }).toViolate({
          title: 'parent',
          type: 'array',
          items: { type },
        }));
    }
  }
}
