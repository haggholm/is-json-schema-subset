/* tslint:disable:no-console */

import isEqual = require('fast-deep-equal');
import mergeAllOf = require('json-schema-merge-allof');
import RefParser = require('json-schema-ref-parser');
import { JSONSchema } from 'json-schema-ref-parser';
import mkDebug = require('debug');

const debug = mkDebug('is-json-schema-subset');

const defaultSchema = 'http://json-schema.org/draft-07/schema#';

interface Paths {
	input: Readonly<(string | number)[]>;
	target: Readonly<(string | number)[]>;
}

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

function log(paths: Paths, ...args: any[]) {
	const indent = Math.max(paths.input.length, paths.target.length);
	debug(''.padStart(indent, ' '), ...args, 'at', ...formatPaths(paths));
}

function all<T>(
	elements: T[],
	condition: (val: T, idx: number) => boolean
): boolean {
	for (let i = 0, len = elements.length; i < len; i++) {
		const res = condition(elements[i], i);
		if (!res) {
			return false;
		}
	}
	return true;
}

function allConds<T>(
	elements: T[],
	condition: (val: T, idx: number) => ValidatorResult
): ValidatorResult {
	for (let i = 0, len = elements.length; i < len; i++) {
		const res = condition(elements[i], i);
		if (!res[0]) {
			return res;
		}
	}
	return [true];
}

function someConds<T>(
	elements: T[],
	condition: (val: T, idx: number) => ValidatorResult,
	paths: Paths
): ValidatorResult {
	const errors: ValidatorErrors[] = [];
	for (let i = 0, len = elements.length; i < len; i++) {
		const res = condition(elements[i], i);
		if (res[0]) {
			return [true];
		} else {
			errors.push(...res[1]);
		}
	}
	return [
		false,
		errors.length === 0 ? [{ paths, msg: 'No elements found' }] : errors,
	];
}

function oneCond<T>(
	elements: T[],
	condition: (val: T, idx: number) => ValidatorResult,
	paths: Paths
): ValidatorResult {
	let matches = 0;
	const errors: ValidatorErrors[] = [];
	for (let i = 0, len = elements.length; i < len; i++) {
		const [ok, errs] = condition(elements[i], i);
		if (ok) {
			if (++matches >= 2) {
				return [false, [{ paths, msg: 'Multiple elements match' }]];
			}
		} else {
			errors.push(...errs);
		}
	}
	return matches === 1
		? [true]
		: errors.length > 0
		? [false, errors.concat([{ paths, msg: 'No elements match' }])]
		: [false, [{ paths, msg: 'No elements match' }]];
}

function checkConditions(
	conditions: (
		| [Paths, boolean, () => ValidatorResult, string]
		| [Paths, boolean, ValidatorResult, string]
	)[]
): ValidatorResult {
	for (let i = 0, len = conditions.length; i < len; i++) {
		const [paths, runCheck, fn, errStr] = conditions[i];
		if (runCheck) {
			const [ok, errors] = typeof fn === 'function' ? fn() : fn;
			if (!ok) {
				errors.push({ paths, msg: errStr });
				return [false, errors];
			}
		}
	}

	return [true];
}

function typeMatches(
	input: JSONSchema,
	target: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean,
	paths: Paths
): ValidatorResult {
	if (isEqual(target, {})) {
		return [true];
	}

	const match =
		input.type === target.type ||
		(target.type === 'number' && input.type === 'integer');

	if (!match) {
		// tslint:disable-next-line:no-unused-expression
		return [
			false,
			[
				{
					paths,
					msg: `Type mismatch: ${input.type} does not satisfy ${target.type}`,
				},
			],
		];
	}
	return [true];
}

function inputHasRequiredProps(
	input: JSONSchema,
	target: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean,
	paths: Paths
): ValidatorResult {
	// Verify that the target doesn't require anything missing from the input
	const inputRequires = new Set(input.required ?? []);
	for (const prop of target.required ?? []) {
		if (!inputRequires.has(prop)) {
			return [
				false,
				[{ paths, msg: `input does not guarantee required property ${prop}` }],
			];
		}
	}

	return [true];
}

