/* tslint:disable:no-console */

import isEqual = require('fast-deep-equal');
import RefParser = require('json-schema-ref-parser');
import { JSONSchema } from 'json-schema-ref-parser';

function typeMatches(subset: JSONSchema, superset: JSONSchema): boolean {
	const match =
		subset.type === superset.type ||
		(superset.type === 'number' && subset.type === 'integer');

	if (!match) {
		console.log('Type mismatch');
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
			console.log('Subset does not require necessary property', prop);
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
		const superProps = new Set(Object.keys(superset));
		for (const prop of Object.keys(subset)) {
			if (!superProps.has(prop)) {
				console.log('Subset has extraneous property', prop);
				return false;
			}
		}
	}
	return true;
}

function subsetPropertiesMatch(
	subset: JSONSchema,
	superset: JSONSchema
): boolean {
	const subProps =
		(subset.properties as {
			[k: string]: JSONSchema;
		}) || {};
	const superProps =
		(superset.properties as {
			[k: string]: JSONSchema;
		}) || {};

	for (const prop of Object.keys(superProps || [])) {
		if (!subProps || !subProps.hasOwnProperty(prop)) {
			continue;
		}

		if (!satisfies(subProps[prop], superProps[prop])) {
			console.log('Property', prop, 'does not match');
			return false;
		}
	}
}

function stringRulesMatch(subset: JSONSchema, superset: JSONSchema): boolean {
	if (superset.type !== 'string') {
		return true; // nop
	}

	if (superset.format && superset.format !== subset.format) {
		console.log('String format mismatch');
		return false;
	}

	if (superset.format && superset.format !== subset.format) {
		console.log('String format mismatch');
		return false;
	}

	if (superset.pattern && superset.pattern !== subset.pattern) {
		console.log('String pattern mismatch');
		return false;
	}

	if (
		superset.hasOwnProperty('minLength') &&
		(!subset.hasOwnProperty('minLength') ||
			subset.minLength < superset.minLength)
	) {
		console.log('Subset minLength is less than superset');
		return false;
	}
	if (
		superset.hasOwnProperty('maxLength') &&
		(!subset.hasOwnProperty('maxLength') ||
			subset.maxLength > superset.maxLength)
	) {
		console.log('Subset maxLength is less than superset');
		return false;
	}

	if (superset.hasOwnProperty('enum')) {
		if (!subset.hasOwnProperty('enum')) {
			console.log('Subset is missing enum');
			return false;
		}
		const enums = new Set(superset.enum);
		for (const e of subset.enum) {
			if (!enums.has(e)) {
				console.log('Subset is missing enum:', e);
				return false;
			}
		}
	}
}

function arrayRulesMatch(subset: JSONSchema, superset: JSONSchema): boolean {
	if (superset.type !== 'array') {
		return true; // nop
	}

	if (
		superset.hasOwnProperty('minItems') &&
		(!subset.hasOwnProperty('minItems') || subset.minItems < superset.minItems)
	) {
		console.log('Subset minItems is less than superset');
		return false;
	}
	if (
		superset.hasOwnProperty('maxItems') &&
		(!subset.hasOwnProperty('maxItems') || subset.maxItems > superset.maxItems)
	) {
		console.log('Subset maxItems is more than superset');
		return false;
	}

	if (!subset.hasOwnProperty('items')) {
		console.log('Subset is missing items');
		return false;
	}

	if (Array.isArray(superset.items)) {
		if (
			!Array.isArray(subset.items) ||
			superset.items.length !== subset.items.length
		) {
			console.log('Tuple item count mismatch');
			return false;
		}
		for (let i = 0, len = superset.items.length; i < len; i++) {
			if (
				!satisfies(
					subset.items[i] as JSONSchema,
					superset.items[i] as JSONSchema
				)
			) {
				console.log('Tuple items mismatch (see previous error)');
				return false;
			}
		}
	} else {
		if (!satisfies(subset.items as JSONSchema, superset.items as JSONSchema)) {
			console.log('Array items mismatch (see previous error)');
			return false;
		}
	}

	if (superset.uniqueItems && !subset.uniqueItems) {
		console.log('Subset does not require uniqueItems');
		return false;
	}

	return true;
}

function numRulesMatch(subset: JSONSchema, superset: JSONSchema): boolean {
	if (superset.type !== 'integer' && subset.type !== 'number') {
		return true; // nop
	}

	if (superset.hasOwnProperty('maximum')) {
		if (!subset.hasOwnProperty('maximum') || subset.type === 'integer') {
			console.log('Subset has no maximum property');
			return false;
		}

		if (superset.exclusiveMaximum) {
			if (
				!(
					subset.maximum < superset.maximum ||
					(subset.exclusiveMaximum && subset.maximum - 1 < superset.maximum)
				)
			) {
				console.log(
					'Subset number maximum is greater than superset exclusive maximum'
				);
				return false;
			}
		} else if (
			subset.hasOwnProperty('maximum') &&
			subset.maximum > superset.maximum
		) {
			console.log('Subset number maximum is greater than superset');
			return false;
		}
	}

	if (superset.hasOwnProperty('minimum')) {
		if (!subset.hasOwnProperty('minimum') || subset.type === 'integer') {
			console.log('Subset has no minimum property');
			return false;
		}

		if (superset.exclusiveMinimum) {
			if (
				!(
					subset.minimum < superset.minimum ||
					(subset.exclusiveMinimum && subset.minimum + 1 > superset.minimum)
				)
			) {
				console.log(
					'Subset number minimum is smaller than superset exclusive minimum'
				);
				return false;
			}
		} else if (
			subset.hasOwnProperty('minimum') &&
			subset.minimum < superset.minimum
		) {
			console.log('Subset number minimum is smaller than superset');
			return false;
		}
	}

	if (superset.multipleOf && superset.multipleOf !== subset.multipleOf) {
		console.log('Subset does not match superset number multiple');
		return false;
	}

	return true;
}

function constMatch(subset: JSONSchema, superset: JSONSchema): boolean {
	if (superset.const && superset.const !== subset.const) {
		console.log(
			`Subset const mismatch (${superset.const} !== ${subset.const})`
		);
		return false;
	}
}

function satisfies(subset: JSONSchema, superset: JSONSchema): boolean {
	if (isEqual(subset, superset)) {
		return true;
	}

	for (const validator of [
		arrayRulesMatch,
		constMatch,
		numRulesMatch,
		stringRulesMatch,
		subsetHasNoExtraneousProps,
		subsetHasRequiredProps,
		subsetPropertiesMatch,
		typeMatches,
	]) {
		if (!validator(subset, superset)) {
			return false;
		}
	}
}

module.exports = async (
	subset: JSONSchema,
	superset: JSONSchema
): Promise<boolean> => {
	const [sub, sup] = await Promise.all([
		RefParser.bundle(subset),
		RefParser.bundle(superset),
	]);
	return satisfies(sub, sup);
};
