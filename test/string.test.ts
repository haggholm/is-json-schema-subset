import './common';
import { subFormats, allFormats } from '../src/util';

describe(`string format compatibility`, () => {
  it('should accept any format as compatible with itself', async () => {
    for (const format of allFormats) {
      await expect({
        type: 'string',
        format,
        // @ts-ignore TS2339
      }).toSatisfy({
        type: 'string',
        format,
      });
    }
  });

  for (const format of Object.keys(subFormats)) {
    for (const subFormat of subFormats[format]) {
      it(`should accept ${subFormat} as satisfying ${format}`, () =>
        // @ts-ignore TS2339
        expect({ type: 'string', format: subFormat }).toSatisfy({
          type: 'string',
          format,
        }));
    }
  }

  it('should reject other unequal formats', async () => {
    for (const target of allFormats) {
      for (const input of allFormats) {
        if (
          target === input ||
          (subFormats[target] && subFormats[target].indexOf(input) !== -1)
        ) {
          continue;
        }
        // @ts-ignore TS2339
        await expect({ type: 'string', format: input }).toViolate({
          type: 'string',
          format: target,
        });
      }
    }
  });
});

test(`string format/enum compatibility`, async () => {
  await expect({
    type: 'string',
    enum: ['https://www.google.com', 'https://owl.co'],
    // @ts-ignore TS2339
  }).toSatisfy({
    type: 'string',
    format: 'uri',
  });
  await expect({
    type: 'string',
    enum: ['vainglory'],
    // @ts-ignore TS2339
  }).toViolate({
    type: 'string',
    format: 'uri',
  });
});
