import { Pointer } from 'rfc6902/pointer';
import { JSONSchema7 } from 'json-schema';

import { ErrorArray, Paths } from './types';

const hasOwnProperty = Object.prototype.hasOwnProperty;

/** @internal */
export function all<T>(
  elements: T[],
  condition: (val: T, idx: number) => ErrorArray | undefined
): ErrorArray | undefined {
  for (let i = 0, len = elements.length; i < len; i++) {
    const errors = condition(elements[i], i);
    if (errors?.length) {
      return errors as ErrorArray;
    }
  }
  return undefined;
}

/** @internal */
export function allBool<T>(
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

/** @internal */
export function some<T>(
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
  return allErrors as ErrorArray; // if length were 0 we'd have returned early
}

/** @internal */
export function one<T>(
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

/** @internal */
export function isEmptyObject(ob: JSONSchema7): boolean {
  if (ob === null || typeof ob !== 'object' || Array.isArray(ob)) {
    return false;
  }
  for (const key in ob) {
    if (hasOwnProperty.call(ob, key)) {
      return false;
    }
  }
  return true;
}

/** @internal */
export const allFormats = [
  'date-time',
  'date',
  'time',
  'email',
  // 'idn-email', TODO: Not currently supported by AJV
  'hostname',
  // 'idn-hostname', TODO: Not currently supported by AJV
  'ipv4',
  'ipv6',
  'uri',
  'uri-reference',
  // 'iri', TODO: Not currently supported by AJV
  // 'iri-reference', TODO: Not currently supported by AJV
  'uri-template',
  'json-pointer',
  'relative-json-pointer',
  'regex',
];

/** @internal */
export const subFormats = {
  'uri-reference': ['uri'],
  // iri: ['uri'], TODO: Not currently supported by AJV
  // 'iri-reference': ['iri', 'uri', 'uri-reference'], TODO: Not currently supported by AJV
  // 'idn-hostname': ['hostname'], TODO: Not currently supported by AJV
  // 'idn-email': ['email'], TODO: Not currently supported by AJV
};
