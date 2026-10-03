import { canWriteWorkRecords } from './work-record-permissions.js';

export function canWriteApprovalRecords(role, permissions) {
  return canWriteWorkRecords(role, permissions, 'support');
}
