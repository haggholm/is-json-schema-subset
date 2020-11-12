import AJV = require('ajv');
import isEqual = require('fast-deep-equal');
import mergeAllOf = require('json-schema-merge-allof');
import $RefParser = require('@apidevtools/json-schema-ref-parser');
import type { JSONSchema as RefParserSchemaType } from '@apidevtools/json-schema-ref-parser';
import type { JSONSchema7 } from 'json-schema';

import {
  all,
  allBool,
  cloneRefs,
  isEmptyObject,
  one,
  some,
  someBool,
  subFormats,
} from './util';
import { isLogEnabled, log } from './log-util';
import type { ErrorArray, Options, Paths, SchemaCompatError } from './types';

export type { JSONSchema7 };
export type { SchemaCompatError } from './types';

const hasOwnProperty = Object.prototype.hasOwnProperty;
const defaultSchema = 'http://json-schema.org/draft-07/schema#';

function getTypeMatchErrors(
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
): ErrorArray | undefined {
  if (isEmptyObject(target) || !target.type) {
    return;
  } else if ((!input || isEmptyObject(input)) && options.allowPartial) {
    return;
  }

  // TODO: Handle multi-valued type arrays
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
  const inputRequires: Set<string> = new Set(input.required);
  for (const prop of (target.required ?? []) as string[]) {
    if (!inputRequires.has(prop)) {
      const hasDefault = hasOwnProperty.call(
        target.properties![prop],
        'default'
      );
      if (!hasDefault && !options.allowPartial) {
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

  if (subProps) {
    for (const prop in superProps) {
      if (
        !hasOwnProperty.call(superProps, prop) ||
        !hasOwnProperty.call(subProps, prop)
      ) {
        continue;
      }

      const errors = getErrors(subProps[prop], superProps[prop], options, {
        input: [...paths.input, prop],
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
      compatible =
        subFormats[target.format] &&
        subFormats[target.format].indexOf(input.format) !== -1;
    }
    if (!compatible) {
      return [{ paths, args: ['String format mismatch'] }];
    }
  }

  if (target.pattern && target.pattern !== input.pattern) {
    return [{ paths, args: ['String pattern mismatch'] }];
  }

  if (
    hasOwnProperty.call(target, 'minLength') &&
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
    hasOwnProperty.call(target, 'maxLength') &&
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

  const inputMinItems = hasOwnProperty.call(input, 'minItems')
    ? input.minItems
    : Array.isArray(input.items)
    ? input.items.length
    : null;
  const targetMinItems = hasOwnProperty.call(target, 'minItems')
    ? target.minItems
    : Array.isArray(target.items)
    ? target.items.length
    : null;
  const inputMaxItems = hasOwnProperty.call(input, 'maxItems')
    ? input.maxItems
    : Array.isArray(input.items)
    ? input.items.length
    : null;
  const targetMaxItems = hasOwnProperty.call(target, 'maxItems')
    ? target.maxItems
    : Array.isArray(target.items)
    ? target.items.length
    : null;

  if (targetMinItems !== null) {
    if (inputMinItems === null) {
      return [{ paths, args: ['input does not guarantee minItems'] }];
    } else if (inputMinItems < targetMinItems) {
      return [{ paths, args: ['input minItems is less than target'] }];
    } else if (targetMaxItems !== null && inputMinItems > targetMaxItems) {
      return [{ paths, args: ['input minItems is more than target maxItems'] }];
    }
  }
  if (targetMaxItems !== null) {
    if (inputMaxItems === null) {
      return [{ paths, args: ['input does not guaranteee maxItems'] }];
    } else if (inputMaxItems > targetMaxItems) {
      return [{ paths, args: ['input maxItems is more than target'] }];
    } else if (inputMinItems !== null && inputMinItems > targetMaxItems) {
      return [{ paths, args: ['input minItems is more than target minItems'] }];
    }
  }

  if (Array.isArray(target.items)) {
    if (!hasOwnProperty.call(input, 'items')) {
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
          input: [...paths.input, i],
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
  } else if (inputMaxItems === 0) {
    // A zero-tuple [] satisfies any target (if it doesn't violate length
    // constraints, already covered above).
    return;
  } else if (Array.isArray(input.items)) {
    // TODO: What if *both* are arrays?
    for (const it of input.items) {
      const errors = getErrors(
        it as JSONSchema7,
        (target.items ?? {}) as JSONSchema7,
        options,
        {
          input: [...paths.input, 'items'],
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
  } else {
    const errors = getErrors(
      (input.items ?? {}) as JSONSchema7,
      (target.items ?? {}) as JSONSchema7,
      options,
      {
        input: [...paths.input, 'items'],
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

  if (hasOwnProperty.call(target, 'maximum')) {
    if (
      !hasOwnProperty.call(input, 'maximum') &&
      !hasOwnProperty.call(input, 'exclusiveMaximum')
    ) {
      return [{ paths, args: ['input has no maximum property'] }];
    }

    if (
      hasOwnProperty.call(input, 'maximum') &&
      (input.maximum as number) > (target.maximum as number)
    ) {
      return [{ paths, args: ['input permits greater maximum'] }];
    }
    if (
      hasOwnProperty.call(input, 'exclusiveMaximum') &&
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

  if (hasOwnProperty.call(target, 'exclusiveMaximum')) {
    if (
      !hasOwnProperty.call(input, 'maximum') &&
      !hasOwnProperty.call(input, 'exclusiveMaximum')
    ) {
      return [{ paths, args: ['input has no maximum property'] }];
    }

    if (
      hasOwnProperty.call(input, 'maximum') &&
      input.maximum >= target.exclusiveMaximum
    ) {
      return [{ paths, args: ['input permits greater maximum'] }];
    }
    if (
      hasOwnProperty.call(input, 'exclusiveMaximum') &&
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

  if (hasOwnProperty.call(target, 'minimum')) {
    if (
      !hasOwnProperty.call(input, 'minimum') &&
      !hasOwnProperty.call(input, 'exclusiveMinimum')
    ) {
      return [{ paths, args: ['input has no minimum property'] }];
    }

    if (
      hasOwnProperty.call(input, 'minimum') &&
      input.minimum < target.minimum
    ) {
      return [{ paths, args: ['input permits greater minimum'] }];
    }
    if (
      hasOwnProperty.call(input, 'exclusiveMinimum') &&
      input.exclusiveMinimum < target.minimum
    ) {
      return [{ paths, args: ['input permits greater minimum'] }];
    }
  }

  if (hasOwnProperty.call(target, 'exclusiveMinimum')) {
    if (
      !hasOwnProperty.call(input, 'minimum') &&
      !hasOwnProperty.call(input, 'exclusiveMinimum')
    ) {
      return [{ paths, args: ['input has no minimum property'] }];
    }

    if (
      hasOwnProperty.call(input, 'minimum') &&
      (input.minimum as number) <= (target.exclusiveMinimum as number)
    ) {
      return [{ paths, args: ['input permits smaller minimum'] }];
    }
    if (
      hasOwnProperty.call(input, 'exclusiveMinimum') &&
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
        input: [...paths.input, 'allOf', idx],
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
        input: [...paths.input, 'anyOf', idx],
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
        input: [...paths.input, 'oneOf', idx],
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
      input: [...paths.input, 'not'],
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

function getErrors(
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
): ErrorArray | undefined {
  if (
    !target ||
    input === target ||
    isEmptyObject(target) ||
    (input &&
      typeof input === 'object' &&
      '$id' in input &&
      input.$id === target.$id) ||
    isEqual(input, target)
  ) {
    return;
  }

  if (!input) {
    return [{ paths, args: ['input does not provide a value'] }];
  }

  if ('const' in input) {
    if (!options.ajv.validate(target, input)) {
      return [{ paths, args: ['const input does not match target schema'] }];
    }
  }

  if (target.anyOf || input.anyOf) {
    return getAnyOfErrors(input, target, options, paths);
  } else if (target.allOf || input.allOf) {
    return getAllOfErrors(input, target, options, paths);
  } else if (target.oneOf || input.oneOf) {
    return getOneOfErrors(input, target, options, paths);
  } else if (input.not || target.not) {
    return getNotErrors(input, target, options, paths);
  }

  // Type matching must be done *first*, or we may make wrong assumptions
  // about available keywords (e.g. array `items` vs. object `properties`)
  const tme = getTypeMatchErrors(input, target, options, paths);
  if (tme?.length) {
    return tme as ErrorArray;
  }

  let validators;
  const inputType = input.type;
  const targetType = target.type;
  if (inputType === 'string' || targetType === 'string') {
    validators = [getStringErrors];
  } else if (inputType === 'object' || targetType === 'object') {
    // If we're not dealing with objects, we can bypass calling several
    // validators
    validators = [getInputPropertyErrors, getRequiredInputErrors];
    if (!options.allowAdditionalProps) {
      validators.push(getExtraneousInputErrors);
    }
  } else if (inputType === 'array' || targetType === 'array') {
    validators = [getArrayErrors];
  } else if (
    inputType === 'integer' ||
    targetType === 'integer' ||
    inputType === 'number' ||
    targetType === 'number'
  ) {
    validators = [getNumericErrors];
  } else {
    validators = [];
  }

  if (target.const) {
    validators.push(getConstErrors);
  }

  for (const validator of validators) {
    const errors = validator(input, target, options, paths);
    if (errors?.length) {
      return errors as ErrorArray;
    }
  }
}

function isValidTopLevelSchema(schema: JSONSchema7): boolean {
  if (
    schema.type ||
    schema.oneOf ||
    schema.anyOf ||
    schema.allOf ||
    hasOwnProperty.call(schema, 'const') ||
    isEmptyObject(schema)
  ) {
    return true;
  }

  for (const key in schema) {
    if (hasOwnProperty.call(key)) {
      if (key !== 'description' && key !== 'title' && !key.startsWith('$')) {
        return false;
      }
    }
  }

  return true;
}

/**
 * @param input
 * @param target
 * @param options
 * @param options.allowPartial
 * @param options.allowAdditionalProps
 * @param options.ajv
 * @param options.refParserOptions
 * @param options.dereference
 * @param errorsOut
 */
export default async function inputSatisfies(
  input: JSONSchema7,
  target: JSONSchema7,
  options: boolean | Partial<Options> = false,
  errorsOut?: SchemaCompatError[]
): Promise<boolean> {
  const draftRegex = /draft-0[1234]\/schema/;
  if (
    draftRegex.test(input.$schema ?? defaultSchema) ||
    draftRegex.test(target.$schema ?? defaultSchema)
  ) {
    throw new Error('Requires JSON schema draft version 5+');
  }

  if (isEmptyObject(target)) {
    return true;
  }

  if (!isValidTopLevelSchema(input)) {
    throw new Error('Input schema does not appear to be a top-level schema');
  } else if (!isValidTopLevelSchema(target)) {
    throw new Error('Target schema does not appear to be a top-level schema');
  }

  const processedOpts: Options =
    typeof options === 'boolean'
      ? {
          allowPartial: options,
          allowAdditionalProps: false,
          ajv: new AJV(),
          refParserOptions: {},
          dereference: true,
        }
      : {
          allowPartial: options.allowPartial || false,
          allowAdditionalProps: options.allowAdditionalProps || false,
          ajv: options.ajv ?? new AJV(),
          refParserOptions: options.refParserOptions ?? {},
          dereference: options.dereference ?? true,
        };

  let [sub, sup] = processedOpts.dereference
    ? await Promise.all([
        $RefParser.dereference(
          cloneRefs(
            (input.$schema
              ? input
              : { ...input, $schema: defaultSchema }) as RefParserSchemaType
          ),
          processedOpts.refParserOptions
        ) as Promise<JSONSchema7>,
        $RefParser.dereference(
          cloneRefs(
            (target.$schema
              ? target
              : { ...target, $schema: defaultSchema }) as RefParserSchemaType
          ),
          processedOpts.refParserOptions
        ) as Promise<JSONSchema7>,
      ])
    : [input, target];

  if (hasAllOf(sub)) sub = purgeEmptyAllOfObjects(mergeAllOf(sub));
  if (hasAllOf(sup)) sup = purgeEmptyAllOfObjects(mergeAllOf(sup));
  const errors = getErrors(sub, sup, processedOpts, {
    input: [],
    target: [],
  });

  if (errors?.length) {
    if (isLogEnabled()) {
      for (const { paths, args } of errors.reverse()) {
        log(paths, ...args);
      }
    }
    if (errorsOut) {
      const len = errors.length;
      errorsOut.length = len;
      for (let i = 0; i < len; i++) {
        errorsOut[+i] = errors[+i];
      }
    }
    return false;
  } else {
    return true;
  }
}

function hasAllOf(schema: JSONSchema7): boolean {
  if (!schema || typeof schema !== 'object') {
    return false;
  } else if ('allOf' in schema) {
    return true;
  } else if ('anyOf' in schema && someBool(schema.anyOf ?? [], hasAllOf)) {
    return true;
  } else if ('oneOf' in schema && someBool(schema.oneOf ?? [], hasAllOf)) {
    return true;
  } else if ('type' in schema && schema.type === 'object') {
    return someBool(Object.values(schema.properties ?? {}), hasAllOf);
  } else {
    return someBool(Object.values(schema ?? {}), hasAllOf);
  }
}

/**
 * MergeAllOf has an annoying tendency to create empty objects that confuse
 * validation; e.g. { "allOf": [
 *     {
 *     "anyOf": [{
 *     "type": "object"
 *     "required": ["passthrough"],
 *     "properties": { ... },
 *     }]
 *     },
 *     { "type": "object", "required": [], "properties": {} } ] } becomes { "anyOf": [{
 *     "type": "object"
 *     "required": ["passthrough"],
 *     "properties": { ... }, }], "type": "object", "required": [], "properties": {} }
 *
 * @param s
 * @returns Input object or a purged copy
 */
function purgeEmptyAllOfObjects(s: JSONSchema7): JSONSchema7 {
  if (!s || typeof s !== 'object') {
    return s;
  }

  if (Array.isArray(s)) {
    const len = s.length;
    const copy: typeof s = new Array(len);
    let changed = false;
    for (let i = 0; i < len; i++) {
      const oldVal = s[i];
      const newVal = purgeEmptyAllOfObjects(oldVal);
      copy[i] = newVal;
      changed = changed || newVal !== oldVal;
    }
    return changed ? copy : (s as JSONSchema7);
  }

  if (s.type === 'object') {
    if (
      s.anyOf &&
      (!s.required || s.required.length === 0) &&
      (!s.properties || isEmptyObject(s.properties)) &&
      allBool(
        s.anyOf,
        (sub) => sub && typeof sub === 'object' && sub.type === 'object'
      )
    ) {
      const { type, properties, required, ...rest } = s;
      s = rest;
    }

    const props = { ...s.properties };
    if (props) {
      let changed = false;
      for (const k in props) {
        if (hasOwnProperty.call(props, k)) {
          const oldVal = props[k];
          const newVal = purgeEmptyAllOfObjects(oldVal as JSONSchema7);
          if (newVal !== oldVal) {
            props[k] = newVal;
            changed = true;
          }
        }
      }
      return changed ? { ...s, properties: props } : s;
    }
  }

  return s;
}
