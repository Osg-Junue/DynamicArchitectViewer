import { existsSync, globSync, readFileSync } from 'node:fs';

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

/**
 * The files the arguments name. PowerShell and cmd.exe hand `docs/*.dav` over as it is, where
 * a POSIX shell lists the files, so a pattern that is not a file itself is expanded here. One
 * that matches nothing is left as it is, and is then reported as a file that cannot be read.
 */
export function expandFiles(args: readonly string[]): string[] {
  return args.flatMap((arg) => {
    if (!/[*?]/.test(arg) || existsSync(arg)) return [arg];
    const found = globSync(arg).sort();
    return found.length > 0 ? found : [arg];
  });
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
