export function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit, search: typeof query.search === 'string' ? query.search.trim() : '' };
}
export function pageResponse(items, total, { page, limit }) { return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }; }
export function searchFilter(search, fields) {
  if (!search) return {};
  return { $or: fields.map((f) => ({ [f]: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } })) };
}
