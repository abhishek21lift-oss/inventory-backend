import { z } from 'zod'

export function validate(schema) {
  return (req, res, next) => {
    try {
      req.validated = schema.parse(req.body)
      next()
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })) })
      }
      next(err)
    }
  }
}
