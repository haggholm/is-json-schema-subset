/* tslint:disable:no-console */

import './common';

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
