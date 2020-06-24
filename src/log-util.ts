import mkDebug = require('debug');
import { Pointer } from 'rfc6902/pointer';
import { Paths } from './types';

const debug = mkDebug('is-json-schema-subset');

function toString(s: string | number) {
  return s.toString();
}

function formatPath(path: (string | number)[]) {
  return path.length
    ? new Pointer(['', ...path.map(toString)]).toString()
    : '/';
}

export function log(paths: Paths, ...args: any[]): void {
  const indent = 2 * Math.max(paths.input.length, paths.target.length);
  debug(
    { from: formatPath(paths.input), to: formatPath(paths.target) },
    ...args
  );
}
