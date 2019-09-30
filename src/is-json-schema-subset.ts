/* tslint:disable:no-console */

import isEqual from 'fast-deep-equal';
import mergeAllOf from 'json-schema-merge-allof';
import RefParser, { JSONSchema } from 'json-schema-ref-parser';

const defaultSchema = 'http://json-schema.org/draft-07/schema#';

function log(...args: any[]) {
	if (process.env.DEBUG) {
		console.log(...args);
	}
}

function all<T>(elements: T[], condition: (val: T) => boolean): boolean {
	for (const el of elements) {
		if (!condition(el)) {
			return false;
		}
	}
	return true;
}

function some<T>(elements: T[], condition: (val: T) => boolean): boolean {
	for (const el of elements) {
		if (condition(el)) {
			return true;
		}
	}
	return false;
}

// function multiple<T>(elements: T[], condition: (val: T) => boolean): boolean {
// 	let matches = 0;
// 	for (const el of elements) {
// 		if (condition(el) && ++matches >= 2) {
// 			return true;
// 		}
// 	}
// 	return false;
// }

function one<T>(elements: T[], condition: (val: T) => boolean): boolean {
	let matches = 0;
	for (const el of elements) {
		if (condition(el) && ++matches >= 2) {
			return false;
		}
	}
	return matches === 1;
}

// function none<T>(elements: T[], condition: (val: T) => boolean): boolean {
// 	for (const el of elements) {
// 		if (condition(el)) {
// 			return false;
// 		}
// 	}
// 	return true;
// }

function typeMatches(
	subset: JSONSchema,
	superset: JSONSchema,
	allowPartial: boolean
): boolean {
	const match =
		subset.type === superset.type ||
		(superset.type === 'number' && subset.type === 'integer');

	if (!match) {
		// tslint:disable-next-line:no-unused-expression

		log(`Type mismatch: ${subset.type} does not satisfy ${superset.type}`);
	}
	return match;
}

function subsetHasRequiredProps(
	subset: JSONSchema,
	superset: JSONSchema
): boolean {
	// Verify that the superset doesn't require anything missing from the subset
	const subsetRequires = new Set(subset.required || []);
	for (const prop of superset.required || []) {
		if (!subsetRequires.has(prop)) {
			// tslint:disable-next-line:no-unused-expression

			log('Subset does not require necessary property', prop);
			return false;
		}
	}

	return true;
}

function subsetHasNoExtraneousProps(
	subset: JSONSchema,
	superset: JSONSchema
): boolean {
	// Verify that the subset doesn't have extra properties violating the superset
	if (superset.additionalProperties === false) {
		const superProps = new Set(Object.keys(superset.properties));
		for (const prop of Object.keys(subset.properties || {})) {
			if (!superProps.has(prop)) {
				// tslint:disable-next-line:no-unused-expression
				log('Subset has extraneous property', prop);
				return false;
			}
		}
	}

	return true;
}

function subsetPropertiesMatch(
	subset: JSONSchema,
	superset: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean
): boolean {
	const subProps = (subset.properties || {}) as {
		[k: string]: JSONSchema;
	};
	const superProps = (superset.properties || {}) as {
		[k: string]: JSONSchema;
	};

	for (const prop of Object.keys(superProps)) {
		if (!subProps || !Object.prototype.hasOwnProperty.call(subProps, prop)) {
			continue;
		}

		if (
			!satisfies(
				subProps[prop],
				superProps[prop],
				allowPartial,
				allowAdditionalProps
			)
		) {
			// tslint:disable-next-line:no-unused-expression
			log('Property', prop, 'does not match');
			return false;
		}
	}

	return true;
}

