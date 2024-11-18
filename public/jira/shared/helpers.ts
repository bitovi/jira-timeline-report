import { StartData, DueData } from "../../shared/issue-data/date-data";

export const sortByIssueDate = (
  selector: (date: Partial<StartData & DueData>) => Date | undefined,
  direction: "asc" | "desc" = "asc"
) => {
  const directionFn =
    direction === "asc"
      ? (d1: Date, d2: Date) => d1.getTime() - d2.getTime()
      : (d1: Date, d2: Date) => d2.getTime() - d1.getTime();

  return (
    date1: Partial<StartData & DueData>,
    date2: Partial<StartData & DueData>
  ): number => {
    const d1 = selector(date1) ?? new Date(0);
    const d2 = selector(date2) ?? new Date(0);
    return directionFn(d1, d2);
  };
};

export const selectStart = (data: Partial<StartData>) => data?.start;
export const selectDue = (date: Partial<DueData>) => date?.due;

export const sortByStart = sortByIssueDate(selectStart);
export const descSortByDue = sortByIssueDate(selectDue, "desc");

// couldn't get Object.groupBy to work correctly in all cases with `lib: ["ESNext"]` in tsconfig
export function groupBy<T>(arr: T[], fn: (item: T) => any) {
  return arr.reduce<Record<string, T[]>>((prev, curr) => {
      const groupKey = fn(curr);
      const group = prev[groupKey] || [];
      group.push(curr);
      return { ...prev, [groupKey]: group };
  }, {});
}
