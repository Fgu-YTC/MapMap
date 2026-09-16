import { SCAN_URL } from './merlin'

export const BITMAP_CONTRACT =
  '0xf3188371290d36966bc6E88E3494dB8a4F60045a'

/** Wallet known to hold many M-Bitmap with metadata/images */
export const GALLERY_SEED_HOLDER =
  '0x00cE02dB856Bb0301E1eeB0b0d68B7696F70093C'

const V2 = `${SCAN_URL}/api/v2`

export interface BitmapCollection {
  address: string
  name: string
  symbol: string
  holders: string
  total_supply: string
  type: string
}

export interface BitmapNft {
  id: string
  name: string
  imageUrl: string | null
  inscriptionId: string | null
  inscriptionNumber: string | null
  owner: string | null
}

interface NftApiItem {
  id: string
  image_url: string | null
  animation_url: string | null
  metadata: {
    name?: string
    image?: string
    attributes?: Array<{ trait_type: string; value: string }>
  } | null
  owner: { hash: string } | null
  token: { address: string; symbol: string; name: string }
}

interface NftPage {
  items: NftApiItem[]
  next_page_params: Record<string, string | number> | null
}

function decodeHtml(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function attr(
  item: NftApiItem,
  trait: string,
): string | null {
  const found = item.metadata?.attributes?.find((a) => a.trait_type === trait)
  return found?.value ?? null
}

function mapNft(item: NftApiItem): BitmapNft {
  return {
    id: item.id,
    name: item.metadata?.name || `${item.id}.bitmap`,
    imageUrl: item.image_url || item.metadata?.image || item.animation_url,
    inscriptionId: attr(item, 'Inscription ID'),
    inscriptionNumber: attr(item, 'Inscription Number'),
    owner: item.owner?.hash ?? null,
  }
}

export async function getBitmapCollection(): Promise<BitmapCollection> {
  const res = await fetch(`${V2}/tokens/${BITMAP_CONTRACT}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as BitmapCollection
  return {
    ...data,
    name: decodeHtml(data.name),
  }
}

export async function getAddressBitmaps(
  address: string,
  pageParams?: Record<string, string | number> | null,
): Promise<{ items: BitmapNft[]; nextPageParams: Record<string, string | number> | null }> {
  const url = new URL(`${V2}/addresses/${address}/nft`)
  url.searchParams.set('type', 'ERC-721')

  if (pageParams) {
    for (const [key, value] of Object.entries(pageParams)) {
      url.searchParams.set(key, String(value))
    }
  }

  const data = await fetchV2Json<NftPage>(url.toString(), {
    items: [],
    next_page_params: null,
  })

  const items = data.items
    .filter(
      (item) =>
        item.token.address.toLowerCase() === BITMAP_CONTRACT.toLowerCase(),
    )
    .map(mapNft)

  return {
    items,
    nextPageParams: data.next_page_params,
  }
}

export async function fetchBitmapGallery(
  holder = GALLERY_SEED_HOLDER,
  pageParams?: Record<string, string | number> | null,
): Promise<{
  items: BitmapNft[]
  nextPageParams: Record<string, string | number> | null
}> {
  // Keep requesting pages until we collect enough Bitmaps or run out
  const collected: BitmapNft[] = []
  let params = pageParams ?? null
  let guard = 0

  while (collected.length < 24 && guard < 6) {
    const page = await getAddressBitmaps(holder, params)
    collected.push(...page.items)
    params = page.nextPageParams
    guard += 1
    if (!params) break
    // If this page already had bitmaps we're done for this "load" batch
    if (page.items.length > 0 && collected.length >= 12) break
  }

  return {
    items: collected.slice(0, 24),
    nextPageParams: params,
  }
}

export function tokenInstanceUrl(tokenId: string): string {
  return `${SCAN_URL}/token/${BITMAP_CONTRACT}/instance/${tokenId}`
}

async function fetchV2Json<T>(
  url: string,
  empty: T,
): Promise<T> {
  const res = await fetch(url)
  // Blockscout returns 404 for addresses with no indexed activity yet
  if (res.status === 404) return empty
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

export async function getBitmapHoldingCount(address: string): Promise<number> {
  const data = await fetchV2Json<{
    items: Array<{ amount: string; token: { address: string } }>
  }>(`${V2}/addresses/${address}/nft/collections`, { items: [] })

  const match = data.items.find(
    (item) => item.token.address.toLowerCase() === BITMAP_CONTRACT.toLowerCase(),
  )
  return match ? Number(match.amount) || 0 : 0
}

export interface BitmapTransfer {
  tokenId: string
  from: string
  to: string
  timestamp: string
  txHash: string
  method: string | null
}

export async function getBitmapTransfers(
  address: string,
): Promise<BitmapTransfer[]> {
  const url = new URL(`${V2}/addresses/${address}/token-transfers`)
  url.searchParams.set('type', 'ERC-721')
  url.searchParams.set('token', BITMAP_CONTRACT)

  const data = await fetchV2Json<{
    items: Array<{
      timestamp: string
      method: string | null
      tx_hash?: string
      transaction_hash?: string
      from: { hash: string }
      to: { hash: string }
      total: { token_id: string }
    }>
  }>(url.toString(), { items: [] })

  return data.items.map((item) => ({
    tokenId: item.total.token_id,
    from: item.from.hash,
    to: item.to.hash,
    timestamp: item.timestamp,
    txHash: item.tx_hash || item.transaction_hash || '',
    method: item.method,
  }))
}

export interface BitmapDashboard {
  address: string
  totalCount: number
  items: BitmapNft[]
  nextPageParams: Record<string, string | number> | null
  transfers: BitmapTransfer[]
}

export async function fetchBitmapDashboard(
  address: string,
): Promise<BitmapDashboard> {
  const [totalCount, gallery, transfers] = await Promise.all([
    getBitmapHoldingCount(address),
    fetchBitmapGallery(address),
    getBitmapTransfers(address),
  ])

  return {
    address,
    totalCount,
    items: gallery.items,
    nextPageParams: gallery.nextPageParams,
    transfers,
  }
}