function inputHasNoExtraneousProps(
	input: JSONSchema,
	target: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean,
	paths: Paths
): ValidatorResult {
	// Verify that the input doesn't have extra properties violating the target
	if (target.additionalProperties === false) {
		const superProps = new Set(Object.keys(target.properties));
		for (const prop of Object.keys(input.properties ?? {})) {
			if (!superProps.has(prop)) {
				return [
					false,
					[{ paths, msg: `input has extraneous property: ${prop}` }],
				];
			}
		}
	}

	return [true];
}

function inputPropertiesMatch(
	input: JSONSchema,
	target: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean,
	paths: Paths
): ValidatorResult {
	const subProps = (input.properties ?? {}) as {
		[k: string]: JSONSchema;
	};
	const superProps = (target.properties ?? {}) as {
		[k: string]: JSONSchema;
	};

	for (const prop of Object.keys(superProps)) {
		if (!subProps || !Object.prototype.hasOwnProperty.call(subProps, prop)) {
			continue;
		}

		const [ok, errors] = satisfies(
			subProps[prop],
			superProps[prop],
			allowPartial,
			allowAdditionalProps,
			{
				input: paths.input.concat([prop]),
				target: paths.target.concat([prop]),
			}
		);
		if (!ok) {
			return [
				false,
				errors.concat([{ paths, msg: `Property ${prop} does not match` }]),
			];
		}
	}

	return [true];
}

function calculateEffectiveMinLength(
	schema: JSONSchema &
		(
			| { type: 'string' }
			| { allOf: JSONSchema[] }
			| { anyOf: JSONSchema[] }
			| { oneOf: JSONSchema[] }
		)
) {
	if (schema.type === 'string') {
		if (schema.minLength !== undefined) {
			return schema.minLength;
		} else if (schema.enum) {
			return Math.min(...schema.enum.map((s) => s.length));
		}
	} else if (schema.allOf ?? schema.anyOf ?? schema.oneOf) {
		return Math.min(
			(schema.allOf ?? schema.anyOf ?? schema.oneOf).map((s) =>
				calculateEffectiveMinLength(s)
			)
		);
	} else {
		return -1;
	}
}

function calculateEffectiveMaxLength(
	schema: JSONSchema &
		(
			| { type: 'string' }
			| { allOf: JSONSchema[] }
			| { anyOf: JSONSchema[] }
			| { oneOf: JSONSchema[] }
		)
) {
	if (schema.type === 'string') {
		if (schema.minLength !== undefined) {
			return schema.minLength;
		} else if (schema.enum) {
			return Math.max(...schema.enum.map((s) => s.length));
		}
	} else if (schema.allOf ?? schema.anyOf ?? schema.oneOf) {
		return Math.max(
			(schema.allOf ?? schema.anyOf ?? schema.oneOf).map((s) =>
				calculateEffectiveMaxLength(s)
			)
		);
	} else {
		return -1;
	}
}

function gatherEnumValues(schema: JSONSchema): string[] | undefined {
	if (schema.type === 'string') {
		return schema.enum;
	} else if (schema.allOf ?? schema.anyOf ?? schema.oneOf) {
		try {
			return [].concat(
				((schema.allOf ??
					schema.anyOf ??
					schema.oneOf) as JSONSchema[]).map((s) => gatherEnumValues(s))
			);
		} catch (err) {
			return undefined;
		}
	} else {
		throw new Error(`Cannot gather enums from node of type ${schema.type}`);
	}
}

function stringRulesMatch(
	input: JSONSchema,
	target: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean,
	paths: Paths
): ValidatorResult {
	if (target.type !== 'string') {
		return [true]; // nop
	}

	if (target.format && target.format !== input.format) {
		let compatible;
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
		if (!compatible) {
			return [false, [{ paths, msg: 'String format mismatch' }]];
		}
	}

	if (target.pattern && target.pattern !== input.pattern) {
		return [false, [{ paths, msg: 'String pattern mismatch' }]];
	}

	if (
		target.hasOwnProperty('minLength') &&
		calculateEffectiveMinLength(input) < target.minLength
	) {
		return [false, [{ paths, msg: 'input minLength is less than target' }]];
	}
	if (
		target.hasOwnProperty('maxLength') &&
		calculateEffectiveMaxLength(input) > target.maxLength
	) {
		return [false, [{ paths, msg: 'input maxLength is less than target' }]];
	}

	if (target.hasOwnProperty('enum')) {
		const inputEnums = gatherEnumValues(input);
		if (inputEnums === undefined) {
			return [false, [{ paths, msg: 'input is missing enum restrictions' }]];
		}
		const enums = new Set(target.enum);
		for (const e of inputEnums) {
			if (!enums.has(e)) {
				return [
					false,
					[
						{
							paths,
							msg: `target [${Array.from(enums).join(
								', '
							)}] is missing possible input enum: "${e}"`,
						},
					],
				];
			}
		}
	}

	return [true];
}

