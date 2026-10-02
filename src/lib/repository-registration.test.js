import test from 'node:test';
import assert from 'node:assert/strict';
import { repositoryRegistrationIssue } from './repository-registration.js';

test('prevents saving while repositories have not finished loading', () => {
  assert.match(repositoryRegistrationIssue({ owner: 'acme', name: 'site', loading: true }), /Aguarde/);
});

test('detects duplicate repository names without case sensitivity or surrounding spaces', () => {
  assert.match(repositoryRegistrationIssue({
    owner: ' ACME ',
    name: 'SITE',
    repos: [{ owner: 'acme', name: 'site' }],
  }), /já está cadastrado/);
});

test('allows distinct repositories and requires owner and name', () => {
  assert.equal(repositoryRegistrationIssue({ owner: 'acme', name: 'app', repos: [{ owner: 'acme', name: 'site' }] }), '');
  assert.match(repositoryRegistrationIssue({ owner: 'acme', name: ' ' }), /Informe/);
});

test('rejects names the GitHub activity endpoint would reject before saving them', () => {
  assert.match(repositoryRegistrationIssue({ owner: 'https://github.com/acme', name: 'site' }), /sem URL/);
  assert.match(repositoryRegistrationIssue({ owner: 'acme', name: 'group/site' }), /sem URL/);
  assert.match(repositoryRegistrationIssue({ owner: '-acme', name: 'site' }), /hífen nas extremidades/);
  assert.match(repositoryRegistrationIssue({ owner: 'a'.repeat(40), name: 'site' }), /até 39 caracteres/);
  assert.match(repositoryRegistrationIssue({ owner: 'acme', name: 'site.' }), /ponto final/);
  assert.match(repositoryRegistrationIssue({ owner: 'acme', name: `a${'b'.repeat(100)}` }), /até 100 caracteres/);
});
