import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Me } from '../../shared/session'

// Synthetic data only.
const items = [
  { id: 't1', procedure_code: '23.2', name: 'Tumpatan (contoh)', category: 'konservasi', valid_from: '2026-01-01', editable_from: '2026-11-15', next: null,
    levels: [{ id: 'l1', variant: 'standar', label: '1 permukaan', price_rp: 200000 }, { id: 'l2', variant: 'sulit', label: '2+ permukaan', price_rp: 300000 }] },
  { id: 't2', procedure_code: '96.54', name: 'Scaling (contoh)', category: null, valid_from: '2026-01-01', editable_from: '2026-11-15', next: null,
    levels: [{ id: 'l3', variant: 'standar', label: 'Standar', price_rp: 250000 }] },
]
const m = {
  getProfile: vi.fn(), saveProfile: vi.fn(), saveBranch: vi.fn(), getTariffs: vi.fn(), saveLevels: vi.fn(), saveCategory: vi.fn(),
  bulkTariffs: vi.fn(), getAccounts: vi.fn(), addAccount: vi.fn(), updateAccount: vi.fn(),
}
vi.mock('./api', () => Object.fromEntries(Object.entries(m).map(([k, f]) => [k, (...a: unknown[]) => f(...a)])))
const { default: ClinicSettingsPage } = await import('./ClinicSettingsPage')
const me = (permissions: string[]) => ({ permissions, branches: [{ id: 'b1', name: 'Cabang Uji', timezone: 'Asia/Jakarta' }] } as unknown as Me)
const OWNER = ['settings.manage', 'tariff.manage', 'billing.accounts']

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset())
  m.getTariffs.mockResolvedValue({ items, categories: ['konservasi'] })
  m.saveLevels.mockResolvedValue({})
  m.getProfile.mockResolvedValue({ name: 'Klinik Uji', address: null, phone: null, email: null, license_no: null, license_valid_until: null,
    branches: [{ id: 'b1', name: 'Cabang Uji', address: null, phone: null }] })
  m.getAccounts.mockResolvedValue([{ id: 'a1', branch_id: null, name: 'Kas tunai', kind: 'tunai', bank_name: null, account_last4: null, is_active: true }])
})

test('tabs follow permissions: a user with only tariff.manage sees Harga only', async () => {
  render(<ClinicSettingsPage me={me(['tariff.manage'])} tab="" onChanged={() => {}} />)
  const nav = screen.getByRole('navigation', { name: 'Pengaturan Klinik' })
  expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Harga'])
  expect(await screen.findByText('Tumpatan (contoh)')).toBeInTheDocument()
})

test('profile: one Simpan saves clinic fields and the branch address', async () => {
  const onChanged = vi.fn()
  m.saveProfile.mockImplementation(async (b) => ({ ...b, branches: [] }))
  m.saveBranch.mockResolvedValue({})
  render(<ClinicSettingsPage me={me(OWNER)} tab="" onChanged={onChanged} />)
  fireEvent.change(await screen.findByLabelText('Alamat'), { target: { value: 'Jl. Uji Sintetis 1' } })
  fireEvent.change(screen.getByLabelText('Nomor izin klinik'), { target: { value: 'IZIN-UJI-1' } })
  fireEvent.change(screen.getByLabelText('Alamat cabang'), { target: { value: 'Jl. Cabang Uji 2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan profil' }))
  await waitFor(() => expect(onChanged).toHaveBeenCalled())
  expect(m.saveProfile.mock.calls[0][0]).toMatchObject({ name: 'Klinik Uji', address: 'Jl. Uji Sintetis 1', license_no: 'IZIN-UJI-1' })
  expect(m.saveBranch).toHaveBeenCalledWith('b1', { address: 'Jl. Cabang Uji 2', phone: null })
})

test('price list: inline rupiah edit -> one Simpan sends the full level set from editable_from', async () => {
  render(<ClinicSettingsPage me={me(OWNER)} tab="harga" onChanged={() => {}} />)
  const input = await screen.findByLabelText('Harga Tumpatan (contoh) 1 permukaan')
  expect(input).toHaveValue('200.000')
  fireEvent.change(input, { target: { value: '225.000' } })
  expect(input).toHaveValue('225.000')
  fireEvent.click(screen.getByRole('button', { name: 'Simpan 1 harga' }))
  await waitFor(() => expect(m.saveLevels).toHaveBeenCalledWith('t1', '2026-11-15', [
    { code: 'standar', label: '1 permukaan', price_rp: 225000 }, { code: 'sulit', label: '2+ permukaan', price_rp: 300000 }]))
  expect(await screen.findByRole('status')).toHaveTextContent('1 harga tersimpan.')
})

test('price list: search and category reach the API; bulk previews before applying', async () => {
  m.bulkTariffs.mockResolvedValueOnce({ count: 1, rows: [{ procedure_code: '96.54', variant: 'standar', old_rp: 250000, new_rp: 275000 }] })
    .mockResolvedValueOnce({ count: 1, rows: [] })
  render(<ClinicSettingsPage me={me(OWNER)} tab="harga" onChanged={() => {}} />)
  fireEvent.change(await screen.findByLabelText('Cari tindakan'), { target: { value: 'scal' } })
  await waitFor(() => expect(m.getTariffs).toHaveBeenLastCalledWith('scal', ''))
  fireEvent.click(screen.getByRole('button', { name: 'konservasi' }))
  await waitFor(() => expect(m.getTariffs).toHaveBeenLastCalledWith('scal', 'konservasi'))
  fireEvent.click(screen.getByLabelText('Pilih Scaling (contoh)'))
  fireEvent.click(screen.getByRole('button', { name: 'Pratinjau' }))
  expect(await screen.findByText('Rp275.000')).toBeInTheDocument()
  expect(m.bulkTariffs.mock.calls[0][0]).toMatchObject({ procedure_codes: ['96.54'], kind: 'percent', value: 10, dry_run: true })
  fireEvent.click(screen.getByRole('button', { name: 'Terapkan 1 harga' }))
  await waitFor(() => expect(m.bulkTariffs.mock.calls[1][0]).toMatchObject({ dry_run: false }))
})

test('payment methods: grouped by kind; add a transfer account (last 4 digits only)', async () => {
  m.addAccount.mockResolvedValue({ id: 'a2', name: 'Transfer BCA', kind: 'transfer' })
  render(<ClinicSettingsPage me={me(OWNER)} tab="pembayaran" onChanged={() => {}} />)
  expect(await screen.findByText('Kas tunai')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'QRIS' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Tambah metode' }))
  const save = screen.getByRole('button', { name: 'Simpan' })
  expect(save).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Bank'), { target: { value: 'BCA' } })
  fireEvent.change(screen.getByLabelText('4 angka terakhir rekening'), { target: { value: '12a34' } })
  fireEvent.click(save)
  await waitFor(() => expect(m.addAccount).toHaveBeenCalledWith({ name: 'Transfer BCA', kind: 'transfer', branch_id: null, bank_name: 'BCA', account_last4: '1234' }))
})
