import test from 'node:test';
import assert from 'node:assert/strict';
import { getPublicLegalPageMetadata } from './public-legal-page.js';

test('public legal pages have their own meaningful browser title and description', () => {
  assert.deepEqual(getPublicLegalPageMetadata('privacy'), {
    title: 'Focusshub · Política de Privacidade',
    description: 'Entenda como o Focusshub Workspace trata os dados usados para operar o serviço e suas integrações.',
  });
  assert.deepEqual(getPublicLegalPageMetadata('terms'), {
    title: 'Focusshub · Termos de Uso',
    description: 'Consulte as condições de uso do Focusshub Workspace, incluindo responsabilidades e integrações.',
  });
});

test('unknown legal page types safely resolve to the terms page', () => {
  assert.equal(getPublicLegalPageMetadata('unknown').title, getPublicLegalPageMetadata('terms').title);
});