function stringRulesMatch(
	subset: JSONSchema,
	superset: JSONSchema,
	allowPartial: boolean
): boolean {
	if (superset.type !== 'string') {
		return true; // nop
	}

	if (superset.format && superset.format !== subset.format) {
		let compatible;
		switch (superset.format) {
			case 'idn-email':
				compatible = subset.format === 'email';
				break;
			case 'idn-hostname':
				compatible = subset.format === 'hostname';
				break;
			case 'iri':
				compatible = subset.format === 'uri' || subset.format === 'iri';
				break;
			case 'iri-reference':
				compatible =
					subset.format === 'uri' ||
					subset.format === 'uri-reference' ||
					subset.format === 'iri';
				break;
			case 'uri-reference':
				compatible = subset.format === 'uri';
				break;
			default:
				compatible = false;
				break;
		}
		if (!compatible) {
			// tslint:disable-next-line:no-unused-expression
			log('String format mismatch');
			return false;
		}
	}

	if (superset.pattern && superset.pattern !== subset.pattern) {
		// tslint:disable-next-line:no-unused-expression
		log('String pattern mismatch');
		return false;
	}

	if (
		superset.hasOwnProperty('minLength') &&
		(!subset.hasOwnProperty('minLength') ||
			subset.minLength < superset.minLength)
	) {
		log('Subset minLength is less than superset');
		return false;
	}
	if (
		superset.hasOwnProperty('maxLength') &&
		(!subset.hasOwnProperty('maxLength') ||
			subset.maxLength > superset.maxLength)
	) {
		// tslint:disable-next-line:no-unused-expression
		log('Subset maxLength is less than superset');
		return false;
	}

	if (superset.hasOwnProperty('enum')) {
		if (!subset.hasOwnProperty('enum')) {
			// tslint:disable-next-line:no-unused-expression
			log('Subset is missing enum');
			return false;
		}
		const enums = new Set(superset.enum);
		for (const e of subset.enum) {
			if (!enums.has(e)) {
				// tslint:disable-next-line:no-unused-expression
				log('Subset is missing enum:', e);
				return false;
			}
		}
	}

	return true;
}

function arrayRulesMatch(
	subset: JSONSchema,
	superset: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean
): boolean {
	if (superset.type !== 'array') {
		return true; // nop
	}

	if (
		superset.hasOwnProperty('minItems') &&
		(!subset.hasOwnProperty('minItems') || subset.minItems < superset.minItems)
	) {
		// tslint:disable-next-line:no-unused-expression
		log('Subset minItems is less than superset');
		return false;
	}
	if (
		superset.hasOwnProperty('maxItems') &&
		(!subset.hasOwnProperty('maxItems') || subset.maxItems > superset.maxItems)
	) {
		// tslint:disable-next-line:no-unused-expression
		log('Subset maxItems is more than superset');
		return false;
	}

	if (Array.isArray(superset.items)) {
		if (!subset.hasOwnProperty('items')) {
			log('Subset is missing items');
			return false;
		}

		if (
			!Array.isArray(subset.items) ||
			superset.items.length !== subset.items.length
		) {
			// tslint:disable-next-line:no-unused-expression
			log('Tuple item count mismatch');
			return false;
		}
		for (let i = 0, len = superset.items.length; i < len; i++) {
			if (
				!satisfies(
					subset.items[i] as JSONSchema,
					superset.items[i] as JSONSchema,
					allowPartial,
					allowAdditionalProps
				)
			) {
				// tslint:disable-next-line:no-unused-expression
				log('Tuple items mismatch (see previous error)');
				return false;
			}
		}
	} else {
		if (
			!satisfies(
				subset.items as JSONSchema,
				superset.items as JSONSchema,
				allowPartial,
				allowAdditionalProps
			)
		) {
			// tslint:disable-next-line:no-unused-expression
			log('Array items mismatch (see previous error)');
			return false;
		}
	}

	if (superset.uniqueItems && !subset.uniqueItems) {
		// tslint:disable-next-line:no-unused-expression
		log('Subset does not require uniqueItems');
		return false;
	}

	return true;
}

