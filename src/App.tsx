import { useEffect, useState, type FormEvent } from 'react'
import {
  BITMAP_CONTRACT,
  fetchBitmapGallery,
  getBitmapCollection,
  GALLERY_SEED_HOLDER,
  tokenInstanceUrl,
  type BitmapCollection,
  type BitmapNft,
} from './api/bitmap'
import {
  fetchAddressData,
  isValidAddress,
  SCAN_URL,
  type AddressData,
  type TokenBalance,
  type TokenTransfer,
  type Transaction,
} from './api/merlin'
import Dashboard from './components/Dashboard'
import WorldMap from './components/WorldMap'
import {
  formatRelative,
  formatTimestamp,
  formatTokenAmount,
  formatUsd,
  formatWei,
  truncateAddress,
  weiToUsd,
} from './utils/format'
import './App.css'

type View = 'dashboard' | 'map' | 'gallery' | 'explorer'
type Tab = 'tx' | 'tokens' | 'transfers'

const DEMO_ADDRESS = '0x0000000000000000000000000000000000000000'

export default function App() {
  const [view, setView] = useState<View>('dashboard')

  return (
    <div className="app">
      <div className="bg-grid" aria-hidden />
      <div className="bg-glow" aria-hidden />

      <header className="topbar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault()
            setView('dashboard')
          }}
        >
          <span className="brand-mark" aria-hidden />
          MapMap
        </a>
        <nav className="nav">
          <button
            type="button"
            className={view === 'dashboard' ? 'nav-active' : ''}
            onClick={() => setView('dashboard')}
          >
            我的儀表板
          </button>
          <button
            type="button"
            className={view === 'map' ? 'nav-active' : ''}
            onClick={() => setView('map')}
          >
            大地圖
          </button>
          <button
            type="button"
            className={view === 'gallery' ? 'nav-active' : ''}
            onClick={() => setView('gallery')}
          >
            圖庫
          </button>
          <button
            type="button"
            className={view === 'explorer' ? 'nav-active' : ''}
            onClick={() => setView('explorer')}
          >
            Explorer
          </button>
          <a
            className="scan-link"
            href={`${SCAN_URL}/token/${BITMAP_CONTRACT}`}
            target="_blank"
            rel="noreferrer"
          >
            Merlin Scan ↗
          </a>
        </nav>
      </header>

      <main className={`main ${view === 'map' ? 'main-wide' : ''}`}>
        {view === 'dashboard' && (
          <Dashboard onOpenGallery={() => setView('gallery')} />
        )}
        {view === 'map' && <WorldMap />}
        {view === 'gallery' && <BitmapView />}
        {view === 'explorer' && <ExplorerView />}
      </main>

      <footer className="footer">
        資料來源{' '}
        <a href={`${SCAN_URL}/api-docs`} target="_blank" rel="noreferrer">
          Merlin BlockScout API
        </a>
        {' · '}
        M-Bitmap{' '}
        <a
          href={`${SCAN_URL}/token/${BITMAP_CONTRACT}`}
          target="_blank"
          rel="noreferrer"
          className="mono"
        >
          {truncateAddress(BITMAP_CONTRACT, 4)}
        </a>
      </footer>
    </div>
  )
}

