const API_BASE = 'https://scan.merlinchain.io/api'
export const SCAN_URL = 'https://scan.merlinchain.io'

type ApiStatus = '0' | '1'

interface ApiResponse<T> {
  message: string
  status: ApiStatus
  result: T
}

export interface Transaction {
  hash: string
  from: string
  to: string
  value: string
  timeStamp: string
  blockNumber: string
  gasUsed: string
  gasPrice: string
  isError: '0' | '1'
  txreceipt_status: '0' | '1'
  confirmations: string
  input: string
}

export interface TokenBalance {
  contractAddress: string
  name: string
  symbol: string
  decimals: string
  balance: string
}

export interface TokenTransfer {
  hash: string
  from: string
  to: string
  value: string
  timeStamp: string
  contractAddress: string
  tokenName: string
  tokenSymbol: string
  tokenDecimal: string
  tokenID?: string
}

export interface CoinPrice {
  coin_btc: string
  coin_usd: string
  coin_btc_timestamp: string
  coin_usd_timestamp: string
}

async function request<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API_BASE)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const data = (await res.json()) as ApiResponse<T>
  if (data.status === '0') {
    const msg = String(
      typeof data.result === 'string' ? data.result : data.message || '',
    ).toLowerCase()
    if (
      msg.includes('no transaction') ||
      msg.includes('no token') ||
      msg.includes('no record') ||
      msg.includes('not found')
    ) {
      return [] as T
    }
    throw new Error(
      (typeof data.result === 'string' && data.result) ||
        data.message ||
        'API error',
    )
  }

  return data.result
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim())
}

export async function getBalance(address: string): Promise<string> {
  return request<string>({
    module: 'account',
    action: 'balance',
    address,
  })
}

export async function getTransactions(
  address: string,
  page = 1,
  offset = 20,
): Promise<Transaction[]> {
  return request<Transaction[]>({
    module: 'account',
    action: 'txlist',
    address,
    page: String(page),
    offset: String(offset),
    sort: 'desc',
  })
}

export async function getTokenList(address: string): Promise<TokenBalance[]> {
  return request<TokenBalance[]>({
    module: 'account',
    action: 'tokenlist',
    address,
  })
}

export async function getTokenTransfers(
  address: string,
  page = 1,
  offset = 20,
): Promise<TokenTransfer[]> {
  return request<TokenTransfer[]>({
    module: 'account',
    action: 'tokentx',
    address,
    page: String(page),
    offset: String(offset),
    sort: 'desc',
  })
}

export async function getCoinPrice(): Promise<CoinPrice> {
  return request<CoinPrice>({
    module: 'stats',
    action: 'coinprice',
  })
}

export interface AddressData {
  balanceWei: string
  coinPrice: CoinPrice
  transactions: Transaction[]
  tokens: TokenBalance[]
  transfers: TokenTransfer[]
}

export async function fetchAddressData(address: string): Promise<AddressData> {
  const [balanceWei, coinPrice, transactions, tokens, transfers] =
    await Promise.all([
      getBalance(address),
      getCoinPrice(),
      getTransactions(address),
      getTokenList(address),
      getTokenTransfers(address),
    ])

  return { balanceWei, coinPrice, transactions, tokens, transfers }
}
