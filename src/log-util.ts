import mkDebug = require('debug');
import { enabled } from 'debug';
import { Pointer } from 'rfc6902/pointer';
import type { Paths } from './types';

const namespace = 'is-json-schema-subset';
const debug = mkDebug(namespace);

function toString(s: string | number) {
  return s.toString();
}

function formatPath(path: (string | number)[]) {
  return path.length
    ? new Pointer(['', ...path.map(toString)]).toString()
    : '/';
}

/** @internal */
export function log(paths: Paths, ...args: any[]): void {
  const indent = 2 * Math.max(paths.input.length, paths.target.length);
  debug(
    { from: formatPath(paths.input), to: formatPath(paths.target) },
    ...args
  );
}

/** @internal */
export const isLogEnabled = () => enabled(namespace);
