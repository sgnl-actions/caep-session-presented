#!/usr/bin/env node

/**
 * Development runner for testing the CAEP Session Presented transmitter locally.
 * This will fail without a real crypto context, but demonstrates the expected parameters.
 */

import script from '../src/script.mjs';

const mockContext = {
  environment: {
    ADDRESS: 'https://receiver.example.com/.well-known/ssf'
  },
  secrets: {
    BEARER_AUTH_TOKEN: 'dev-test-token'
  },
  crypto: {
    signJWT: async (payload, header) => {
      console.log('Mock signJWT called with:', JSON.stringify({ payload, header }, null, 2));
      return 'mock-signed-jwt-token';
    }
  }
};

const mockParams = {
  subject: '{"format":"email","email":"user@example.com"}',
  audience: 'https://receiver.example.com',
  fp_ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  ext_id: 'federated-session-xyz789',
  initiating_entity: 'system'
};

async function runDev() {
  console.log('Running CAEP Session Presented transmitter in development mode...\n');
  console.log('Parameters:', JSON.stringify(mockParams, null, 2));
  console.log('\n' + '='.repeat(50) + '\n');

  try {
    const result = await script.invoke(mockParams, mockContext);
    console.log('\n' + '='.repeat(50));
    console.log('Completed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('\n' + '='.repeat(50));
    console.error('Failed:', error.message);

    if (script.error) {
      console.log('\nAttempting error recovery...');
      try {
        const recovery = await script.error({ ...mockParams, error }, mockContext);
        console.log('Recovery result:', JSON.stringify(recovery, null, 2));
      } catch (recoveryError) {
        console.error('Recovery failed:', recoveryError.message);
      }
    }
  }
}

runDev().catch(console.error);
