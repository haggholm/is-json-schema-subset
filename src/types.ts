import type { Ajv } from 'ajv';
import type { JSONSchema7 } from 'json-schema';
import type { Options as $RefParserOptions } from '@apidevtools/json-schema-ref-parser';

export interface Paths {
  input: (string | number)[];
  target: (string | number)[];
}

export interface SchemaCompatError {
  paths: Paths;
  args: any[];
}

export type ErrorArray = [SchemaCompatError, ...SchemaCompatError[]];

export interface Options {
  allowPartial: boolean;
  allowAdditionalProps: boolean;
  ajv: Ajv;
  refParserOptions: $RefParserOptions;
  dereference: boolean;
}

export type Validator = (
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
) => ErrorArray | undefined;
