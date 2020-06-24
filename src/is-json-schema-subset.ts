import isEqual = require('fast-deep-equal');
import mergeAllOf = require('json-schema-merge-allof');
import RefParser = require('@apidevtools/json-schema-ref-parser');
import type { JSONSchema as RefParserSchemaType } from '@apidevtools/json-schema-ref-parser';
import type { JSONSchema7 } from 'json-schema';
import mkDebug = require('debug');
import AJV = require('ajv');
import type { Ajv } from 'ajv';

const debug = mkDebug('is-json-schema-subset');

const defaultSchema = 'http://json-schema.org/draft-07/schema#';

interface Paths {
  input: Readonly<(string | number)[]>;
  target: Readonly<(string | number)[]>;
}

const hasProperty: (ob: any, prop: PropertyKey) => ErrorArray | undefined = (
  ob,
  prop
) => Object.prototype.hasOwnProperty.call(ob, prop);

function formatPathCallback(v: string | number) {
  return typeof v === 'string' && /^[A-Za-z0-9_$]+$/.test(v)
    ? `.${v}`
    : `[${JSON.stringify(v)}]`;
}
function formatPath(path: Readonly<(string | number)[]>): string {
  return [path[0], ...path.slice(1).map(formatPathCallback)].join('');
}

function formatPaths(paths: Paths): string[] {
  return [formatPath(paths.input), '/', formatPath(paths.target)];
}

export interface SchemaCompatError {
  paths: Paths;
  args: any[];
}

type ErrorArray = [SchemaCompatError, ...SchemaCompatError[]];

function log(paths, ...args: any[]): void {
  const indent = Math.max(paths.input.length, paths.target.length);
  debug(''.padStart(indent, ' '), ...args, 'at', ...formatPaths(paths));
}

function all<T>(
  elements: T[],
  condition: (val: T, idx: number) => ErrorArray | undefined
): ErrorArray | undefined {
  // Reverse for legible error message ordering
  for (let i = elements.length - 1; i >= 0; i--) {
    const errors = condition(elements[i], i);
    if (errors?.length) {
      return errors as ErrorArray;
    }
  }
  return undefined;
}

function allBool<T>(
  elements: T[],
  condition: (val: T, idx: number) => boolean
): boolean {
  for (let i = 0, len = elements.length; i < len; i++) {
    if (!condition(elements[i], i)) {
      return false;
    }
  }
  return true;
}

function some<T>(
  elements: T[],
  condition: (val: T, idx: number) => ErrorArray | undefined
): ErrorArray | undefined {
  const allErrors = [];
  // Reverse for legible error message ordering
  for (let i = elements.length - 1; i >= 0; i--) {
    const errors = condition(elements[i], i);
    if (errors?.length) {
      allErrors.push(...errors);
    } else {
      return;
    }
  }
  return allErrors.length ? (allErrors as ErrorArray) : undefined;
}

function one<T>(
  paths,
  elements: T[],
  condition: (val: T, idx: number) => ErrorArray | undefined
): ErrorArray | undefined {
  const allErrors = [];
  let matches = 0;
  // Reverse for legible error message ordering
  for (let i = elements.length - 1; i >= 0; i--) {
    const errors = condition(elements[i], i);
    if (errors?.length) {
      matches++;
      allErrors.push(...errors);
    }
  }

  if (matches === 1) {
    return;
  } else if (matches > 1) {
    return [{ paths, args: ['oneOf matches more than one branch'] }];
  } else {
    return [
      ...allErrors,
      { paths, args: ['oneOf does not match any branches'] },
    ] as ErrorArray;
  }
}

function getTypeMatchErrors(
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
): ErrorArray | undefined {
  if (isEqual(target, {})) {
    return;
  }

  const match =
    input.type === target.type ||
    (target.type === 'number' && input.type === 'integer');

  if (!match) {
    return [
      {
        paths,
        args: [`Type mismatch: ${input.type} does not satisfy ${target.type}`],
      },
    ];
  }
}

function getRequiredInputErrors(
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
): ErrorArray | undefined {
  // Verify that the target doesn't require anything missing from the input
  const inputRequires = new Set((input.required ?? []) as string[]);
  for (const prop of (target.required ?? []) as string[]) {
    if (!inputRequires.has(prop)) {
      const hasDefault = Object.prototype.hasOwnProperty.call(
        target.properties![prop],
        'default'
      );
      if (!hasDefault) {
        return [
          {
            paths,
            args: ['input does not guarantee required property', prop],
          },
        ];
      }
    }
  }
}