function arrayRulesMatch(
	input: JSONSchema,
	target: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean,
	paths: Paths
): ValidatorResult {
	if (target.type !== 'array') {
		return [true]; // nop
	}

	if (
		target.hasOwnProperty('minItems') &&
		(!input.hasOwnProperty('minItems') || input.minItems < target.minItems)
	) {
		return [false, [{ paths, msg: 'input minItems is less than target' }]];
	}
	if (
		target.hasOwnProperty('maxItems') &&
		(!input.hasOwnProperty('maxItems') || input.maxItems > target.maxItems)
	) {
		return [false, [{ paths, msg: 'input maxItems is more than target' }]];
	}

	if (Array.isArray(target.items)) {
		if (!input.hasOwnProperty('items')) {
			return [false, [{ paths, msg: 'input is missing items' }]];
		}

		if (
			!Array.isArray(input.items) ||
			target.items.length !== input.items.length
		) {
			return [false, [{ paths, msg: 'Tuple item count mismatch' }]];
		}
		for (let i = 0, len = target.items.length; i < len; i++) {
			const [ok, errors] = satisfies(
				input.items[i] as JSONSchema,
				target.items[i] as JSONSchema,
				allowPartial,
				allowAdditionalProps,
				{
					input: paths.input.concat([i]),
					target: paths.target.concat([i]),
				}
			);
			if (!ok) {
				return [
					false,
					errors.concat([
						{ paths, msg: 'Tuple items mismatch (see previous error)' },
					]),
				];
			}
		}
	} else {
		const [ok, errors] = satisfies(
			input.items as JSONSchema,
			target.items as JSONSchema,
			allowPartial,
			allowAdditionalProps,
			{
				input: paths.input.concat(['items']),
				target: paths.target.concat(['items']),
			}
		);
		if (!ok) {
			return [
				false,
				errors.concat([
					{ paths, msg: 'Array items mismatch (see previous error)' },
				]),
			];
		}
	}

	if (target.uniqueItems && !input.uniqueItems) {
		return [false, [{ paths, msg: 'input does not require uniqueItems' }]];
	}

	return [true];
}

function numRulesMatch(
	input: JSONSchema,
	target: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean,
	paths: Paths
): ValidatorResult {
	if (target.type !== 'integer' && target.type !== 'number') {
		return [true]; // nop
	}

	if (target.hasOwnProperty('maximum')) {
		if (
			!input.hasOwnProperty('maximum') &&
			!input.hasOwnProperty('exclusiveMaximum')
		) {
			return [false, [{ paths, msg: 'input has no maximum property' }]];
		}

		if (
			input.hasOwnProperty('maximum') &&
			(input.maximum as number) > (target.maximum as number)
		) {
			return [false, [{ paths, msg: 'input permits greater maximum' }]];
		}
		if (
			input.hasOwnProperty('exclusiveMaximum') &&
			(input.exclusiveMaximum as number) > (target.maximum as number)
		) {
			return [
				false,
				[{ paths, msg: 'input permits greater maximum (exclusive)' }],
			];
		}
	}

	if (target.hasOwnProperty('exclusiveMaximum')) {
		if (
			!input.hasOwnProperty('maximum') &&
			!input.hasOwnProperty('exclusiveMaximum')
		) {
			return [false, [{ paths, msg: 'input has no maximum property' }]];
		}

		if (
			input.hasOwnProperty('maximum') &&
			input.maximum >= target.exclusiveMaximum
		) {
			return [false, [{ paths, msg: 'input permits greater maximum' }]];
		}
		if (
			input.hasOwnProperty('exclusiveMaximum') &&
			(input.exclusiveMaximum as number) > (target.exclusiveMaximum as number)
		) {
			return [
				false,
				[{ paths, msg: 'input permits greater exclusiveMaximum' }],
			];
		}
	}

	if (target.hasOwnProperty('minimum')) {
		if (
			!input.hasOwnProperty('minimum') &&
			!input.hasOwnProperty('exclusiveMinimum')
		) {
			return [false, [{ paths, msg: 'input has no minimum property' }]];
		}

		if (input.hasOwnProperty('minimum') && input.minimum < target.minimum) {
			return [false, [{ paths, msg: 'input permits greater minimum' }]];
		}
		if (
			input.hasOwnProperty('exclusiveMinimum') &&
			input.exclusiveMinimum < target.minimum
		) {
			return [false, [{ paths, msg: 'input permits greater minimum' }]];
		}
	}

	if (target.hasOwnProperty('exclusiveMinimum')) {
		if (
			!input.hasOwnProperty('minimum') &&
			!input.hasOwnProperty('exclusiveMinimum')
		) {
			return [false, [{ paths, msg: 'input has no minimum property' }]];
		}

		if (
			input.hasOwnProperty('minimum') &&
			(input.minimum as number) <= (target.exclusiveMinimum as number)
		) {
			return [false, [{ paths, msg: 'input permits smaller minimum' }]];
		}
		if (
			input.hasOwnProperty('exclusiveMinimum') &&
			(input.exclusiveMinimum as number) < (target.exclusiveMinimum as number)
		) {
			return [
				false,
				[{ paths, msg: 'input permits greater exclusiveMinimum' }],
			];
		}
	}

	if (target.multipleOf) {
		if (!input.multipleOf) {
			return [false, [{ paths, msg: 'input lacks multipleOf' }]];
		}
		if (input.multipleOf % target.multipleOf !== 0) {
			return [
				false,
				[
					{
						paths,
						msg:
							'input multipleOf is not an integer multiple of target multipleOf',
					},
				],
			];
		}
	}

	return [true];
}

