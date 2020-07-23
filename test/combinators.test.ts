import type { JSONSchema7 } from 'json-schema';
import './common';
import inputSatisfies from '../src/is-json-schema-subset';

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

  it('should reject oneOf: no match', () => {
    const input = {
      title: 'child',
      type: 'object',
      properties: {
        foo: { type: 'number' },
      },
    } as JSONSchema7;
    const target = {
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
    } as JSONSchema7;
    const errors = [];
    // @ts-ignore TS2339
    expect(input).toViolate(target);
    inputSatisfies(input, target, {}, errors);
    expect(errors).toMatchSnapshot();
  });

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