function getExtraneousInputErrors(
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
): ErrorArray | undefined {
  // Verify that the input doesn't have extra properties violating the target
  if (target.additionalProperties === false) {
    const superProps = new Set(Object.keys(target.properties));
    for (const prop of Object.keys(input.properties ?? {})) {
      if (!superProps.has(prop)) {
        return [
          {
            paths,
            args: ['input has extraneous property', prop],
          },
        ];
      }
    }
  }
}

function getInputPropertyErrors(
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
): ErrorArray | undefined {
  const subProps = (input.properties ?? {}) as {
    [k: string]: JSONSchema7;
  };
  const superProps = (target.properties ?? {}) as {
    [k: string]: JSONSchema7;
  };

  for (const prop of Object.keys(superProps)) {
    if (!subProps || !hasProperty(subProps, prop)) {
      continue;
    }

    const errors = getErrors(subProps[prop], superProps[prop], options, {
      input: paths.input.concat([prop]),
      target: paths.target.concat([prop]),
    });
    if (errors?.length) {
      return [
        ...errors,
        { paths, args: ['Property', prop, 'does not match'] },
      ] as ErrorArray;
    }
  }
}

function calculateEffectiveMinLength(schema: JSONSchema7): number {
  if (schema.type === 'string') {
    if (schema.minLength !== undefined) {
      return schema.minLength;
    } else if (schema.enum) {
      return Math.min(...schema.enum.map((s) => (s as JSONSchema7[]).length));
    }
  } else if (schema.allOf ?? schema.anyOf ?? schema.oneOf) {
    return Math.min(
      ...((schema.allOf ??
        schema.anyOf ??
        schema.oneOf) as JSONSchema7[]).map((s) =>
        calculateEffectiveMinLength(s)
      )
    );
  } else {
    return -1;
  }
}

function calculateEffectiveMaxLength(schema: JSONSchema7) {
  if (schema.type === 'string') {
    if (schema.minLength !== undefined) {
      return schema.minLength;
    } else if (schema.enum) {
      return Math.max(...schema.enum.map((s) => (s as JSONSchema7[]).length));
    }
  } else if (schema.allOf ?? schema.anyOf ?? schema.oneOf) {
    return Math.max(
      ...((schema.allOf ??
        schema.anyOf ??
        schema.oneOf) as JSONSchema7[]).map((s) =>
        calculateEffectiveMaxLength(s)
      )
    );
  } else {
    return -1;
  }
}

function gatherEnumValues(schema: JSONSchema7): any[] | undefined {
  if (schema.allOf ?? schema.anyOf ?? schema.oneOf) {
    let enums;
    for (const e of (schema.allOf ??
      schema.anyOf ??
      schema.oneOf) as JSONSchema7[]) {
      const subEnums = gatherEnumValues(e);
      if (subEnums) {
        enums = (enums ?? []).concat(subEnums);
      }
    }
    return enums;
  } else {
    return schema.enum ?? undefined;
  }
}

function getStringErrors(
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
): ErrorArray | undefined {
  if (target.type !== 'string') {
    return;
  }

  if (target.format && target.format !== input.format) {
    let compatible: boolean;
    if (input.enum) {
      compatible = allBool(
        input.enum,
        (s: string) => options.ajv.validate(target, s) as boolean
      );
    } else {
      switch (target.format) {
        case 'idn-email':
          compatible = input.format === 'email';
          break;
        case 'idn-hostname':
          compatible = input.format === 'hostname';
          break;
        case 'iri':
          compatible = input.format === 'uri' || input.format === 'iri';
          break;
        case 'iri-reference':
          compatible =
            input.format === 'uri' ||
            input.format === 'uri-reference' ||
            input.format === 'iri';
          break;
        case 'uri-reference':
          compatible = input.format === 'uri';
          break;
        default:
          compatible = false;
          break;
      }
    }
    if (!compatible) {
      return [{ paths, args: ['String format mismatch'] }];
    }
  }

  if (target.pattern && target.pattern !== input.pattern) {
    return [{ paths, args: ['String pattern mismatch'] }];
  }

  if (
    hasProperty(target, 'minLength') &&
    calculateEffectiveMinLength(input) < target.minLength
  ) {
    return [
      {
        paths,
        args: ['input minLength is less than target'],
      },
    ];
  }
  if (
    hasProperty(target, 'maxLength') &&
    calculateEffectiveMaxLength(input) > target.maxLength
  ) {
    return [
      {
        paths,
        args: ['input maxLength is less than target'],
      },
    ];
  }

  const maybeTargetEnums = new Set(gatherEnumValues(target));
  if (maybeTargetEnums.size) {
    const inputEnums = gatherEnumValues(input);
    if (inputEnums === undefined) {
      return [
        {
          paths,
          args: ['input is missing enum restrictions'],
        },
      ];
    }
    for (const e of inputEnums) {
      if (!maybeTargetEnums.has(e)) {
        return [
          {
            paths,
            args: [
              'target',
              Array.from(maybeTargetEnums),
              'is missing possible input enum:',
              e,
            ],
          },
        ];
      }
    }
  }
}