function constMatch(
	input: JSONSchema,
	target: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean,
	paths: Paths
): ValidatorResult {
	if (target.const && target.const !== input.const) {
		return [
			false,
			[
				{
					paths,
					msg: `input const mismatch (${target.const} !== ${input.const})`,
				},
			],
		];
	}

	return [true];
}

function allOfMatches(
	input: JSONSchema,
	target: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean,
	paths: Paths
): ValidatorResult {
	return checkConditions([
		[
			paths,
			input.allOf,
			() =>
				allConds(input.allOf as JSONSchema[], (e, idx) =>
					satisfies(e, target, allowPartial, allowAdditionalProps, {
						input: paths.input.concat(['allOf', idx]),
						target: paths.target,
					})
				),
			'failed allOf check',
		],
		[
			paths,
			target.allOf,
			() =>
				allConds(target.allOf as JSONSchema[], (e, idx) =>
					satisfies(input, e, allowPartial, allowAdditionalProps, {
						input: paths.input,
						target: paths.target.concat(['allOf', idx]),
					})
				),
			'failed allOf check',
		],
	]);
}

function anyOfMatches(
	input: JSONSchema,
	target: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean,
	paths: Paths
): ValidatorResult {
	return checkConditions([
		[
			// If input can be anyOf [a,b,...], then each of them must be accepted
			// by the target.
			paths,
			input.anyOf,
			() =>
				allConds(input.anyOf as JSONSchema[], (e, idx) =>
					satisfies(e, target, allowPartial, allowAdditionalProps, {
						input: paths.input.concat(['anyOf', idx]),
						target: paths.target,
					})
				),
			'Some input.anyOf elements do not satisfy target',
		],
		[
			// If the target can accept anyOf [a,b,...], then it's enough
			// that at least one is satisfied by the input
			paths,
			target.anyOf,
			() =>
				someConds(
					target.anyOf as JSONSchema[],
					(e, idx) =>
						satisfies(input, e, allowPartial, allowAdditionalProps, {
							input: paths.input,
							target: paths.target.concat(['anyOf', idx]),
						}),
					paths
				),
			'input does not satisfy any of target.anyOf',
		],
	]);
}

function oneOfMatches(
	input: JSONSchema,
	target: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean,
	paths: Paths
): ValidatorResult {
	return checkConditions([
		[
			paths,
			input.oneOf,
			() =>
				allConds(input.oneOf as JSONSchema[], (e, idx) =>
					satisfies(e, target, allowPartial, allowAdditionalProps, {
						input: paths.input.concat(['oneOf', idx]),
						target: paths.target,
					})
				),
			'Some input.oneOf elements do not satisfy target',
		],
		[
			paths,
			target.oneOf,
			() =>
				oneCond(
					target.oneOf as JSONSchema[],
					(e, idx) =>
						satisfies(input, e, allowPartial, allowAdditionalProps, {
							input: paths.input,
							target: paths.target.concat(['oneOf', idx]),
						}),
					paths
				),
			'input does not satisfy exactly one of target.oneOf',
		],
	]);
}