function BitmapView() {
  const [collection, setCollection] = useState<BitmapCollection | null>(null)
  const [items, setItems] = useState<BitmapNft[]>([])
  const [nextParams, setNextParams] = useState<Record<
    string,
    string | number
  > | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ownerQuery, setOwnerQuery] = useState('')
  const [ownerMode, setOwnerMode] = useState(false)
  const [activeOwner, setActiveOwner] = useState(GALLERY_SEED_HOLDER)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      getBitmapCollection(),
      fetchBitmapGallery(activeOwner),
    ])
      .then(([col, gallery]) => {
        if (cancelled) return
        setCollection(col)
        setItems(gallery.items)
        setNextParams(gallery.nextPageParams)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '載入 Bitmap 失敗')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeOwner])

  async function loadMore() {
    if (!nextParams || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await fetchBitmapGallery(activeOwner, nextParams)
      setItems((prev) => {
        const seen = new Set(prev.map((n) => n.id))
        const fresh = page.items.filter((n) => !seen.has(n.id))
        return [...prev, ...fresh]
      })
      setNextParams(page.nextPageParams)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '載入更多失敗')
    } finally {
      setLoadingMore(false)
    }
  }

  function searchOwner(e: FormEvent) {
    e.preventDefault()
    const value = ownerQuery.trim()
    if (!value) {
      setError('請輸入持有者地址')
      return
    }
    if (!isValidAddress(value)) {
      setError('地址格式不正確')
      return
    }
    setError(null)
    setOwnerMode(true)
    setItems([])
    setNextParams(null)
    setActiveOwner(value)
  }

  function resetGallery() {
    setOwnerMode(false)
    setOwnerQuery('')
    setItems([])
    setNextParams(null)
    setActiveOwner(GALLERY_SEED_HOLDER)
  }

  return (
    <>
      <section className="hero hero-bitmap">
        <p className="eyebrow">Merlin Chain · ERC-721</p>
        <h1>Merlin&apos;s Seal Bitmap</h1>
        <p className="lede">
          展示梅林鏈上橋接的 Bitmap 數位地塊（M-Bitmap）。
        </p>

        <form className="search" onSubmit={searchOwner}>
          <label className="sr-only" htmlFor="owner">
            持有者地址
          </label>
          <input
            id="owner"
            type="text"
            spellCheck={false}
            autoComplete="off"
            placeholder="查某個地址持有的 Bitmap…"
            value={ownerQuery}
            onChange={(e) => {
              setOwnerQuery(e.target.value)
              setError(null)
            }}
          />
          <button type="submit">查詢</button>
        </form>

        {ownerMode && (
          <button type="button" className="demo" onClick={resetGallery}>
            回到精選圖庫
          </button>
        )}
      </section>

      {collection && (
        <div className="balance-row bitmap-stats">
          <div>
            <span className="label">Collection</span>
            <p className="stat-name">{collection.name}</p>
            <p className="hint">{collection.symbol}</p>
          </div>
          <div>
            <span className="label">總供應量</span>
            <p className="stat">
              {Number(collection.total_supply).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="label">持有人數</span>
            <p className="stat">
              {Number(collection.holders).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="label">合約</span>
            <a
              className="mono contract-link"
              href={`${SCAN_URL}/token/${BITMAP_CONTRACT}`}
              target="_blank"
              rel="noreferrer"
            >
              {truncateAddress(BITMAP_CONTRACT, 6)}
            </a>
          </div>
        </div>
      )}

      {error && <div className="banner error">{error}</div>}

      {loading && (
        <div className="panel loading-panel" aria-live="polite">
          <div className="spinner" />
          <p>正在載入 Merlin Bitmap…</p>
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <p className="empty">此地址沒有持有 M-Bitmap</p>
      )}

      {!loading && items.length > 0 && (
        <section className="gallery">
          <div className="gallery-head">
            <h2>{ownerMode ? '持有的 Bitmap' : '精選 Bitmap'}</h2>
            <p className="muted">
              顯示 {items.length} 筆
              {ownerMode ? '' : ' · 來自鏈上持倉樣本'}
            </p>
          </div>

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

          {nextParams && (
            <div className="load-more">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? '載入中…' : '載入更多'}
              </button>
            </div>
          )}
        </section>
      )}
    </>
  )
}

function ExplorerView() {
  const [query, setQuery] = useState('')
  const [address, setAddress] = useState<string | null>(null)
  const [data, setData] = useState<AddressData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('tx')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!address) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)

    fetchAddressData(address)
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '查詢失敗')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [address])

  function handleSearch(raw?: string) {
    const value = (raw ?? query).trim()
    if (!value) {
      setError('請輸入錢包地址')
      return
    }
    if (!isValidAddress(value)) {
      setError('地址格式不正確（需為 0x 開頭的 42 字元）')
      return
    }
    setQuery(value)
    setAddress(value)
    setTab('tx')
  }

  async function copyAddress() {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const balanceMerl = data ? formatWei(data.balanceWei, 6) : null
  const balanceUsd =
    data != null
      ? formatUsd(weiToUsd(data.balanceWei, data.coinPrice.coin_usd))
      : null

  return (
    <>
      <section className={`hero ${address ? 'hero-compact' : ''}`}>
        <p className="eyebrow">Merlin Chain</p>
        <h1>Address Explorer</h1>
        <p className="lede">
          查詢 Merlin 鏈上地址餘額、交易與 Token 持倉。
        </p>

        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault()
            handleSearch()
          }}
        >
          <label className="sr-only" htmlFor="address">
            錢包地址
          </label>
          <input
            id="address"
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
            {loading ? '查詢中…' : '查詢'}
          </button>
        </form>

        {!address && (
          <button
            type="button"
            className="demo"
            onClick={() => handleSearch(DEMO_ADDRESS)}
          >
            試用示範地址
          </button>
        )}
      </section>

      {error && <div className="banner error">{error}</div>}

      {loading && (
        <div className="panel loading-panel" aria-live="polite">
          <div className="spinner" />
          <p>正在向 Merlin Scan 拉取資料…</p>
        </div>
      )}

      {address && data && !loading && (
        <section className="results">
          <div className="address-bar">
            <div>
              <span className="label">Address</span>
              <p className="mono address-full">{address}</p>
              <p className="mono address-short">
                {truncateAddress(address, 8)}
              </p>
            </div>
            <div className="address-actions">
              <button type="button" className="ghost" onClick={copyAddress}>
                {copied ? '已複製' : '複製'}
              </button>
              <a
                className="ghost"
                href={`${SCAN_URL}/address/${address}`}
                target="_blank"
                rel="noreferrer"
              >
                在 Scan 開啟 ↗
              </a>
            </div>
          </div>

          <div className="balance-row">
            <div>
              <span className="label">MERL 餘額</span>
              <p className="balance-value">
                {balanceMerl} <span>MERL</span>
              </p>
            </div>
            <div>
              <span className="label">約當 USD</span>
              <p className="balance-usd">{balanceUsd}</p>
              <p className="hint">
                @ ${Number(data.coinPrice.coin_usd).toLocaleString()} / MERL
              </p>
            </div>
            <div>
              <span className="label">持有 Token</span>
              <p className="stat">{data.tokens.length}</p>
            </div>
            <div>
              <span className="label">近期交易</span>
              <p className="stat">{data.transactions.length}</p>
            </div>
          </div>

          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'tx'}
              className={tab === 'tx' ? 'active' : ''}
              onClick={() => setTab('tx')}
            >
              交易 ({data.transactions.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'tokens'}
              className={tab === 'tokens' ? 'active' : ''}
              onClick={() => setTab('tokens')}
            >
              Token ({data.tokens.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'transfers'}
              className={tab === 'transfers' ? 'active' : ''}
              onClick={() => setTab('transfers')}
            >
              轉帳 ({data.transfers.length})
            </button>
          </div>

          {tab === 'tx' && (
            <TxTable transactions={data.transactions} address={address} />
          )}
          {tab === 'tokens' && <TokenTable tokens={data.tokens} />}
          {tab === 'transfers' && (
            <TransferTable transfers={data.transfers} address={address} />
          )}
        </section>
      )}
    </>
  )
}

