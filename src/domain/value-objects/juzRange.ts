import { AppError } from "../errors";

export const MIN_JUZ = 1;
export const MAX_JUZ = 30;

/** Validates an Ikhtibar's Juz range: both bounds within 1-30 and juzTo >= juzFrom. */
export function validateJuzRange(juzFrom: number, juzTo: number): void {
  const fields: Record<string, string> = {};

  if (!Number.isInteger(juzFrom) || juzFrom < MIN_JUZ || juzFrom > MAX_JUZ) {
    fields.juzFrom = `juzFrom must be an integer between ${MIN_JUZ} and ${MAX_JUZ}.`;
  }
  if (!Number.isInteger(juzTo) || juzTo < MIN_JUZ || juzTo > MAX_JUZ) {
    fields.juzTo = `juzTo must be an integer between ${MIN_JUZ} and ${MAX_JUZ}.`;
  }

  if (Object.keys(fields).length > 0) {
    throw AppError.unprocessable("The Juz range is invalid.", fields);
  }

  if (juzTo < juzFrom) {
    throw AppError.unprocessable("juzTo must not precede juzFrom.", {
      juzTo: "Must be greater than or equal to juzFrom.",
    });
  }
}

export const MIN_SCORE = 0;
export const MAX_SCORE = 100;

/** Validates the numeric exam score (0-100). */
export function validateScore(score: number): void {
  if (typeof score !== "number" || Number.isNaN(score) || score < MIN_SCORE || score > MAX_SCORE) {
    throw AppError.unprocessable(`score must be a number between ${MIN_SCORE} and ${MAX_SCORE}.`, {
      score: "Invalid score.",
    });
  }
}
