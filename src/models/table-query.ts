export const tablePageSize = 50;
export interface TableQuery {
  search: string;
  sort: string;
  descending: boolean;
  page: number;
}