function numRulesMatch(
	subset: JSONSchema,
	superset: JSONSchema,
	allowPartial: boolean
): boolean {
	if (superset.type !== 'integer' && superset.type !== 'number') {
		return true; // nop
	}

	if (superset.hasOwnProperty('maximum')) {
		if (
			!subset.hasOwnProperty('maximum') &&
			!subset.hasOwnProperty('exclusiveMaximum')
		) {
			// tslint:disable-next-line:no-unused-expression
			log('Subset has no maximum property');
			return false;
		}

		if (
			subset.hasOwnProperty('maximum') &&
			(subset.maximum as number) > (superset.maximum as number)
		) {
			// tslint:disable-next-line:no-unused-expression
			log('Subset permits greater maximum');
			return false;
		}
		if (
			subset.hasOwnProperty('exclusiveMaximum') &&
			(subset.exclusiveMaximum as number) > (superset.maximum as number)
		) {
			// tslint:disable-next-line:no-unused-expression
			log('Subset permits greater maximum (exclusive)');
			return false;
		}
	}

	if (superset.hasOwnProperty('exclusiveMaximum')) {
		if (
			!subset.hasOwnProperty('maximum') &&
			!subset.hasOwnProperty('exclusiveMaximum')
		) {
			// tslint:disable-next-line:no-unused-expression
			log('Subset has no maximum property');
			return false;
		}

		if (
			subset.hasOwnProperty('maximum') &&
			subset.maximum >= superset.exclusiveMaximum
		) {
			// tslint:disable-next-line:no-unused-expression
			log('Subset permits greater maximum');
			return false;
		}
		if (
			subset.hasOwnProperty('exclusiveMaximum') &&
			(subset.exclusiveMaximum as number) >
				(superset.exclusiveMaximum as number)
		) {
			// tslint:disable-next-line:no-unused-expression
			log('Subset permits greater exclusiveMaximum');
			return false;
		}
	}

	if (superset.hasOwnProperty('minimum')) {
		if (
			!subset.hasOwnProperty('minimum') &&
			!subset.hasOwnProperty('exclusiveMinimum')
		) {
			// tslint:disable-next-line:no-unused-expression
			log('Subset has no minimum property');
			return false;
		}

		if (subset.hasOwnProperty('minimum') && subset.minimum < superset.minimum) {
			// tslint:disable-next-line:no-unused-expression
			log('Subset permits greater minimum');
			return false;
		}
		if (
			subset.hasOwnProperty('exclusiveMinimum') &&
			subset.exclusiveMinimum < superset.minimum
		) {
			// tslint:disable-next-line:no-unused-expression
			log('Subset permits greater minimum');
			return false;
		}
	}

	if (superset.hasOwnProperty('exclusiveMinimum')) {
		if (
			!subset.hasOwnProperty('minimum') &&
			!subset.hasOwnProperty('exclusiveMinimum')
		) {
			// tslint:disable-next-line:no-unused-expression
			log('Subset has no minimum property');
			return false;
		}

		if (
			subset.hasOwnProperty('minimum') &&
			(subset.minimum as number) <= (superset.exclusiveMinimum as number)
		) {
			// tslint:disable-next-line:no-unused-expression
			log('Subset permits smaller minimum');
			return false;
		}
		if (
			subset.hasOwnProperty('exclusiveMinimum') &&
			(subset.exclusiveMinimum as number) <
				(superset.exclusiveMinimum as number)
		) {
			// tslint:disable-next-line:no-unused-expression
			log('Subset permits greater exclusiveMinimum');
			return false;
		}
	}

	if (superset.multipleOf) {
		if (!subset.multipleOf) {
			// tslint:disable-next-line:no-unused-expression
			log('Subset lacks multipleOf');
			return false;
		}
		if (subset.multipleOf % superset.multipleOf !== 0) {
			// tslint:disable-next-line:no-unused-expression

			log(
				'Subset multipleOf is not an integer multiple of superset multipleOf'
			);
			return false;
		}
	}

	return true;
}

function constMatch(
	subset: JSONSchema,
	superset: JSONSchema,
	allowPartial: boolean
): boolean {
	if (superset.const && superset.const !== subset.const) {
		// tslint:disable-next-line:no-unused-expression

		log(`Subset const mismatch (${superset.const} !== ${subset.const})`);
		return false;
	}

	return true;
}

function allOfMatches(
	subset: JSONSchema,
	superset: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean
): boolean {
	if (
		subset.allOf &&
		!all(subset.allOf as JSONSchema[], (e) =>
			satisfies(e, superset, allowPartial, allowAdditionalProps)
		)
	) {
		return false;
	}

	if (
		superset.allOf &&
		!all(superset.allOf as JSONSchema[], (e) =>
			satisfies(subset, e, allowPartial, allowAdditionalProps)
		)
	) {
		return false;
	}

	return true;
}

function anyOfMatches(
	subset: JSONSchema,
	superset: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean
): boolean {
	if (
		subset.anyOf &&
		!all(subset.anyOf as JSONSchema[], (e) =>
			satisfies(e, superset, allowPartial, allowAdditionalProps)
		)
	) {
		// tslint:disable-next-line:no-unused-expression

		log('Some subset.anyOf elements do not satisfy superset');
		return false;
	}

	if (
		superset.anyOf &&
		!some(superset.anyOf as JSONSchema[], (e) =>
			satisfies(subset, e, allowPartial, allowAdditionalProps)
		)
	) {
		// tslint:disable-next-line:no-unused-expression
		log('Subset does not satisfy any of superset.anyOf');
		return false;
	}

	return true;
}

