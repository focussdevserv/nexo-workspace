export function safeLowercase(value, fallback = '') {
  return String(value ?? fallback).toLocaleLowerCase('pt-BR');
}
