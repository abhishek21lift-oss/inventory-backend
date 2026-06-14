export function getPagination(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 50), 500)
  const offset = (page - 1) * limit
  return { page, limit, offset }
}

export function paginatedResponse(data, total, page, limit) {
  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}
