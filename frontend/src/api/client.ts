const BASE = import.meta.env.VITE_API_URL ?? ''

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

// CSRF token is a non-HttpOnly cookie set by the server on login; double-submit
// pattern — echoed back in a header the server validates against the cookie.
function readCsrfCookie(): string | null {
  const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const method = (init?.method ?? 'GET').toUpperCase()
  if (!SAFE_METHODS.has(method)) {
    const csrf = readCsrfCookie()
    if (csrf) headers['X-CSRF-Token'] = csrf
  }
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: { ...headers, ...init?.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

// ── Admin Auth ──────────────────────────────────────────

export async function adminLogin(password: string) {
  await request<{ ok: boolean; csrfToken: string }>('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export async function adminLogout() {
  try { await request<{ ok: boolean }>('/api/admin/logout', { method: 'POST' }) } catch { /* best effort */ }
}

export async function checkAdminSession(): Promise<boolean> {
  try {
    await request<{ ok: boolean }>('/api/admin/me')
    return true
  } catch {
    return false
  }
}

// ── Admin Bets ──────────────────────────────────────────

export type ApiPersonMeta = { name: string; pfp?: string }

export type ApiBetSubGroup = {
  /** Stable key; options.subGroupId references this */
  groupKey: string
  title: string
  image?: string
  personId?: string
  promoted?: boolean
  /** Shown on hover on the info icon next to this category title */
  infoTooltip?: string
  personMeta?: ApiPersonMeta
}

export type ApiBetOption = {
  id: string
  label: string
  multiplier: string
  oldMultiplier?: string
  personId?: string
  result?: 'won' | 'lost'
  tier?: 'main' | 'sub'
  subGroupId?: string
  promoted?: boolean
  personMeta?: ApiPersonMeta
}

export type ApiBet = {
  _id: string
  shortId: string
  title: string
  banner?: string
  pfp?: string
  date: string
  options: ApiBetOption[]
  subGroups?: ApiBetSubGroup[]
  settlementRules: string
  /** Tooltip for the Główne market block info icon */
  mainMarketTooltip?: string
  category: string
  personId?: string
  status: 'open' | 'pending' | 'resolved' | 'cancelled'
  featuredOrder: number
  createdAt: string
}

export type ApiPerson = { _id: string; name: string; pfp?: string }
export type ApiCategory = { _id: string; name: string; autoCreated: boolean }

export const admin = {
  getBets: () => request<ApiBet[]>('/api/admin/bets'),
  createBet: (data: Omit<ApiBet, '_id' | 'shortId' | 'status' | 'createdAt'>) =>
    request<ApiBet>('/api/admin/bets', { method: 'POST', body: JSON.stringify(data) }),
  updateBet: (id: string, data: Partial<ApiBet>) =>
    request<ApiBet>(`/api/admin/bets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBet: (id: string) =>
    request<{ success: boolean }>(`/api/admin/bets/${id}`, { method: 'DELETE' }),
  resolveBet: (id: string, optionResults: Record<string, 'won' | 'lost'>) =>
    request<ApiBet>(`/api/admin/bets/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ optionResults }),
    }),
  featureBet: (id: string, featuredOrder: number) =>
    request<ApiBet>(`/api/admin/bets/${id}/feature`, {
      method: 'PUT',
      body: JSON.stringify({ featuredOrder }),
    }),

  getPersons: () => request<ApiPerson[]>('/api/admin/persons'),
  createPerson: (data: { name: string; pfp?: string }) =>
    request<ApiPerson>('/api/admin/persons', { method: 'POST', body: JSON.stringify(data) }),
  updatePerson: (id: string, data: { name: string; pfp?: string }) =>
    request<ApiPerson>(`/api/admin/persons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePerson: (id: string) =>
    request<{ success: boolean }>(`/api/admin/persons/${id}`, { method: 'DELETE' }),

  getCategories: () => request<ApiCategory[]>('/api/admin/categories'),
  createCategory: (name: string) =>
    request<ApiCategory>('/api/admin/categories', { method: 'POST', body: JSON.stringify({ name }) }),
  updateCategory: (id: string, name: string) =>
    request<ApiCategory>(`/api/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  deleteCategory: (id: string) =>
    request<{ success: boolean }>(`/api/admin/categories/${id}`, { method: 'DELETE' }),

  getUsers: () => request<any[]>('/api/admin/users'),
  deleteUser: (id: string) =>
    request<{ success: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE' }),
  getPayments: () => request<any[]>('/api/admin/payments'),
  backfillPln: () =>
    request<{ fixed: number; results: any[]; errors: string[] }>('/api/admin/backfill-pln', { method: 'POST' }),

  getPromoCodes: () => request<ApiPromoCode[]>('/api/admin/promo-codes'),
  createPromoCode: (data: PromoCodeCreatePayload) =>
    request<ApiPromoCode>('/api/admin/promo-codes', { method: 'POST', body: JSON.stringify(data) }),
  updatePromoCode: (id: string, data: { enabled?: boolean }) =>
    request<ApiPromoCode>(`/api/admin/promo-codes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePromoCode: (id: string) =>
    request<{ success: boolean }>(`/api/admin/promo-codes/${id}`, { method: 'DELETE' }),

  getTapesConfig: () =>
    request<SiteTapesConfig>('/api/admin/tapes'),
  putTapesConfig: (data: SiteTapesConfigPayload) =>
    request<SiteTapesConfig>('/api/admin/tapes', { method: 'PUT', body: JSON.stringify(data) }),
}

export type ApiPromoCode = {
  _id: string
  code: string
  amountPln: number
  usesLimit: number
  usesCount: number
  minDepositPln: number
  minWageredPln: number
  requireAnyDeposit: boolean
  source: 'admin' | 'reward-x' | 'reward-steam'
  enabled: boolean
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export type PromoCodeCreatePayload = {
  code?: string
  amountPln: number
  usesLimit?: number
  minDepositPln?: number
  minWageredPln?: number
  requireAnyDeposit?: boolean
  expiresAt?: string
}

export type SiteTapeLineRef = { betShortId: string; optionId: string }

export type SiteTapeConfig = {
  title: string
  lines: SiteTapeLineRef[]
}

export type SiteTapesConfig = {
  key: string
  day: SiteTapeConfig
  week: SiteTapeConfig
}

export type SiteTapesConfigPayload = {
  day: SiteTapeConfig
  week: SiteTapeConfig
}

export type ApiTapeLine = {
  betShortId: string
  optionId: string
  question: string
  image?: string
  selection: string
  oldMultiplier: string
  newMultiplier: string
  hasOld: boolean
}

export type ApiTape = {
  title: string
  lines: ApiTapeLine[]
  totalOld: string
  totalNew: string
  hasAnyOld: boolean
} | null

export type ApiTapesPublic = { day: ApiTape; week: ApiTape }

// ── Public ──────────────────────────────────────────────

export const pub = {
  getBets: (category?: string) =>
    request<ApiBet[]>(`/api/bets${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  getFeatured: () => request<ApiBet[]>('/api/bets/featured'),
  getBet: (shortId: string) => request<ApiBet>(`/api/bets/${shortId}`),
  getCategories: () => request<ApiCategory[]>('/api/bets/categories'),
  getTapes: () => request<ApiTapesPublic>('/api/bets/tapes'),
  claimReward: (platform: 'x' | 'steam') =>
    request<{ code: string; amountPln: number }>('/api/rewards/claim', {
      method: 'POST',
      body: JSON.stringify({ platform }),
    }),
}
