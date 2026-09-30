import assert from 'node:assert/strict';
import test from 'node:test';
import { resendOperationalReadiness } from '../src/integrations/resend-readiness.js';

test('marks Resend operational only when sender and verified domain are ready', () => {
  assert.deepEqual(resendOperationalReadiness({ verifiedDomainCount: 1, senderConfigured: true, senderMatchesVerifiedDomain: true }), {
    status: 'connected', missing: [],
  });
});

test('reports missing verified domain and sender configuration', () => {
  assert.deepEqual(resendOperationalReadiness({ verifiedDomainCount: 0, senderConfigured: false, senderMatchesVerifiedDomain: false }), {
    status: 'setup_required',
    missing: ['verifique pelo menos um domínio no Resend', 'configure RESEND_FROM_EMAIL com um e-mail válido'],
  });
});

test('rejects a sender that does not belong to a verified domain', () => {
  assert.deepEqual(resendOperationalReadiness({ verifiedDomainCount: 2, senderConfigured: true, senderMatchesVerifiedDomain: false }), {
    status: 'setup_required', missing: ['use um remetente pertencente a um domínio verificado'],
  });
});
