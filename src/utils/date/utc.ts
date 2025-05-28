export function nowUTC() {
  let now = new Date();

  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  let day = now.getUTCDate();

  // Create a new Date object using UTC components
  return new Date(Date.UTC(year, month, day));
}
