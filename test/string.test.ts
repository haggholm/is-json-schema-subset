import './common';

test(`string format compatibility`, async () => {
  await expect({
    type: 'string',
    format: 'uri',
    // @ts-ignore TS2339
  }).toSatisfy({
    type: 'string',
    format: 'uri-reference',
  });
  await expect({
    type: 'string',
    format: 'uri-reference',
    // @ts-ignore TS2339
  }).toViolate({
    type: 'string',
    format: 'uri',
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
