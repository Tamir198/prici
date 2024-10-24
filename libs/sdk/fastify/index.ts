import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { FieldStateResult } from '@prici/shared-remult';
import PriciSdk from '../index';

export interface FastifyGuardOptions {
  sdk: PriciSdk;
  fieldId?: string;
  errorMessage?: string;
  incrementAmount?: number;
  getAccountId?: (req?: FastifyRequest) => string | Promise<string>;
  getFieldId?: (req?: FastifyRequest) => string | Promise<string>;
  getError?: (
    req?: FastifyRequest,
    fieldStateResult?: FieldStateResult
  ) => string | Promise<string>;
  getIncrementAmount?: (req?: FastifyRequest) => number;
}

export function fastifyGuard(
  fastify: FastifyInstance,
  opts: FastifyGuardOptions,
  done: () => void
) {
  const options = {
    getAccountId: async (req: FastifyRequest) =>
      req.headers['account-id'] || req.user?.account || req.user?.tenant,
    getFieldId: async (req: FastifyRequest) =>
      opts.fieldId || req.query['fieldId'],
    getError: async (req?: FastifyRequest) =>
      opts.errorMessage || opts.sdk.defaultErrorMessage,
    getIncrementAmount: () => opts.incrementAmount,
    ...opts,
  };

  fastify.addHook(
    'preHandler',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const [accountId, fieldId] = await Promise.all([
        options.getAccountId(req),
        options.getFieldId(req),
      ]);

      if (!(accountId && fieldId)) {
        // Proceed to the next handler if no accountId or fieldId is found
        return;
      }

      const result = await options.sdk.getFieldState(accountId, fieldId);

      if (!result.isAllowed) {
        const errorMessage = await options.getError(req, result);
        reply.status(402).send({ message: errorMessage });
        return;
      }

      reply.raw.once('finish', () => {
        if (reply.raw.statusCode.toString().startsWith('2')) {
          options.sdk
            .incrementField(
              accountId,
              fieldId,
              options.getIncrementAmount(req) || undefined
            )
            .catch();
        }
      });
    }
  );

  done();
}
