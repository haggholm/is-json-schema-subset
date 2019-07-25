[![Build Status](https://travis-ci.com/haggholm/is-json-schema-subset.svg?branch=master)](https://travis-ci.com/haggholm/is-json-schema-subset)
[![Greenkeeper badge](https://badges.greenkeeper.io/greenkeeperio/badges.svg)](https://greenkeeper.io/)
[![Coverage Status](https://coveralls.io/repos/github/haggholm/is-json-schema-subset/badge.svg?branch=master)](https://coveralls.io/github/haggholm/is-json-schema-subset?branch=master)

# is-json-schema-subset

> Check if a JSON schema is a subset of another

Given a schema defining the _output_ of some process A, and
a second schema defining the _input_ of some process B, will the output from A
be _valid_ input for process B?

Uses [ajv](https://github.com/epoberezkin/ajv) and
[json-schema-merge-allof](https://github.com/mokkabonna/json-schema-merge-allof).

## Usage

```js
import isJsonSchemaSubset from 'is-json-schema-subset';

import inputSchema from './input-schema.json';
import outputSchema from './input-schema.json';

async function check() {
	if (await isJsonSchemaSubset(inputSchema, outputSchema)) {
		console.log('OK');
	} else {
		console.log('Fail');
	}
}
```

## API

```js
import isJsonSchemaSubset from 'is-json-schema-subset';
```

## isJsonSchemaSubset(subset: JSONSchema, superset: JSONSchema[, allowPartial: boolean = false])

Returns a promise resolving to `true` if `subset` is a compatible subset of `superset`,
else `false`.

If `allowPartial` is `false`, `subset` must provide _all_ required properties for `superset`.

## Install

```
$ yarn add is-json-schema-subset
```

## License

MIT
