import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  fetchBitmapDashboard,
  fetchBitmapGallery,
  tokenInstanceUrl,
  type BitmapDashboard,
  type BitmapNft,
  type BitmapTransfer,
} from '../api/bitmap'
import { isValidAddress, SCAN_URL } from '../api/merlin'
import { truncateAddress } from '../utils/format'
import AaWalletButton from '../wallet/AaWalletButton'
import { useAaStatus } from '../wallet/ParticleProvider'

const STORAGE_KEY = 'mapmap:last-address'
const DEMO_HOLDER = '0x00cE02dB856Bb0301E1eeB0b0d68B7696F70093C'
const PARTICLE_DASHBOARD = 'https://dashboard.particle.network'

type Props = {
  onOpenGallery?: () => void
}

export default function Dashboard({ onOpenGallery }: Props) {
  const [query, setQuery] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '')
  const [dashboard, setDashboard] = useState<BitmapDashboard | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [walletKind, setWalletKind] = useState<'aa' | 'evm' | 'manual' | null>(
    null,
  )

  const loadDashboard = useCallback(
    async (address: string, kind: 'aa' | 'evm' | 'manual' = 'manual') => {
      setLoading(true)
      setError(null)
      setDashboard(null)
      setWalletKind(kind)
      try {
        const data = await fetchBitmapDashboard(address)
        setDashboard(data)
        localStorage.setItem(STORAGE_KEY, address)
        setQuery(address)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : '載入儀表板失敗')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && isValidAddress(saved)) {
      void loadDashboard(saved, 'manual')
    }
  }, [loadDashboard])

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    const value = query.trim()
    if (!value) {
      setError('請輸入錢包地址')
      return
    }
    if (!isValidAddress(value)) {
      setError('地址格式不正確（需為 0x 開頭的 42 字元）')
      return
    }
    void loadDashboard(value, 'manual')
  }

  async function connectEvmWallet() {
    const eth = (
      window as Window & {
        ethereum?: {
          request: (args: {
            method: string
            params?: unknown[]
          }) => Promise<unknown>
        }
      }
    ).ethereum

    if (!eth) {
      setError('找不到 EVM 錢包。請安裝 MetaMask，或改用 AA / 貼上地址。')
      return
    }

    setConnecting(true)
    setError(null)
    try {
      const accounts = (await eth.request({
        method: 'eth_requestAccounts',
      })) as string[]
      const account = accounts[0]
      if (!account) throw new Error('未取得錢包地址')

      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x1068' }],
        })
      } catch (switchErr: unknown) {
        const code = (switchErr as { code?: number })?.code
        if (code === 4902) {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x1068',
                chainName: 'Merlin Mainnet',
                nativeCurrency: {
                  name: 'Bitcoin',
                  symbol: 'BTC',
                  decimals: 18,
                },
                rpcUrls: ['https://rpc.merlinchain.io'],
                blockExplorerUrls: ['https://scan.merlinchain.io'],
              },
            ],
          })
        }
      }

      await loadDashboard(account, 'evm')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '連接錢包失敗')
    } finally {
      setConnecting(false)
    }
  }

  const aaStatus = useAaStatus()

  function promptParticleSetup() {
    if (aaStatus.failed) {
      setError(
        `AA SDK 在目前 Vite 環境載入失敗（${aaStatus.failMessage || 'unknown'}）。請改從 Merlin Bridge 複製你的 AA Smart Account 地址貼上查詢。`,
      )
      return
    }
    setError(
      `尚未設定 Particle AA 金鑰。請到 ${PARTICLE_DASHBOARD} 建立專案，把 Project ID / Client Key / App ID 填進 .env 後重啟 dev server。`,
    )
  }

  async function loadMore() {
    if (!dashboard?.nextPageParams || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await fetchBitmapGallery(
        dashboard.address,
        dashboard.nextPageParams,
      )
      setDashboard((prev) => {
        if (!prev) return prev
        const seen = new Set(prev.items.map((n) => n.id))
        const fresh = page.items.filter((n) => !seen.has(n.id))
        return {
          ...prev,
          items: [...prev.items, ...fresh],
          nextPageParams: page.nextPageParams,
        }
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '載入更多失敗')
    } finally {
      setLoadingMore(false)
    }
  }

  const ids =
    dashboard?.items.map((n) => Number(n.id)).filter(Number.isFinite) ?? []
  const minId = ids.length ? Math.min(...ids) : null
  const maxId = ids.length ? Math.max(...ids) : null

  return (
    <>
      <section className={`hero ${dashboard ? 'hero-compact' : 'hero-bitmap'}`}>
        <p className="eyebrow">My Bitmap</p>
        <h1>我的 Bitmap 儀表板</h1>
        <p className="lede">
          支援 Merlin AA（Particle BTC Connect：UniSat / OKX / Bitget…）與 EVM
          錢包，也可直接貼上地址。
        </p>

        <form className="search" onSubmit={handleSearch}>
          <label className="sr-only" htmlFor="dash-address">
            錢包地址
          </label>
          <input
            id="dash-address"
            type="text"
            spellCheck={false}
            autoComplete="off"
            placeholder="貼上 0x 地址…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setError(null)
            }}
          />
          <button type="submit" disabled={loading}>
            {loading ? '載入中…' : '開啟'}
          </button>
        </form>

        <div className="dash-actions">
          {aaStatus.ready ? (
            <AaWalletButton
              disabled={loading}
              onAccount={(addr) => void loadDashboard(addr, 'aa')}
              onDisconnect={() => {
                setDashboard(null)
                setWalletKind(null)
                setQuery('')
                setError(null)
                localStorage.removeItem(STORAGE_KEY)
              }}
            />
          ) : (
            <button
              type="button"
              className="ghost ghost-aa"
              onClick={promptParticleSetup}
            >
              連接 AA 錢包
            </button>
          )}
          <button
            type="button"
            className="ghost"
            onClick={connectEvmWallet}
            disabled={connecting || loading}
          >
            {connecting ? '連接中…' : '連接 EVM 錢包'}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => void loadDashboard(DEMO_HOLDER, 'manual')}
            disabled={loading}
          >
            試用示範地址
          </button>
          {onOpenGallery && (
            <button type="button" className="demo" onClick={onOpenGallery}>
              逛公開圖庫 →
            </button>
          )}
        </div>
      </section>

      {error && <div className="banner error">{error}</div>}

      {loading && (
        <div className="panel loading-panel" aria-live="polite">
          <div className="spinner" />
          <p>正在彙整你的 Bitmap 持倉…</p>
        </div>
      )}

      {dashboard && !loading && (
        <section className="results dash-results">
          <div className="address-bar">
            <div>
              <span className="label">
                {walletKind === 'aa'
                  ? 'Merlin AA Smart Account'
                  : walletKind === 'evm'
                    ? 'EVM Wallet'
                    : 'Address'}
              </span>
              <p className="mono address-full">{dashboard.address}</p>
              <p className="mono address-short">
                {truncateAddress(dashboard.address, 8)}
              </p>
            </div>
            <div className="address-actions">
              <a
                className="ghost"
                href={`${SCAN_URL}/address/${dashboard.address}`}
                target="_blank"
                rel="noreferrer"
              >
                Merlin Scan ↗
              </a>
            </div>
          </div>

          <div className="balance-row bitmap-stats">
            <div>
              <span className="label">持有 Bitmap</span>
              <p className="stat">{dashboard.totalCount.toLocaleString()}</p>
            </div>
            <div>
              <span className="label">已載入預覽</span>
              <p className="stat">{dashboard.items.length.toLocaleString()}</p>
            </div>
            <div>
              <span className="label">編號區間</span>
              <p className="stat-range mono">
                {minId != null && maxId != null
                  ? `#${minId.toLocaleString()} – #${maxId.toLocaleString()}`
                  : '—'}
              </p>
            </div>
            <div>
              <span className="label">近期動態</span>
              <p className="stat">{dashboard.transfers.length}</p>
            </div>
          </div>

          <div className="dash-panels">
            <div className="dash-panel">
              <div className="gallery-head">
                <h2>持倉預覽</h2>
                <p className="muted">
                  {dashboard.totalCount === 0
                    ? '尚無 M-Bitmap'
                    : `共 ${dashboard.totalCount.toLocaleString()} 筆`}
                </p>
              </div>

              {dashboard.items.length === 0 ? (
                <p className="empty">這個地址目前沒有 M-Bitmap</p>
              ) : (
                <>
                  <BitmapGrid items={dashboard.items} />
                  {dashboard.nextPageParams &&
                    dashboard.items.length < dashboard.totalCount && (
                      <div className="load-more">
                        <button
                          type="button"
                          onClick={loadMore}
                          disabled={loadingMore}
                        >
                          {loadingMore ? '載入中…' : '載入更多持倉'}
                        </button>
                      </div>
                    )}
                </>
              )}
            </div>

            <div className="dash-panel">
              <div className="gallery-head">
                <h2>近期轉入 / 轉出</h2>
                <p className="muted">M-Bitmap 相關紀錄</p>
              </div>
              <TransferFeed
                transfers={dashboard.transfers}
                address={dashboard.address}
              />
            </div>
          </div>
        </section>
      )}
    </>
  )
}

