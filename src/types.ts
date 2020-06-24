import { Ajv } from 'ajv';
import { JSONSchema7 } from 'json-schema';
import $RefParser = require('@apidevtools/json-schema-ref-parser');

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
  refParserOptions: $RefParser.Options;
}

export type Validator = (
  input: JSONSchema7,
  target: JSONSchema7,
  options: Options,
  paths: Paths
) => ErrorArray | undefined;
