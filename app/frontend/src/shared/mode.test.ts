import { afterEach, expect, test } from 'vitest'
import { availableModes, barRole, defaultMode, readMode, tabOrder, writeMode } from './mode'
import { storage } from './storage'

afterEach(() => { try { localStorage.clear() } catch { /* */ } })

test('availableModes and defaults: dokter saja, pemilik saja, meja, tiga mode', () => {
  expect(availableModes(['dentist'])).toEqual(['dokter'])
  expect(defaultMode(['dentist'])).toBe('dokter')
  expect(availableModes(['owner'])).toEqual(['pemilik'])
  expect(defaultMode(['owner'])).toBe('pemilik')
  expect(availableModes(['front_desk'])).toEqual(['depan'])
  expect(defaultMode(['kasir'])).toBe('depan')
  expect(availableModes(['owner', 'dentist'])).toEqual(['dokter', 'depan', 'pemilik'])
  expect(defaultMode(['owner', 'dentist'])).toBe('depan')
  expect(availableModes(['dentist', 'kasir'])).toEqual(['dokter', 'depan'])
  expect(defaultMode(['dentist', 'front_desk'])).toBe('depan')
})

test('tabOrder per peran / mode (papan 02)', () => {
  expect(tabOrder(['dentist'], 'dokter')).toEqual(['/', '/jadwal', '/pasien', '/rekam-medis'])
  expect(tabOrder(['assistant'], 'depan')).toEqual(['/', '/antrean', '/pasien', '/rekam-medis'])
  expect(tabOrder(['front_desk'], 'depan')).toEqual(['/', '/jadwal', '/pasien', '/kasir'])
  expect(tabOrder(['kasir'], 'depan')).toEqual(['/kasir', '/antrean', '/pasien'])
  expect(tabOrder(['owner'], 'pemilik')).toEqual(['/', '/jadwal', '/pasien', '/laporan'])
  expect(tabOrder(['owner', 'dentist'], 'dokter')).toEqual(['/', '/jadwal', '/pasien', '/rekam-medis'])
  expect(tabOrder(['owner', 'dentist'], 'depan')).toEqual(['/', '/jadwal', '/pasien', '/kasir'])
  expect(tabOrder(['owner', 'dentist'], 'pemilik')).toEqual(['/', '/jadwal', '/pasien', '/laporan'])
})

test('barRole: kasir stays kasir; owner+dokter in Meja depan uses resepsionis bar', () => {
  expect(barRole(['kasir'], 'depan')).toBe('kasir')
  expect(barRole(['owner', 'dentist'], 'depan')).toBe('front_desk')
  expect(barRole(['owner', 'dentist'], 'dokter')).toBe('dentist')
  expect(barRole(['assistant'], 'depan')).toBe('assistant')
})

test('storage key is mode:{tenant}:{user}; legacy jadwal-mode:{user} is read once', () => {
  storage.set('jadwal-mode:u1', 'dokter')
  expect(readMode('t1', 'u1', ['owner', 'dentist'])).toBe('dokter')
  writeMode('t1', 'u1', 'pemilik')
  expect(localStorage.getItem('mode:t1:u1')).toBe('pemilik')
  expect(readMode('t1', 'u1', ['owner', 'dentist'])).toBe('pemilik')
})