function oneOfMatches(
	subset: JSONSchema,
	superset: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean
): boolean {
	if (
		subset.oneOf &&
		!all(subset.oneOf as JSONSchema[], (e) =>
			satisfies(e, superset, allowPartial, allowAdditionalProps)
		)
	) {
		// tslint:disable-next-line:no-unused-expression

		log('Some subset.oneOf elements do not satisfy superset');
		return false;
	}

	if (
		superset.oneOf &&
		!one(superset.oneOf as JSONSchema[], (e) =>
			satisfies(subset, e, allowPartial, allowAdditionalProps)
		)
	) {
		// tslint:disable-next-line:no-unused-expression

		log('Subset does not satisfy exactly one of superset.oneOf');
		return false;
	}

	return true;
}

function notMatches(
	subset: JSONSchema,
	superset: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean
): boolean {
	if (
		subset.not &&
		satisfies(
			subset.not as JSONSchema,
			superset,
			allowPartial,
			allowAdditionalProps
		)
	) {
		// tslint:disable-next-line:no-unused-expression
		log('Subset.not should not satisfy superset');
		return false;
	}

	if (
		superset.not &&
		satisfies(
			subset,
			superset.not as JSONSchema,
			allowPartial,
			allowAdditionalProps
		)
	) {
		// tslint:disable-next-line:no-unused-expression
		log('Subset should not satisfy superset.not');
		return false;
	}

	return true;
}

function satisfies(
	subset: JSONSchema,
	superset: JSONSchema,
	allowPartial: boolean,
	allowAdditionalProps: boolean
): boolean {
	if (isEqual(subset, superset)) {
		return true;
	} else if (isEqual(superset, {})) {
		return true;
	}

	const draftRegex = /draft-0[1234]\/schema/;
	if (
		draftRegex.test(subset.$schema || '') ||
		draftRegex.test(superset.$schema || '')
	) {
		throw new Error('Requires JSON schema draft version 5+');
	}

	if (superset.anyOf || subset.anyOf) {
		return anyOfMatches(subset, superset, allowPartial, allowAdditionalProps);
	} else if (superset.allOf || subset.allOf) {
		return allOfMatches(subset, superset, allowPartial, allowAdditionalProps);
	} else if (superset.oneOf || subset.oneOf) {
		return oneOfMatches(subset, superset, allowPartial, allowAdditionalProps);
	}

	const validators = [
		arrayRulesMatch,
		constMatch,
		numRulesMatch,
		stringRulesMatch,
		subsetHasNoExtraneousProps,
		subsetHasRequiredProps,
		subsetPropertiesMatch,
		typeMatches,

		anyOfMatches,
		oneOfMatches,
		notMatches,
	];
	if (!allowAdditionalProps) {
		validators.push(subsetHasNoExtraneousProps);
	}

	for (const validator of validators) {
		if (!validator(subset, superset, allowPartial, allowAdditionalProps)) {
			// tslint:disable-next-line:no-unused-expression
			log('Validator failed:', validator.name);
			return false;
		}
	}

	return true;
}

export { JSONSchema };
export default async function subsetSatisfies(
	subset: JSONSchema,
	superset: JSONSchema,
	opts: boolean | { allowPartial?: boolean; allowAdditionalProps?: boolean } = false
): Promise<boolean> {
	let allowPartial = false;
	let allowAdditionalProps = false;
	if (typeof opts === 'boolean') {
		allowPartial = opts;
	} else if (typeof opts === 'object' && opts !== null) {
		allowPartial = opts.allowPartial;
		allowAdditionalProps = opts.allowAdditionalProps;
	}

	const [sub, sup] = await Promise.all([
		RefParser.bundle(
			subset.$schema ? subset : { ...subset, $schema: defaultSchema }
		),
		RefParser.bundle(
			superset.$schema ? superset : { ...superset, $schema: defaultSchema }
		),
	]);
	return satisfies(
		mergeAllOf(sub),
		mergeAllOf(sup),
		allowPartial,
		allowAdditionalProps
	);
}
