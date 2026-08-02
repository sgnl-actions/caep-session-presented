import { transmitSET } from '@sgnl-ai/set-transmitter';
import { signSET, getBaseURL, getAuthorizationHeader, SGNL_USER_AGENT } from '@sgnl-actions/utils';

// Event type constant
const SESSION_PRESENTED_EVENT = 'https://schemas.openid.net/secevent/caep/event-type/session-presented';

/**
 * Parse subject JSON string
 */
function parseSubject(subjectStr) {
  try {
    return JSON.parse(subjectStr);
  } catch (error) {
    throw new Error(`Invalid subject JSON: ${error.message}`, { cause: error });
  }
}

/**
 * Parse reason - auto-wraps plain strings as i18n objects per CAEP spec.
 * If input is a JSON object, use it directly. If plain string, wrap as {"en": value}.
 */
function parseReason(reasonStr) {
  if (!reasonStr) return undefined;

  try {
    const parsed = JSON.parse(reasonStr);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch {
    // Not JSON - fall through to auto-wrap
  }

  return { en: reasonStr };
}

export default {
  /**
   * Main execution handler - transmits a CAEP Session Presented event as a Security Event Token
   *
   * @param {Object} params - Job input parameters
   * @param {string} params.subject - Subject identifier JSON
   * @param {string} params.audience - Intended recipient of the SET
   * @param {string} [params.fp_ua] - User agent fingerprint
   * @param {string} [params.ext_id] - External session identifier
   * @param {string} [params.event_timestamp] - Unix timestamp (seconds) when the event occurred
   * @param {string} [params.initiating_entity] - Entity that initiated the event (admin, user, policy, system)
   * @param {string} [params.reason_admin] - Admin-readable reason (JSON i18n object or plain string)
   * @param {string} [params.reason_user] - User-readable reason (JSON i18n object or plain string)
   * @param {string} [params.address] - Optional destination URL override
   * @param {Object} context - Execution context with secrets, environment, and crypto
   * @returns {Object} Transmission result with status, statusCode, body, and retryable flag
   */
  invoke: async (params, context) => {

    const address = getBaseURL(params, context);
    const authHeader = await getAuthorizationHeader(context);

    // Parse parameters
    const subject = parseSubject(params.subject);

    // Build event payload
    const eventPayload = {
      event_timestamp: params.event_timestamp
        ? parseInt(params.event_timestamp, 10)
        : Math.floor(Date.now() / 1000)
    };

    // Add optional event claims
    if (params.fp_ua) {
      eventPayload.fp_ua = params.fp_ua;
    }
    if (params.ext_id) {
      eventPayload.ext_id = params.ext_id;
    }
    if (params.initiating_entity) {
      eventPayload.initiating_entity = params.initiating_entity;
    }
    if (params.reason_admin) {
      eventPayload.reason_admin = parseReason(params.reason_admin);
    }
    if (params.reason_user) {
      eventPayload.reason_user = parseReason(params.reason_user);
    }

    // Build the SET payload (reserved claims will be added during signing)
    const setPayload = {
      aud: params.audience,
      sub_id: subject,
      events: {
        [SESSION_PRESENTED_EVENT]: eventPayload
      }
    };

    const jwt = await signSET(context, setPayload);

    // Transmit the SET
    return await transmitSET(jwt, address, {
      headers: {
        'Authorization': authHeader,
        'User-Agent': SGNL_USER_AGENT
      }
    });
  },

  /**
   * Error handler for retryable failures
   */
  error: async (params, _context) => {
    const { error } = params;

    if (error.message?.includes('429') ||
        error.message?.includes('502') ||
        error.message?.includes('503') ||
        error.message?.includes('504')) {
      return { status: 'retry_requested' };
    }

    throw error;
  },

  /**
   * Cleanup handler
   */
  halt: async (_params, _context) => {
    return { status: 'halted' };
  }
};