function getArrayErrors(
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
): ErrorArray | undefined {
  if (target.type !== 'array') {
    return; // nop
  }

  if (
    hasProperty(target, 'minItems') &&
    (!hasProperty(input, 'minItems') || input.minItems < target.minItems)
  ) {
    return [{ paths, args: ['input minItems is less than target'] }];
  }
  if (
    hasProperty(target, 'maxItems') &&
    (!hasProperty(input, 'maxItems') || input.maxItems > target.maxItems)
  ) {
    return [{ paths, args: ['input maxItems is more than target'] }];
  }

  if (Array.isArray(target.items)) {
    if (!hasProperty(input, 'items')) {
      return [{ paths, args: ['input is missing items'] }];
    }

    if (
      !Array.isArray(input.items) ||
      target.items.length !== input.items.length
    ) {
      return [{ paths, args: ['Tuple item count mismatch'] }];
    }
    for (let i = 0, len = target.items.length; i < len; i++) {
      const errors = getErrors(
        input.items[i] as JSONSchema7,
        target.items[i] as JSONSchema7,
        options,
        {
          input: paths.input.concat([i]),
          target: paths.target.concat([i]),
        }
      );
      if (errors?.length) {
        return [
          ...errors,
          {
            paths,
            args: ['Tuple items mismatch:'],
          },
        ] as ErrorArray;
      }
    }
  } else {
    const errors = getErrors(
      input.items as JSONSchema7,
      target.items as JSONSchema7,
      options,
      {
        input: paths.input.concat(['items']),
        target: paths.target.concat(['items']),
      }
    );
    if (errors?.length) {
      return [
        ...errors,
        {
          paths,
          args: ['Array items mismatch:'],
        },
      ] as ErrorArray;
    }
  }

  if (target.uniqueItems && !input.uniqueItems) {
    return [{ paths, args: ['input does not require uniqueItems'] }];
  }
}

function getNumericErrors(
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
): ErrorArray | undefined {
  if (target.type !== 'integer' && target.type !== 'number') {
    return;
  }

  if (hasProperty(target, 'maximum')) {
    if (
      !hasProperty(input, 'maximum') &&
      !hasProperty(input, 'exclusiveMaximum')
    ) {
      return [{ paths, args: ['input has no maximum property'] }];
    }

    if (
      hasProperty(input, 'maximum') &&
      (input.maximum as number) > (target.maximum as number)
    ) {
      return [{ paths, args: ['input permits greater maximum'] }];
    }
    if (
      hasProperty(input, 'exclusiveMaximum') &&
      (input.exclusiveMaximum as number) > (target.maximum as number)
    ) {
      return [
        {
          paths,
          args: ['input permits greater maximum (exclusive)'],
        },
      ];
    }
  }

  if (hasProperty(target, 'exclusiveMaximum')) {
    if (
      !hasProperty(input, 'maximum') &&
      !hasProperty(input, 'exclusiveMaximum')
    ) {
      return [{ paths, args: ['input has no maximum property'] }];
    }

    if (
      hasProperty(input, 'maximum') &&
      input.maximum >= target.exclusiveMaximum
    ) {
      return [{ paths, args: ['input permits greater maximum'] }];
    }
    if (
      hasProperty(input, 'exclusiveMaximum') &&
      (input.exclusiveMaximum as number) > (target.exclusiveMaximum as number)
    ) {
      return [
        {
          paths,
          args: ['input permits greater exclusiveMaximum'],
        },
      ];
    }
  }

  if (hasProperty(target, 'minimum')) {
    if (
      !hasProperty(input, 'minimum') &&
      !hasProperty(input, 'exclusiveMinimum')
    ) {
      return [{ paths, args: ['input has no minimum property'] }];
    }

    if (hasProperty(input, 'minimum') && input.minimum < target.minimum) {
      return [{ paths, args: ['input permits greater minimum'] }];
    }
    if (
      hasProperty(input, 'exclusiveMinimum') &&
      input.exclusiveMinimum < target.minimum
    ) {
      return [{ paths, args: ['input permits greater minimum'] }];
    }
  }

  if (hasProperty(target, 'exclusiveMinimum')) {
    if (
      !hasProperty(input, 'minimum') &&
      !hasProperty(input, 'exclusiveMinimum')
    ) {
      return [{ paths, args: ['input has no minimum property'] }];
    }

    if (
      hasProperty(input, 'minimum') &&
      (input.minimum as number) <= (target.exclusiveMinimum as number)
    ) {
      return [{ paths, args: ['input permits smaller minimum'] }];
    }
    if (
      hasProperty(input, 'exclusiveMinimum') &&
      (input.exclusiveMinimum as number) < (target.exclusiveMinimum as number)
    ) {
      return [
        {
          paths,
          args: ['input permits greater exclusiveMinimum'],
        },
      ];
    }
  }

  if (target.multipleOf) {
    if (!input.multipleOf) {
      return [{ paths, args: ['input lacks multipleOf'] }];
    }
    if (input.multipleOf % target.multipleOf !== 0) {
      return [
        {
          paths,
          args: [
            'input multipleOf is not an integer multiple of target multipleOf',
          ],
        },
      ];
    }
  }
}

