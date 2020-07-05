import './common';
import inputSatisfies from '../src/is-json-schema-subset';

describe('Arrays', () => {
  it('should reject old schema specifications', async () => {
    for (const i of [1, 2, 3, 4]) {
      await expect(
        inputSatisfies(
          {
            $schema: `http://json-schema.org/draft-0${i}/schema#`,
            type: 'object',
          },
          { type: 'object' }
        )
      ).rejects.toThrow(/Requires JSON schema draft version/);
      await expect(
        inputSatisfies(
          { type: 'object' },
          {
            $schema: `http://json-schema.org/draft-0${i}/schema#`,
            type: 'object',
          }
        )
      ).rejects.toThrow(/Requires JSON schema draft version 5+/);
    }
  });
});
