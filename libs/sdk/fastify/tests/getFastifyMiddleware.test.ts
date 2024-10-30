import fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import { fastifyGuard, FastifyGuardOptions } from '../index';
import { FieldStateResult } from '@prici/shared-remult';
import PriciSdk from '../../index';
import test from 'node:test';
import assert from 'node:assert/strict';

test.describe('fastifyGuard middleware', () => {
  let app: FastifyInstance;
  let mockSdk: PriciSdk;
  let mockGetFieldState: () => Promise<FieldStateResult>;
  let mockIncrementField: () => Promise<void>;

  test.before(() => {
    // Create mock SDK functions
    mockGetFieldState = async () => ({ isAllowed: true });
    mockIncrementField = async () => {};

    // Mock SDK instance
    mockSdk = {
      getFieldState: mockGetFieldState,
      incrementField: mockIncrementField,
      defaultErrorMessage: 'Default error message',
    } as unknown as PriciSdk;

    app = fastify();

    // Register fastifyGuard with mock SDK and options
    const options: FastifyGuardOptions = {
      sdk: mockSdk,
      fieldId: 'testField',
      incrementAmount: 1,
      getAccountId: async (req) => req.headers['account-id'] as string,
    };

    app.register(fastifyGuard, options);
    app.get('/test', async (req: FastifyRequest, reply: FastifyReply) => {
      reply.send({ message: 'Access granted' });
    });
  });

  test.after(async () => {
    await app.close();
  });

  test.it(
    'should allow access and increment field when the user is allowed',
    async () => {
      // Mock behavior for allowed access
      mockSdk.getFieldState = async () => ({ isAllowed: true });
      mockSdk.incrementField = async () => {};

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'account-id': 'testAccount',
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { message: 'Access granted' });
    }
  );

  test.it(
    'should deny access with a 402 status code when the user is not allowed',
    async () => {
      // Mock behavior for denied access
      mockSdk.getFieldState = async () => ({ isAllowed: false });

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: {
          'account-id': 'testAccount',
        },
      });

      assert.equal(response.statusCode, 402);
      assert.deepEqual(response.json(), { message: 'Default error message' });
    }
  );

  test.it(
    'should proceed without field check if accountId or fieldId is missing',
    async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test',
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { message: 'Access granted' });
    }
  );
});