function getConstErrors(
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
): ErrorArray | undefined {
  if (target.const && target.const !== input.const) {
    return [
      {
        paths,
        args: [`input const mismatch (${target.const} !== ${input.const})`],
      },
    ];
  }
}

function getAllOfErrors(
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,

  paths: Paths
): ErrorArray | undefined {
  if (input.allOf) {
    const errors = all(input.allOf as JSONSchema7[], (e, idx) =>
      getErrors(e, target, options, {
        input: paths.input.concat(['allOf', idx]),
        target: paths.target,
      })
    );
    if (errors?.length) {
      return [
        ...errors,
        {
          paths,
          args: ['Some input.allOf elements do not satisfy target'],
        },
      ] as ErrorArray;
    }
  }

  if (target.allOf) {
    const errors = all(target.allOf as JSONSchema7[], (e, idx) =>
      getErrors(input, e, options, {
        input: paths.input,
        target: paths.target.concat(['allOf', idx]),
      })
    );
    if (errors?.length) {
      return [
        ...errors,
        {
          paths,
          args: ['Some target.allOf elements cannot be satisfied'],
        },
      ] as ErrorArray;
    }
  }
}

function getAnyOfErrors(
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
): ErrorArray | undefined {
  // If input can be anyOf [a,b,...], then each of them must be accepted
  // by the target.
  if (input.anyOf) {
    const errors = all(input.anyOf as JSONSchema7[], (branch, idx) =>
      getErrors(branch, target, options, {
        input: paths.input.concat(['anyOf', idx]),
        target: paths.target,
      })
    );
    if (errors?.length) {
      return [
        ...errors,
        {
          paths,
          args: ['Some input.anyOf elements do not satisfy target'],
        },
      ] as ErrorArray;
    }
  }

  // If the target can accept anyOf [a,b,...], then it's enough
  // that at least one is satisfied by the input
  if (target.anyOf) {
    const errors = some(target.anyOf as JSONSchema7[], (branch, idx) =>
      getErrors(input, branch, options, {
        input: paths.input,
        target: paths.target.concat(['anyOf', idx]),
      })
    );
    if (errors?.length) {
      return [
        ...errors,
        {
          paths,
          args: ['input does not satisfy any of target.anyOf'],
        },
      ] as ErrorArray;
    }
  }
}

function getOneOfErrors(
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
): ErrorArray | undefined {
  if (input.oneOf) {
    const cond = (e, idx) =>
      getErrors(e, target, options, {
        input: paths.input.concat(['oneOf', idx]),
        target: paths.target,
      });
    const errors = all(input.oneOf as JSONSchema7[], cond);
    if (errors?.length) {
      return [
        ...errors,
        {
          paths,
          args: ['Some input.oneOf elements do not satisfy target'],
        },
      ] as ErrorArray;
    }
  }

  if (target.oneOf) {
    const errors = one(
      {
        input: paths.input,
        target: [...paths.target, 'oneOf'],
      },
      target.oneOf as JSONSchema7[],
      (e, idx) =>
        getErrors(input, e, options, {
          input: paths.input,
          target: paths.target.concat(['oneOf', idx]),
        })
    );
    if (errors?.length) {
      return errors as ErrorArray;
    }
  }
}

