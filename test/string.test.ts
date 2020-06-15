/* tslint:disable:no-console */

import './common';

test(`string format compatibility`, () => {
  expect({
    type: 'string',
    format: 'uri',
    // @ts-ignore
  }).toSatisfy({
    type: 'string',
    format: 'uri-reference',
  });
  expect({
    type: 'string',
    format: 'uri-reference',
    // @ts-ignore
  }).toViolate({
    type: 'string',
    format: 'uri',
  });
});

test(`string format/enum compatibility`, () => {
  expect({
    type: 'string',
    enum: ['https://www.google.com', 'https://owl.co'],
    // @ts-ignore
  }).toSatisfy({
    type: 'string',
    format: 'uri',
  });
  expect({
    type: 'string',
    enum: ['vainglory'],
    // @ts-ignore
  }).toViolate({
    type: 'string',
    format: 'uri',
  });
});
