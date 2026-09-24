import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, renderProposalEmail } from '../src/email/proposal.js';

test('escapes HTML metacharacters in proposal content', () => {
  assert.equal(escapeHtml(`<script a="x">'&`), '&lt;script a=&quot;x&quot;&gt;&#39;&amp;');
});

test('renders proposal fields as escaped HTML and readable text', () => {
  const result = renderProposalEmail({ title: '<Site>', client: 'ACME & Cia', value: 'R$ 2.500', scope: '<p>Homepage</p>' });
  assert.match(result.html, /&lt;Site&gt;/);
  assert.match(result.html, /ACME &amp; Cia/);
  assert.doesNotMatch(result.html, /<p>Homepage<\/p>/);
  assert.match(result.text, /Escopo: <p>Homepage<\/p>/);
});

test('omits empty optional proposal fields', () => {
  const result = renderProposalEmail({ title: 'Proposta' });
  assert.doesNotMatch(result.html, /undefined|null/);
  assert.match(result.text, /Escopo: Escopo a detalhar/);
});
