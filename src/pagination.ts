import { Type } from '@sinclair/typebox';

export const PageQuery = {
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
  offset: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
};

export const page = (q: { limit?: number; offset?: number }) => [q.limit ?? 50, q.offset ?? 0];
