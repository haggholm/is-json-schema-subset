import AJV = require('ajv');
import jsf = require('json-schema-faker');
import deepFreeze = require('deep-freeze');
import { JSONSchema7 } from 'json-schema';

import satisfies from '../src/is-json-schema-subset';

const RANDOM_SAMPLES = 25;

const ajv = new AJV({ allErrors: true });
jsf.option('optionalsProbability', 0.5);

export { JSONSchema7, jsf, ajv, RANDOM_SAMPLES, satisfies };

expect.extend({
  toSatisfy: async (subset: JSONSchema7, superset: JSONSchema7) => {
    // Ensure we do not accidentally modify input during dereferencing
    deepFreeze(subset);
    deepFreeze(superset);

    const [subIsConsistent, supIsConsistent, pass] = await Promise.all([
      satisfies(subset, subset),
      satisfies(superset, superset),
      satisfies(subset, superset),
    ]);
    if (!subIsConsistent) {
      console.error(
        'Subset does not match itself!',
        require('util').inspect(subset)
      );
      throw new Error('Subset does not match itself!');
    }
    if (!supIsConsistent) {
      console.error(
        'Superset does not match itself!',
        require('util').inspect(superset)
      );
      throw new Error('Superset does not match itself!');
    }

    if (pass) {
      const superValidator = ajv.compile(
        superset.$schema
          ? superset
          : { ...superset, $schema: 'http://json-schema.org/draft-07/schema#' }
      );
      const t0 = Date.now();
      for (let i = 0; i < RANDOM_SAMPLES && Date.now() - t0 < 1000; i++) {
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
                subset,
                null,
                2
              )} was found to satisfy ${JSON.stringify(
                superset,
                null,
                2
              )}, but failed on random data: ${JSON.stringify(instance)}`,
          };
        }
      }
    }

    return {
      pass,
      message: () =>
        `Expected ${JSON.stringify(
          subset,
          null,
          2
        )} to satisfy ${JSON.stringify(superset, null, 2)}`,
    };
  },
  toViolate: async (subset: JSONSchema7, superset: JSONSchema7) => {
    // Ensure we do not accidentally modify input during dereferencing
    deepFreeze(subset);
    deepFreeze(superset);

    const [subIsConsistent, supIsConsistent, pass] = await Promise.all([
      satisfies(subset, subset),
      satisfies(superset, superset),
      satisfies(subset, superset),
    ]);
    if (!subIsConsistent) {
      throw new Error('Subset does not match itself!');
    }
    if (!supIsConsistent) {
      throw new Error('Superset does not match itself!');
    }

    return {
      pass: !pass,
      message: () =>
        `Expected ${JSON.stringify(
          subset,
          null,
          2
        )} not to satisfy ${JSON.stringify(superset, null, 2)}`,
    };
  },
});
