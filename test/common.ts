/* tslint:disable:no-console */

import { JSONSchema } from 'json-schema-ref-parser';
import jsf = require('json-schema-faker');
import AJV = require('ajv');

import satisfies from '../src/is-json-schema-subset';

const RANDOM_SAMPLES = 100;

const ajv = new AJV({ allErrors: true });
jsf.option('optionalsProbability', 0.5);

export { JSONSchema, jsf, ajv, RANDOM_SAMPLES, satisfies };

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
			const superValidator = ajv.compile(
				superset.$schema
					? superset
					: { ...superset, $schema: 'http://json-schema.org/draft-07/schema#' }
			);
			for (let i = 0; i < RANDOM_SAMPLES; i++) {
				let instance;
				try {
					instance = jsf.generate(subset, []);
				} catch (err) {
					// Ignore: jsf does not support all draft-7 features.
				}

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
