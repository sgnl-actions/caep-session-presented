# CAEP Session Presented Event Transmitter

This action transmits CAEP (Continuous Access Evaluation Protocol) Session Presented events as Security Event Tokens (SET) to specified receivers. It implements the [OpenID CAEP 1.0 Final specification](https://openid.net/specs/openid-caep-1_0-final.html) for session liveness notifications.

## Overview

The CAEP Session Presented event signals that a session is still active (liveness heartbeat). This is used for:
- Session liveness monitoring across federated systems
- Detecting stale sessions that haven't presented recently
- Triggering session revocation when presentations stop
- Cross-system session correlation

## Prerequisites

- Node.js 22 runtime environment
- Configured authentication (Bearer, Basic, or OAuth2)
- Target receiver endpoint that accepts Security Event Tokens

## Configuration

### Input Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `subject` | text | Yes | Subject identifier JSON (e.g., `{"format":"email","email":"user@example.com"}`) |
| `audience` | text | Yes | Intended recipient of the SET |
| `fp_ua` | text | No | User agent fingerprint for the session |
| `ext_id` | text | No | External session identifier (e.g., federated session ID) |
| `event_timestamp` | text | No | Unix timestamp (seconds) when the session was presented (defaults to now) |
| `initiating_entity` | text | No | What initiated the event: `admin`, `user`, `policy`, `system` |
| `reason_admin` | text | No | Admin-readable reason (JSON i18n object or plain string) |
| `reason_user` | text | No | User-readable reason (JSON i18n object or plain string) |
| `address` | text | No | Destination URL override (defaults to ADDRESS env var) |

### Outputs

| Name | Type | Description |
|------|------|-------------|
| `status` | text | Operation result: `success` or `failed` |
| `statusCode` | number | HTTP status code from the SET receiver |
| `body` | text | Response body from the SET receiver |
| `retryable` | boolean | Whether the error is retryable |

## Usage Examples

### Basic Session Presented (Heartbeat)

```json
{
  "subject": "{\"format\":\"email\",\"email\":\"user@example.com\"}",
  "audience": "https://receiver.example.com"
}
```

### Session Presented with Metadata

```json
{
  "subject": "{\"format\":\"email\",\"email\":\"user@example.com\"}",
  "audience": "https://receiver.example.com",
  "fp_ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "ext_id": "federated-session-xyz789",
  "initiating_entity": "system"
}
```

## Event Structure

```json
{
  "iss": "https://sgnl.ai/",
  "aud": "https://receiver.example.com",
  "iat": 1234567890,
  "jti": "unique-event-id",
  "sub_id": {
    "format": "email",
    "email": "user@example.com"
  },
  "events": {
    "https://schemas.openid.net/secevent/caep/event-type/session-presented": {
      "event_timestamp": 1234567890,
      "fp_ua": "Mozilla/5.0 ...",
      "ext_id": "federated-session-xyz789",
      "initiating_entity": "system"
    }
  }
}
```

## Error Handling

Retryable errors (automatic retry): 429, 502, 503, 504
Non-retryable errors (permanent failure): 400, 401, 403, 404

## Development

```bash
npm install
npm test
npm run build
npm run lint
npm run validate
```

## References

- [OpenID CAEP 1.0 Final Specification](https://openid.net/specs/openid-caep-1_0-final.html)
- [RFC 8417 - Security Event Token (SET)](https://datatracker.ietf.org/doc/html/rfc8417)
