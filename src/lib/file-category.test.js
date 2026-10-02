import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyWorkspaceFile, matchesWorkspaceFileFilter } from './file-category.js';

test('recognizes Google Drive and common uploaded spreadsheet formats', () => {
  assert.equal(classifyWorkspaceFile({ name: 'clientes', mimeType: 'application/vnd.google-apps.spreadsheet' }), 'sheet');
  assert.equal(classifyWorkspaceFile({ name: 'financeiro.xlsx', mimeType: 'application/octet-stream' }), 'sheet');
  assert.equal(classifyWorkspaceFile({ name: 'export.csv', mimeType: 'text/csv; charset=utf-8' }), 'sheet');
});

test('filters uploaded files by MIME or extension and keeps folder filter distinct', () => {
  const sheet = { name: 'dados.ods', type: 'file', mimeType: 'application/vnd.oasis.opendocument.spreadsheet' };
  assert.equal(matchesWorkspaceFileFilter(sheet, 'sheet'), true);
  assert.equal(matchesWorkspaceFileFilter({ name: 'foto.webp', type: 'file' }, 'image'), true);
  assert.equal(matchesWorkspaceFileFilter({ folder: true, name: 'Briefings' }, 'Pastas'), true);
  assert.equal(matchesWorkspaceFileFilter({ folder: true, name: 'Briefings' }, 'sheet'), false);
});

test('recognizes and filters Google Docs and common text document formats', () => {
  const googleDoc = { name: 'briefing', mimeType: 'application/vnd.google-apps.document' };
  const wordFile = { name: 'contrato.docx', mimeType: 'application/octet-stream' };
  assert.equal(classifyWorkspaceFile(googleDoc), 'document');
  assert.equal(classifyWorkspaceFile(wordFile), 'document');
  assert.equal(classifyWorkspaceFile({ name: 'notas', mimeType: 'text/plain' }), 'document');
  assert.equal(matchesWorkspaceFileFilter(googleDoc, 'document'), true);
  assert.equal(matchesWorkspaceFileFilter({ name: 'planilha.xlsx' }, 'document'), false);
});

test('specific file extension overrides a conflicting legacy display category', () => {
  assert.equal(classifyWorkspaceFile({ name: 'conteudo.docx', type: 'Imagem' }), 'document');
  assert.equal(classifyWorkspaceFile({ name: 'fotos.zip', type: 'PDF' }), 'file');
  assert.equal(classifyWorkspaceFile({ name: 'manual.pdf', type: 'Documento' }), 'pdf');
});
