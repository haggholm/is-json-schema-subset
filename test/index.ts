/* tslint:disable:no-console */

import { JSONSchema } from 'json-schema-ref-parser';
import jsf = require('json-schema-faker');
import AJV = require('ajv');

import satisfies from '../src/is-json-schema-subset';

const RANDOM_SAMPLES = 100;

const ajv = new AJV({ allErrors: true });
jsf.option('optionalsProbability', 0.5);

expect.extend({
	toSatisfy: async (subset: JSONSchema, superset: JSONSchema) => {
		const [subInconsistent, supInconsistent, pass] = await Promise.all([
			satisfies(subset, subset),
			satisfies(superset, superset),
			satisfies(subset, superset),
		]);
		if (!subInconsistent) {
			throw new Error('Subset does not match itself!');
		}
		if (!supInconsistent) {
			throw new Error('Superset does not match itself!');
		}

		if (pass) {
			const superValidator = ajv.compile(superset);
			for (let i = 0; i < RANDOM_SAMPLES; i++) {
				let instance;
				try {
					instance = jsf.generate(subset, []);
				} catch (err) {
					// Ignore: jsf does not support all draft-7 features.
				}

				console.log('test random instance', JSON.stringify(instance));
				if (!superValidator(instance)) {
					return {
						pass,
						message: () =>
							`!!!ERROR!!! Subset ${JSON.stringify(
								subset
							)} was found to satisfy ${JSON.stringify(
								superset
							)}, but failed on random data: ${JSON.stringify(instance)}`,
					};
				}
			}
		}

		return {
			pass,
			message: () =>
				`Expected ${JSON.stringify(subset)} to satisfy ${JSON.stringify(
					superset
				)}`,
		};
	},
	toViolate: async (subset: JSONSchema, superset: JSONSchema) => {
		const [subInconsistent, supInconsistent, pass] = await Promise.all([
			satisfies(subset, subset),
			satisfies(superset, superset),
			satisfies(subset, superset),
		]);
		if (!subInconsistent) {
			throw new Error('Subset does not match itself!');
		}
		if (!supInconsistent) {
			throw new Error('Superset does not match itself!');
		}

		return {
			pass: !pass,
			message: () =>
				`Expected ${JSON.stringify(subset)} not to satisfy ${JSON.stringify(
					superset
				)}`,
		};
	},
});

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
			// @ts-ignore
		}).toSatisfy({
			title: 'parent',
			type,
		}));
	test(`array identity test for ${type}`, () =>
		expect({
			title: 'child',
			type: 'array',
			items: { type },
			// @ts-ignore
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
					// @ts-ignore
				}).toViolate({
					title: 'parent',
					type,
				}));
			test(`array type mismatch test for ${type2} satisfying ${type}`, () =>
				expect({
					title: 'child',
					type: 'array',
					items: { type: type2 },
					// @ts-ignore
				}).toViolate({
					title: 'parent',
					type: 'array',
					items: { type },
				}));
		}
	}
}

test('simple match', () =>
	expect({
		title: 'child',
		type: 'object',
		properties: {
			boolean: { type: 'boolean' },
			string: { type: 'string' },
			integer: { type: 'integer' },
			number: { type: 'number' },
			array: { type: 'array', items: { type: 'number' } },
			extra: { type: 'integer' },
		},
		// @ts-ignore
	}).toSatisfy({
		title: 'parent',
		type: 'object',
		properties: {
			boolean: { type: 'boolean' },
			string: { type: 'string' },
			integer: { type: 'integer' },
			number: { type: 'number' },
			array: { type: 'array', items: { type: 'number' } },
		},
	}));

test('numbers accept integers', () =>
	expect({
		title: 'child',
		type: 'integer',
		// @ts-ignore
	}).toSatisfy({
		title: 'parent',
		type: 'number',
	}));

test('integers do not accept numbers', () =>
	expect({
		title: 'child',
		type: 'number',
		// @ts-ignore
	}).toViolate({
		title: 'parent',
		type: 'integer',
	}));

test('reject additional properties', () =>
	expect({
		title: 'child',
		type: 'object',
		properties: {
			boolean: { type: 'boolean' },
			string: { type: 'string' },
			integer: { type: 'integer' },
			number: { type: 'number' },
			array: { type: 'array', items: { type: 'number' } },
			extra: { type: 'integer' },
		},
		// @ts-ignore
	}).toViolate({
		title: 'parent',
		type: 'object',
		additionalProperties: false,
		properties: {
			boolean: { type: 'boolean' },
			string: { type: 'string' },
			integer: { type: 'integer' },
			number: { type: 'number' },
			array: { type: 'array', items: { type: 'number' } },
		},
	}));

test('pass range check', () =>
	expect({
		title: 'child',
		type: 'number',
		maxValue: 10,
		// @ts-ignore
	}).toViolate({
		title: 'child',
		type: 'number',
		maxValue: 10,
	}));

test('fail range check', () =>
	expect({
		title: 'child',
		type: 'number',
		maxValue: 10.1,
		// @ts-ignore
	}).toViolate({
		title: 'child',
		type: 'number',
		maxValue: 10,
	}));

test('fail range check', () =>
	expect({
		title: 'child',
		type: 'number',
		maxValue: 10,
		// @ts-ignore
	}).toViolate({
		title: 'child',
		type: 'number',
		maxValue: 10,
		exclusiveMaximum: true,
	}));
