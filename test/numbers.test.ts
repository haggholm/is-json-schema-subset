import './common';

test('numbers accept integers', () =>
  expect({
    title: 'child',
    type: 'integer',
    // @ts-ignore TS2339
  }).toSatisfy({
    title: 'parent',
    type: 'number',
  }));

test('integers do not accept numbers', () =>
  expect({
    title: 'child',
    type: 'number',
    // @ts-ignore TS2339
  }).toViolate({
    title: 'parent',
    type: 'integer',
  }));

test('pass maximum check', () =>
  expect({
    title: 'child',
    type: 'number',
    maximum: 10,
    // @ts-ignore TS2339
  }).toSatisfy({
    title: 'parent',
    type: 'number',
    maximum: 10,
  }));

test('fail maximum check', () =>
  expect({
    title: 'child',
    type: 'number',
    maximum: 10.1,
    // @ts-ignore TS2339
  }).toViolate({
    title: 'parent',
    type: 'number',
    maximum: 10,
  }));

test('pass maximum check (both exclusive)', () =>
  expect({
    title: 'child',
    type: 'number',
    exclusiveMaximum: 10,
    // @ts-ignore TS2339
  }).toSatisfy({
    title: 'parent',
    type: 'number',
    exclusiveMaximum: 10,
  }));

test('pass maximum check (child exclusive)', () =>
  expect({
    title: 'child',
    type: 'number',
    exclusiveMaximum: 10,
    // @ts-ignore TS2339
  }).toSatisfy({
    title: 'parent',
    type: 'number',
    maximum: 10,
  }));

test('fail maximum check (parent exclusive)', () =>
  expect({
    title: 'child',
    type: 'number',
    maximum: 10,
    // @ts-ignore TS2339
  }).toViolate({
    title: 'parent',
    type: 'number',
    exclusiveMaximum: 10,
  }));

test('fail omitted maximum check (parent inclusive)', () =>
  expect({
    title: 'child',
    type: 'number',
    // @ts-ignore TS2339
  }).toViolate({
    title: 'parent',
    type: 'number',
    maximum: 10,
  }));

test('fail omitted maximum check (parent exclusive)', () =>
  expect({
    title: 'child',
    type: 'number',
    // @ts-ignore TS2339
  }).toViolate({
    title: 'parent',
    type: 'number',
    exclusiveMaximum: 10,
  }));

test('pass minimum check', () =>
  expect({
    title: 'child',
    type: 'number',
    minimum: 10,
    // @ts-ignore TS2339
  }).toSatisfy({
    title: 'parent',
    type: 'number',
    minimum: 10,
  }));

test('fail minimum check', () =>
  expect({
    title: 'child',
    type: 'number',
    minimum: 10,
    // @ts-ignore TS2339
  }).toViolate({
    title: 'parent',
    type: 'number',
    minimum: 10.1,
  }));

test('fail omitted minimum check (parent inclusive)', () =>
  expect({
    title: 'child',
    type: 'number',
    // @ts-ignore TS2339
  }).toViolate({
    title: 'parent',
    type: 'number',
    minimum: 10,
  }));

test('fail omitted minimum check (parent exclusive)', () =>
  expect({
    title: 'child',
    type: 'number',
    // @ts-ignore TS2339
  }).toViolate({
    title: 'parent',
    type: 'number',
    exclusiveMinimum: 10,
  }));

test('pass minimum check (both exclusive)', () =>
  expect({
    title: 'child',
    type: 'number',
    exclusiveMinimum: 10,
    // @ts-ignore TS2339
  }).toSatisfy({
    title: 'parent',
    type: 'number',
    exclusiveMinimum: 10,
  }));

test('pass minimum check (child exclusive)', () =>
  expect({
    title: 'child',
    type: 'number',
    exclusiveMinimum: 10,
    // @ts-ignore TS2339
  }).toSatisfy({
    title: 'parent',
    type: 'number',
    minimum: 10,
  }));

test('fail minimum check (parent exclusive)', () =>
  expect({
    title: 'child',
    type: 'number',
    minimum: 10,
    // @ts-ignore TS2339
  }).toViolate({
    title: 'parent',
    type: 'number',
    exclusiveMinimum: 10,
  }));

test('pass multipleOf', () =>
  expect({
    title: 'child',
    type: 'number',
    multipleOf: 10,
    // @ts-ignore TS2339
  }).toSatisfy({
    title: 'parent',
    type: 'number',
    multipleOf: 5,
  }));

test('fail multipleOf', () =>
  expect({
    title: 'child',
    type: 'number',
    multipleOf: 5,
    // @ts-ignore TS2339
  }).toViolate({
    title: 'parent',
    type: 'number',
    multipleOf: 10,
  }));
