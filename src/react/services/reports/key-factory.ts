export const allReportsKey = 'saved-reports';

export const reportKeys = {
  allReports: [allReportsKey],
  /** The current user's starred report ids. Per user by construction: the store is per user. */
  starred: ['starred-reports'],
};
