import test from 'node:test';
import assert from 'node:assert/strict';
import { agendaTimeSlotLabel } from './agenda-time-slot.js';

test('announces the full date and time for each agenda slot', () => {
  const friday = new Date(2026, 9, 2);
  const monday = new Date(2026, 9, 5);
  const fridayLabel = agendaTimeSlotLabel(friday, '09:00');
  const mondayLabel = agendaTimeSlotLabel(monday, '09:00');

  assert.match(fridayLabel, /sexta-feira/);
  assert.match(fridayLabel, /2 de outubro de 2026/);
  assert.match(fridayLabel, /às 09:00$/);
  assert.notEqual(fridayLabel, mondayLabel);
});

test('falls back to a useful generic label for invalid slot data', () => {
  assert.equal(agendaTimeSlotLabel(new Date('invalid'), '09:00'), 'Criar compromisso');
  assert.equal(agendaTimeSlotLabel(new Date(2026, 9, 2), '9:00'), 'Criar compromisso');
});
