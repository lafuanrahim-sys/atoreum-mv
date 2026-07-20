import { type ClassValue, clsx } from "clsx";

/** Merge conditional class names. Kept as a single tiny helper
 *  rather than pulling in tailwind-merge — we don't have conflicting
 *  utility collisions yet, and the extra dependency isn't earned. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