function BitmapGrid({ items }: { items: BitmapNft[] }) {
  return (
    <div className="bitmap-grid">
      {items.map((nft) => (
        <a
          key={nft.id}
          className="bitmap-card"
          href={tokenInstanceUrl(nft.id)}
          target="_blank"
          rel="noreferrer"
        >
          <div className="bitmap-visual">
            {nft.imageUrl ? (
              <img
                src={nft.imageUrl}
                alt={nft.name}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.parentElement
                    ?.querySelector('.bitmap-fallback')
                    ?.classList.add('show')
                }}
              />
            ) : null}
            <div
              className={`bitmap-fallback ${nft.imageUrl ? '' : 'show'}`}
              aria-hidden
            >
              <span>#{nft.id}</span>
            </div>
          </div>
          <div className="bitmap-meta">
            <strong>{nft.name}</strong>
            <span className="mono">#{nft.id}</span>
          </div>
        </a>
      ))}
    </div>
  )
}

function TransferFeed({
  transfers,
  address,
}: {
  transfers: BitmapTransfer[]
  address: string
}) {
  if (transfers.length === 0) {
    return <p className="empty">尚無近期 Bitmap 轉帳</p>
  }

  const me = address.toLowerCase()

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>方向</th>
            <th>Token ID</th>
            <th>對象</th>
            <th>時間</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((t, i) => {
            const incoming = t.to.toLowerCase() === me
            const peer = incoming ? t.from : t.to
            const mint =
              t.from === '0x0000000000000000000000000000000000000000'
            const dir = mint ? 'mint' : incoming ? 'in' : 'out'
            const label = mint ? 'MINT' : incoming ? 'IN' : 'OUT'
            const time = new Date(t.timestamp)
            return (
              <tr key={`${t.txHash}-${t.tokenId}-${i}`}>
                <td>
                  <span className={`pill ${dir === 'mint' ? 'self' : dir}`}>
                    {label}
                  </span>
                </td>
                <td>
                  <a
                    className="mono"
                    href={tokenInstanceUrl(t.tokenId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    #{t.tokenId}
                  </a>
                </td>
                <td>
                  {mint ? (
                    <span className="muted">mint</span>
                  ) : (
                    <a
                      className="mono"
                      href={`${SCAN_URL}/address/${peer}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {truncateAddress(peer, 4)}
                    </a>
                  )}
                </td>
                <td title={time.toLocaleString('zh-TW')}>
                  {formatIsoRelative(t.timestamp)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function formatIsoRelative(iso: string): string {
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return '—'
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return '剛剛'
  if (mins < 60) return `${mins} 分鐘前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小時前`
  const days = Math.floor(hours / 24)
  if (days < 365) return `${days} 天前`
  return new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium' }).format(
    new Date(ms),
  )
}
