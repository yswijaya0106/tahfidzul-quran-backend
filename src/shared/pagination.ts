import { AppError } from "../domain/errors";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface ListResult<T> {
  data: T[];
  meta: PageMeta;
}

export function parsePageRequest(query: {
  page?: string | number;
  pageSize?: string | number;
}): PageRequest {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? DEFAULT_PAGE_SIZE);

  if (!Number.isInteger(page) || page < 1) {
    throw AppError.validation("page must be a positive integer.", { page: "Invalid page." });
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw AppError.validation(`pageSize must be between 1 and ${MAX_PAGE_SIZE}.`, {
      pageSize: "Invalid pageSize.",
    });
  }

  return { page, pageSize };
}

export function offsetFor(pageRequest: PageRequest): number {
  return (pageRequest.page - 1) * pageRequest.pageSize;
}
