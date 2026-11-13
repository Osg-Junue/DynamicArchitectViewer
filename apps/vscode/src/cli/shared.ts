import { readFileSync } from 'node:fs';

export const EXIT_OK = 0;
/** Something was reported: a diagnostic, or a file that is missing or out of date. */
export const EXIT_FAILED = 1;
/** The command was not understood, or a file could not be read. */
export const EXIT_USAGE = 2;

/** The command line asks for something that cannot be done; the message says what. */
export class UsageError extends Error {}

/** Reads a `.dav` file as the editor does: VS Code ignores a byte order mark, and some shells write one. */
export function readDav(file: string): string {
  return readFileSync(file, 'utf8').replace(/^﻿/, '');
}

/** The value of an option that takes one of a few words, or `fallback` when it is not given. */
export function oneOf<T extends string>(
  option: string,
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (value === undefined) return fallback;
  const found = allowed.find((word) => word === value);
  if (found === undefined) {
    throw new UsageError(`--${option} takes ${allowed.join(' or ')}, not "${value}"`);
  }
  return found;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