function direction(
  from: string,
  to: string,
  address: string,
): 'in' | 'out' | 'self' {
  const a = address.toLowerCase()
  const f = from.toLowerCase()
  const t = to?.toLowerCase() ?? ''
  if (f === a && t === a) return 'self'
  if (f === a) return 'out'
  return 'in'
}

function TxTable({
  transactions,
  address,
}: {
  transactions: Transaction[]
  address: string
}) {
  if (transactions.length === 0) {
    return <Empty message="此地址尚無交易紀錄" />
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>方向</th>
            <th>Hash</th>
            <th>對象</th>
            <th>金額</th>
            <th>時間</th>
            <th>狀態</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const dir = direction(tx.from, tx.to, address)
            const peer = dir === 'out' ? tx.to : tx.from
            const ok = tx.isError === '0' && tx.txreceipt_status !== '0'
            return (
              <tr key={tx.hash}>
                <td>
                  <span className={`pill ${dir}`}>
                    {dir === 'in' ? 'IN' : dir === 'out' ? 'OUT' : 'SELF'}
                  </span>
                </td>
                <td>
                  <a
                    className="mono"
                    href={`${SCAN_URL}/tx/${tx.hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {truncateAddress(tx.hash, 4)}
                  </a>
                </td>
                <td>
                  <a
                    className="mono"
                    href={`${SCAN_URL}/address/${peer}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {truncateAddress(peer || '—', 4)}
                  </a>
                </td>
                <td className="mono">{formatWei(tx.value, 4)} MERL</td>
                <td title={formatTimestamp(tx.timeStamp)}>
                  {formatRelative(tx.timeStamp)}
                </td>
                <td>
                  <span className={`status ${ok ? 'ok' : 'fail'}`}>
                    {ok ? '成功' : '失敗'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TokenTable({ tokens }: { tokens: TokenBalance[] }) {
  if (tokens.length === 0) {
    return <Empty message="此地址沒有 Token 持倉" />
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Token</th>
            <th>合約</th>
            <th>餘額</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr key={token.contractAddress}>
              <td>
                <strong>{token.symbol || '—'}</strong>
                <span className="muted"> {token.name}</span>
              </td>
              <td>
                <a
                  className="mono"
                  href={`${SCAN_URL}/token/${token.contractAddress}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {truncateAddress(token.contractAddress, 4)}
                </a>
              </td>
              <td className="mono">
                {formatTokenAmount(token.balance, token.decimals)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TransferTable({
  transfers,
  address,
}: {
  transfers: TokenTransfer[]
  address: string
}) {
  if (transfers.length === 0) {
    return <Empty message="此地址尚無 Token 轉帳" />
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>方向</th>
            <th>Token</th>
            <th>數量</th>
            <th>對象</th>
            <th>時間</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((t, i) => {
            const dir = direction(t.from, t.to, address)
            const peer = dir === 'out' ? t.to : t.from
            return (
              <tr key={`${t.hash}-${i}`}>
                <td>
                  <span className={`pill ${dir}`}>
                    {dir === 'in' ? 'IN' : dir === 'out' ? 'OUT' : 'SELF'}
                  </span>
                </td>
                <td>
                  <strong>{t.tokenSymbol || '—'}</strong>
                </td>
                <td className="mono">
                  {formatTokenAmount(t.value, t.tokenDecimal)}
                </td>
                <td>
                  <a
                    className="mono"
                    href={`${SCAN_URL}/address/${peer}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {truncateAddress(peer || '—', 4)}
                  </a>
                </td>
                <td title={formatTimestamp(t.timeStamp)}>
                  {formatRelative(t.timeStamp)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return <p className="empty">{message}</p>
}
