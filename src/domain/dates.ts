import { format, isValid, parse } from "date-fns";
import type { IsoDate } from "./types";

const ISO = "yyyy-MM-dd";

/** Parses a `yyyy-MM-dd` string as local midnight. Throws on anything else. */
export function parseIsoDate(value: IsoDate): Date {
  const date = parse(value, ISO, new Date());
  if (!isValid(date) || format(date, ISO) !== value) {
    throw new Error(`"${value}" is not a valid date (expected yyyy-MM-dd)`);
  }
  return date;
}

export function toIsoDate(date: Date): IsoDate {
  return format(date, ISO);
}