function notMatches(
	input: JSONSchema,
	target: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean,
	paths: Paths
): ValidatorResult {
	if (input.not) {
		const [ok] = satisfies(
			input.not as JSONSchema,
			target,
			allowPartial,
			allowAdditionalProps,
			{
				input: paths.input.concat(['not']),
				target: paths.target,
			}
		);
		if (ok) {
			return [false, [{ paths, msg: 'input.not should not satisfy target' }]];
		}
	}

	if (target.not) {
		const [ok] = satisfies(
			input,
			target.not as JSONSchema,
			allowPartial,
			allowAdditionalProps,
			{
				input: paths.input,
				target: paths.target.concat(['not']),
			}
		);
		if (ok) {
			return [false, [{ paths, msg: 'input should not satisfy target.not' }]];
		}
	}

	return [true];
}

type ValidatorErrors = { paths: Paths; msg: string };
type ValidatorResult =
	| [true, ValidatorErrors[] | undefined]
	| [true]
	| [false, ValidatorErrors[]];
type Validator = (
	input: JSONSchema,
	target: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean,
	paths: Paths
) => ValidatorResult;

function satisfies(
	input: JSONSchema,
	target: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean,
	paths: Paths
): ValidatorResult {
	if (isEqual(input, target)) {
		return [true];
	} else if (isEqual(target, {})) {
		return [true];
	}

	if (target.anyOf || input.anyOf) {
		return anyOfMatches(
			input,
			target,
			allowPartial,
			allowAdditionalProps,
			paths
		);
	} else if (target.allOf || input.allOf) {
		return allOfMatches(
			input,
			target,
			allowPartial,
			allowAdditionalProps,
			paths
		);
	} else if (target.oneOf || input.oneOf) {
		return oneOfMatches(
			input,
			target,
			allowPartial,
			allowAdditionalProps,
			paths
		);
	}

	const validators: Validator[] = [
		arrayRulesMatch,
		constMatch,
		numRulesMatch,
		stringRulesMatch,
		inputHasNoExtraneousProps,
		inputHasRequiredProps,
		inputPropertiesMatch,
		typeMatches,

		anyOfMatches,
		oneOfMatches,
		notMatches,
	];
	if (!allowAdditionalProps) {
		validators.push(inputHasNoExtraneousProps);
	}

	for (const validator of validators) {
		const [ok, errors] = validator(
			input,
			target,
			allowPartial,
			allowAdditionalProps,
			paths
		);
		if (!ok) {
			return [
				false,
				errors.concat([{ paths, msg: `Validator failed: ${validator.name}` }]),
			];
		}
	}

	return [true];
}

export { JSONSchema };
export default async function inputSatisfies(
	input: JSONSchema,
	target: JSONSchema,
	opts:
		| boolean
		| { allowPartial?: boolean; allowAdditionalProps?: boolean } = false
): Promise<boolean> {
	let allowPartial = false;
	let allowAdditionalProps = false;
	if (typeof opts === 'boolean') {
		allowPartial = opts;
	} else if (typeof opts === 'object' && opts !== null) {
		allowPartial = opts.allowPartial;
		allowAdditionalProps = opts.allowAdditionalProps;
	}

	const draftRegex = /draft-0[1234]\/schema/;
	if (
		draftRegex.test(input.$schema ?? defaultSchema) ||
		draftRegex.test(target.$schema ?? defaultSchema)
	) {
		throw new Error('Requires JSON schema draft version 5+');
	}

	const [sub, sup] = await Promise.all([
		RefParser.dereference(
			input.$schema ? input : { ...input, $schema: defaultSchema }
		),
		RefParser.dereference(
			target.$schema ? target : { ...target, $schema: defaultSchema }
		),
	]);
	const [ok, errors] = satisfies(
		clean(mergeAllOf(sub)),
		clean(mergeAllOf(sup)),
		allowPartial,
		allowAdditionalProps,
		{ input: ['input'], target: ['target'] }
	);
	if (!ok) {
		errors.forEach(({ paths, msg }) => log(paths, msg));
	}
	return ok;
}

function clean(schema: JSONSchema) {
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