function getNotErrors(
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
): ErrorArray | undefined {
  const allErrors = [];

  if (input.not) {
    const errors = getErrors(input.not as JSONSchema7, target, options, {
      input: paths.input.concat(['not']),
      target: paths.target,
    });
    if (!errors?.length) {
      return [
        {
          paths,
          args: ['input.not should not satisfy target'],
        },
      ] as ErrorArray;
    }
  }

  if (target.not) {
    const errors = getErrors(input, target.not as JSONSchema7, options, {
      input: paths.input,
      target: paths.target.concat(['not']),
    });
    if (!errors?.length) {
      return [
        {
          paths,
          args: ['input should not satisfy target.not'],
        },
      ] as ErrorArray;
    }
  }
}

type Validator = (
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
) => ErrorArray | undefined;

function getErrors(
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
): ErrorArray | undefined {
  if (isEqual(target, {}) || isEqual(input, target)) {
    return;
  }

  if (target.anyOf || input.anyOf) {
    return getAnyOfErrors(input, target, options, paths);
  } else if (target.allOf || input.allOf) {
    return getAllOfErrors(input, target, options, paths);
  } else if (target.oneOf || input.oneOf) {
    return getOneOfErrors(input, target, options, paths);
  }

  const validators: Validator[] = [
    getArrayErrors,
    getConstErrors,
    getNumericErrors,
    getStringErrors,
    getExtraneousInputErrors,
    getRequiredInputErrors,
    getInputPropertyErrors,
    getTypeMatchErrors,
    getAnyOfErrors,
    getOneOfErrors,
    getNotErrors,
  ];
  if (!options.allowAdditionalProps) {
    validators.push(getExtraneousInputErrors);
  }

  for (const validator of validators) {
    const errors = validator(input, target, options, paths);
    if (errors?.length) {
      return errors as ErrorArray;
    }
  }
}

interface Options {
  allowPartial: boolean;
  allowAdditionalProps: boolean;
  ajv: Ajv;
}

export type { JSONSchema7 };

export default async function inputSatisfies(
  input: JSONSchema7,
  target: JSONSchema7,
  options: boolean | Partial<Options> = false,
  errorsOut?: SchemaCompatError[]
): Promise<boolean> {
  const processedOpts: Options =
    typeof options === 'boolean'
      ? {
          allowPartial: options,
          allowAdditionalProps: false,
          ajv: new AJV(),
        }
      : {
          allowPartial: options.allowPartial || false,
          allowAdditionalProps: options.allowAdditionalProps || false,
          ajv: options.ajv ?? new AJV(),
        };

  const draftRegex = /draft-0[1234]\/schema/;
  if (
    draftRegex.test(input.$schema ?? defaultSchema) ||
    draftRegex.test(target.$schema ?? defaultSchema)
  ) {
    throw new Error('Requires JSON schema draft version 5+');
  }

  const [sub, sup] = (await Promise.all([
    RefParser.dereference(
      (input.$schema
        ? input
        : { ...input, $schema: defaultSchema }) as RefParserSchemaType
    ),
    RefParser.dereference(
      (target.$schema
        ? target
        : { ...target, $schema: defaultSchema }) as RefParserSchemaType
    ),
  ])) as [JSONSchema7, JSONSchema7];

  const errors = getErrors(
    clean(mergeAllOf(sub)),
    clean(mergeAllOf(sup)),
    processedOpts,
    { input: ['<input>'], target: ['<target>'] }
  );

  if (errors?.length) {
    for (const { paths, args } of errors.reverse()) {
      log(paths, ...args);
    }
    if (errorsOut) {
      errorsOut.push(...errors);
    }
    return false;
  } else {
    return true;
  }
}

function clean(schema: JSONSchema7) {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  const res = {};
  let changed = false;
  for (const key of Object.keys(schema)) {
    if (key.startsWith('$')) {
      changed = true;
    } else {
      res[key] = schema[key];
    }
  }

  return changed ? res : schema;
}
