import { relDay, splitName, type DateValue } from './formatting';
export type SortKey = 'name' | 'type' | 'size' | 'expires';
export type Sort = { key: SortKey; dir: 1 | -1 } | null;
export type SortableFile = {
  name: string;
  size: number;
  uploadedAt: DateValue;
  expiresAt: DateValue;
};
export const nextSort = (sort: Sort, key: SortKey): Sort => ({
  key,
  dir: sort?.key === key && sort.dir === 1 ? -1 : 1,
});
export function sortFiles<T extends SortableFile>(
  files: readonly T[],
  sort: Sort,
): T[] {
  return [...files].sort((a, b) => {
    const newest = +new Date(b.uploadedAt) - +new Date(a.uploadedAt);
    if (!sort) return newest;
    const cmp =
      sort.key === 'name'
        ? a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: 'base',
          })
        : sort.key === 'type'
          ? splitName(a.name)[1].localeCompare(splitName(b.name)[1])
          : sort.key === 'size'
            ? a.size - b.size
            : +new Date(a.expiresAt) - +new Date(b.expiresAt);
    return cmp * sort.dir || newest;
  });
}
export function groupFiles<T extends SortableFile>(
  files: readonly T[],
  sort: Sort,
  now: DateValue = Date.now(),
) {
  const groups = new Map<string, T[]>();
  for (const file of sortFiles(files, sort)) {
    const key = sort ? '' : relDay(file.uploadedAt, now);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(file);
  }
  return groups;
}
