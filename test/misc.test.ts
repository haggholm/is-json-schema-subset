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

test('accept arbitrary schema when unspecified', () =>
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
	}));

test('accept oneOf', () =>
	expect({
		title: 'child',
		type: 'object',
		properties: {
			foo: { type: 'boolean' },
		},
		// @ts-ignore
	}).toSatisfy({
		title: 'parent',
		type: 'object',
		oneOf: [
			{
				type: 'object',
				properties: {
					foo: { type: 'boolean' },
				},
			},
			{
				type: 'object',
				properties: {
					foo: { type: 'string' },
				},
			},
		],
	}));

test('reject oneOf: no match', () =>
	expect({
		title: 'child',
		type: 'object',
		properties: {
			foo: { type: 'number' },
		},
		// @ts-ignore
	}).toViolate({
		title: 'parent',
		type: 'object',
		oneOf: [
			{
				type: 'object',
				properties: {
					foo: { type: 'boolean' },
				},
			},
			{
				type: 'object',
				properties: {
					foo: { type: 'string' },
				},
			},
		],
	}));

test('reject oneOf: multiple matches', () =>
	expect({
		title: 'child',
		type: 'object',
		// @ts-ignore
	}).toViolate({
		title: 'parent',
		type: 'object',
		oneOf: [
			{
				type: 'object',
				properties: {
					foo: { type: 'boolean' },
				},
			},
			{
				type: 'object',
				properties: {
					foo: { type: 'string' },
				},
			},
		],
	}));

test('accept anyOf', () =>
	expect({
		title: 'child',
		type: 'object',
		properties: {
			foo: { type: 'boolean' },
		},
		// @ts-ignore
	}).toSatisfy({
		title: 'parent',
		type: 'object',
		anyOf: [
			{
				type: 'object',
				properties: {
					foo: { type: 'boolean' },
				},
			},
			{
				type: 'object',
				properties: {
					foo: { type: 'string' },
				},
			},
		],
	}));

test('reject anyOf: no match', () =>
	expect({
		title: 'child',
		type: 'object',
		properties: {
			foo: { type: 'number' },
		},
		// @ts-ignore
	}).toViolate({
		title: 'parent',
		type: 'object',
		anyOf: [
			{
				type: 'object',
				properties: {
					foo: { type: 'boolean' },
				},
			},
			{
				type: 'object',
				properties: {
					foo: { type: 'string' },
				},
			},
		],
	}));

test('accept anyOf: multiple matches', () =>
	expect({
		title: 'child',
		type: 'object',
		// @ts-ignore
	}).toSatisfy({
		title: 'parent',
		type: 'object',
		anyOf: [
			{
				type: 'object',
				properties: {
					foo: { type: 'boolean' },
				},
			},
			{
				type: 'object',
				properties: {
					foo: { type: 'string' },
				},
			},
		],
	}));
