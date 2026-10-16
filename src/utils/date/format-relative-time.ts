const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
];

/**
 * "3 days ago", "yesterday", "just now" — how long before `now` the ISO timestamp `iso` was. A time
 * in the future (another machine's clock running ahead) reads "just now" rather than "in 2
 * minutes". `null` for anything that isn't a date.
 */
export const formatRelativeTime = (iso: string, now: Date = new Date(), locale?: string): string | null => {
  const then = new Date(iso);

  if (Number.isNaN(then.getTime())) {
    return null;
  }

  const seconds = Math.max(0, (now.getTime() - then.getTime()) / 1000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  for (const [unit, size] of UNITS) {
    if (seconds >= size) {
      return format.format(-Math.floor(seconds / size), unit);
    }
  }

  return 'just now';
};
