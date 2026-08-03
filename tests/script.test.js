const { jest } = import.meta;

// Mock dependencies before importing the script
jest.unstable_mockModule('@sgnl-ai/set-transmitter', () => ({
  transmitSET: jest.fn()
}));

jest.unstable_mockModule('@sgnl-actions/utils', () => ({
  signSET: jest.fn(),
  getBaseURL: jest.fn(),
  getAuthorizationHeader: jest.fn(),
  SGNL_USER_AGENT: 'SGNL-CAEP-Hub/2.0'
}));

const { transmitSET } = await import('@sgnl-ai/set-transmitter');
const { signSET, getBaseURL, getAuthorizationHeader } = await import('@sgnl-actions/utils');
const script = (await import('../src/script.mjs')).default;

describe('CAEP Session Presented Transmitter', () => {
  const mockContext = {
    environment: {
      ADDRESS: 'https://receiver.example.com/.well-known/ssf'
    },
    secrets: {
      BEARER_AUTH_TOKEN: 'test-token'
    },
    crypto: {
      signJWT: jest.fn()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getBaseURL.mockReturnValue('https://receiver.example.com/.well-known/ssf');
    getAuthorizationHeader.mockResolvedValue('Bearer test-token');
    signSET.mockResolvedValue('signed-jwt-token');
    transmitSET.mockResolvedValue({
      status: 'success',
      statusCode: 202,
      body: '',
      retryable: false
    });
  });

  describe('invoke', () => {
    test('should transmit session presented with required fields only', async () => {
      const params = {
        subject: '{"format":"email","email":"user@example.com"}',
        audience: 'https://receiver.example.com'
      };

      const result = await script.invoke(params, mockContext);

      expect(result.status).toBe('success');
      expect(result.statusCode).toBe(202);

      const setPayload = signSET.mock.calls[0][1];
      expect(setPayload.aud).toBe('https://receiver.example.com');
      expect(setPayload.sub_id).toEqual({ format: 'email', email: 'user@example.com' });

      const eventPayload = setPayload.events['https://schemas.openid.net/secevent/caep/event-type/session-presented'];
      expect(eventPayload.event_timestamp).toBeDefined();
    });

    test('should include all optional fields when provided', async () => {
      const params = {
        subject: '{"format":"email","email":"user@example.com"}',
        audience: 'https://receiver.example.com',
        fp_ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        ext_id: 'federated-session-xyz789',
        initiating_entity: 'system',
        reason_admin: '{"en":"Session heartbeat received"}',
        reason_user: 'Session active'
      };

      await script.invoke(params, mockContext);

      const setPayload = signSET.mock.calls[0][1];
      const eventPayload = setPayload.events['https://schemas.openid.net/secevent/caep/event-type/session-presented'];

      expect(eventPayload.fp_ua).toBe('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
      expect(eventPayload.ext_id).toBe('federated-session-xyz789');
      expect(eventPayload.initiating_entity).toBe('system');
      expect(eventPayload.reason_admin).toEqual({ en: 'Session heartbeat received' });
      expect(eventPayload.reason_user).toEqual({ en: 'Session active' });
    });

    test('should auto-wrap plain string reason_admin as i18n object', async () => {
      const params = {
        subject: '{"format":"email","email":"user@example.com"}',
        audience: 'https://receiver.example.com',
        reason_admin: 'Periodic session liveness check'
      };

      await script.invoke(params, mockContext);

      const setPayload = signSET.mock.calls[0][1];
      const eventPayload = setPayload.events['https://schemas.openid.net/secevent/caep/event-type/session-presented'];

      expect(eventPayload.reason_admin).toEqual({ en: 'Periodic session liveness check' });
    });

    test('should pass through JSON i18n object for reason_user', async () => {
      const params = {
        subject: '{"format":"email","email":"user@example.com"}',
        audience: 'https://receiver.example.com',
        reason_user: '{"en":"Session verified","ja":"セッション確認済み"}'
      };

      await script.invoke(params, mockContext);

      const setPayload = signSET.mock.calls[0][1];
      const eventPayload = setPayload.events['https://schemas.openid.net/secevent/caep/event-type/session-presented'];

      expect(eventPayload.reason_user).toEqual({ en: 'Session verified', ja: 'セッション確認済み' });
    });

    test('should use custom event_timestamp when provided', async () => {
      const params = {
        subject: '{"format":"email","email":"user@example.com"}',
        audience: 'https://receiver.example.com',
        event_timestamp: '1700000000'
      };

      await script.invoke(params, mockContext);

      const setPayload = signSET.mock.calls[0][1];
      const eventPayload = setPayload.events['https://schemas.openid.net/secevent/caep/event-type/session-presented'];

      expect(eventPayload.event_timestamp).toBe(1700000000);
    });

    test('should default event_timestamp to current time when not provided', async () => {
      const params = {
        subject: '{"format":"email","email":"user@example.com"}',
        audience: 'https://receiver.example.com'
      };

      const before = Math.floor(Date.now() / 1000);
      await script.invoke(params, mockContext);
      const after = Math.floor(Date.now() / 1000);

      const setPayload = signSET.mock.calls[0][1];
      const eventPayload = setPayload.events['https://schemas.openid.net/secevent/caep/event-type/session-presented'];
      expect(eventPayload.event_timestamp).toBeGreaterThanOrEqual(before);
      expect(eventPayload.event_timestamp).toBeLessThanOrEqual(after);
    });

    test('should not include reason fields when not provided', async () => {
      const params = {
        subject: '{"format":"email","email":"user@example.com"}',
        audience: 'https://receiver.example.com'
      };

      await script.invoke(params, mockContext);

      const setPayload = signSET.mock.calls[0][1];
      const eventPayload = setPayload.events['https://schemas.openid.net/secevent/caep/event-type/session-presented'];
      expect(eventPayload.reason_admin).toBeUndefined();
      expect(eventPayload.reason_user).toBeUndefined();
    });

    test('should handle non-retryable HTTP errors from transmitSET', async () => {
      transmitSET.mockResolvedValue({
        status: 'failed',
        statusCode: 400,
        body: '{"error":"Invalid request"}',
        retryable: false
      });

      const params = {
        subject: '{"format":"email","email":"user@example.com"}',
        audience: 'https://receiver.example.com'
      };

      const result = await script.invoke(params, mockContext);

      expect(result.status).toBe('failed');
      expect(result.statusCode).toBe(400);
      expect(result.retryable).toBe(false);
    });

    test('should use ADDRESS from environment when address not provided', async () => {
      const params = {
        subject: '{"format":"email","email":"user@example.com"}',
        audience: 'https://receiver.example.com'
      };

      await script.invoke(params, mockContext);

      expect(getBaseURL).toHaveBeenCalledWith(params, mockContext);
    });

    test('should throw on invalid subject JSON', async () => {
      const params = {
        subject: 'not valid json',
        audience: 'https://receiver.example.com'
      };

      await expect(script.invoke(params, mockContext)).rejects.toThrow('Invalid subject JSON');
    });

    test('should use address param for URL override', async () => {
      const params = {
        subject: '{"format":"email","email":"user@example.com"}',
        audience: 'https://receiver.example.com',
        address: 'https://custom-url.example.com/events'
      };

      await script.invoke(params, mockContext);

      expect(getBaseURL).toHaveBeenCalledWith(params, mockContext);
    });

    test('should pass auth header to transmitSET', async () => {
      const params = {
        subject: '{"format":"email","email":"user@example.com"}',
        audience: 'https://receiver.example.com'
      };

      await script.invoke(params, mockContext);

      expect(getAuthorizationHeader).toHaveBeenCalledWith(mockContext);
      expect(transmitSET).toHaveBeenCalledWith(
        'signed-jwt-token',
        'https://receiver.example.com/.well-known/ssf',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'User-Agent': 'SGNL-CAEP-Hub/2.0'
          })
        })
      );
    });
  });

  describe('error handler', () => {
    test('should return retry_requested for 429', async () => {
      const params = { error: { message: 'HTTP 429 Too Many Requests' } };
      const result = await script.error(params, mockContext);
      expect(result.status).toBe('retry_requested');
    });

    test('should return retry_requested for 502', async () => {
      const params = { error: { message: 'HTTP 502 Bad Gateway' } };
      const result = await script.error(params, mockContext);
      expect(result.status).toBe('retry_requested');
    });

    test('should return retry_requested for 503', async () => {
      const params = { error: { message: 'HTTP 503 Service Unavailable' } };
      const result = await script.error(params, mockContext);
      expect(result.status).toBe('retry_requested');
    });

    test('should return retry_requested for 504', async () => {
      const params = { error: { message: 'HTTP 504 Gateway Timeout' } };
      const result = await script.error(params, mockContext);
      expect(result.status).toBe('retry_requested');
    });

    test('should re-throw non-retryable errors', async () => {
      const params = { error: { message: 'HTTP 400 Bad Request' } };
      await expect(script.error(params, mockContext)).rejects.toEqual({ message: 'HTTP 400 Bad Request' });
    });
  });

  describe('halt handler', () => {
    test('should return halted status', async () => {
      const result = await script.halt({}, mockContext);
      expect(result.status).toBe('halted');
    });
  });
});
