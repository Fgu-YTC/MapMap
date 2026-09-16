import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from 'react'
import {
  fetchBitmapGallery,
  GALLERY_SEED_HOLDER,
  tokenInstanceUrl,
  type BitmapNft,
} from '../api/bitmap'
import {
  blendWithNeighbors,
  terrainCss,
  terrainFromBitmapId,
  type TerrainProfile,
} from '../map/terrain'

const MAP_W = 24
const MAP_H = 16
const CELL = 56
const STORAGE_KEY = 'mapmap:world-v1'

export interface PlacedTile {
  bitmapId: string
  name: string
  imageUrl: string | null
}

type Grid = Record<string, PlacedTile> // "x,y" -> tile

function keyOf(x: number, y: number) {
  return `${x},${y}`
}

function loadGrid(): Grid {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Grid
  } catch {
    return {}
  }
}

export default function WorldMap() {
  const [grid, setGrid] = useState<Grid>(() => loadGrid())
  const [palette, setPalette] = useState<BitmapNft[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [customId, setCustomId] = useState('')
  const [loadingPalette, setLoadingPalette] = useState(true)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 40, y: 40 })
  const dragging = useRef<{
    ox: number
    oy: number
    sx: number
    sy: number
  } | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(grid))
  }, [grid])

  useEffect(() => {
    let cancelled = false
    setLoadingPalette(true)
    fetchBitmapGallery(GALLERY_SEED_HOLDER)
      .then((page) => {
        if (cancelled) return
        setPalette(page.items)
        if (page.items[0]) setSelectedId(page.items[0].id)
      })
      .catch(() => {
        if (!cancelled) setPalette([])
      })
      .finally(() => {
        if (!cancelled) setLoadingPalette(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selected = useMemo(() => {
    if (!selectedId) return null
    return (
      palette.find((p) => p.id === selectedId) ?? {
        id: selectedId,
        name: `${selectedId}.bitmap`,
        imageUrl: null,
        inscriptionId: null,
        inscriptionNumber: null,
        owner: null,
      }
    )
  }, [palette, selectedId])

  const profiles = useMemo(() => {
    const map = new Map<string, TerrainProfile>()
    for (const [k, tile] of Object.entries(grid)) {
      map.set(k, terrainFromBitmapId(tile.bitmapId))
    }
    return map
  }, [grid])

  const placeAt = useCallback(
    (x: number, y: number) => {
      if (!selected) return
      setGrid((prev) => ({
        ...prev,
        [keyOf(x, y)]: {
          bitmapId: selected.id,
          name: selected.name,
          imageUrl: selected.imageUrl,
        },
      }))
    },
    [selected],
  )

  const eraseAt = useCallback((x: number, y: number) => {
    setGrid((prev) => {
      const next = { ...prev }
      delete next[keyOf(x, y)]
      return next
    })
  }, [])

  function seedDemo() {
    const sample = palette.slice(0, 18)
    if (sample.length === 0) {
      // procedural ids if palette empty
      const demo: Grid = {}
      let i = 0
      for (let y = 5; y < 11; y += 1) {
        for (let x = 7; x < 15; x += 1) {
          const id = String(760000 + i * 17)
          demo[keyOf(x, y)] = {
            bitmapId: id,
            name: `${id}.bitmap`,
            imageUrl: null,
          }
          i += 1
        }
      }
      setGrid(demo)
      return
    }
    const next: Grid = { ...grid }
    let i = 0
    for (let y = 4; y < 10; y += 1) {
      for (let x = 6; x < 14; x += 1) {
        const nft = sample[i % sample.length]
        next[keyOf(x, y)] = {
          bitmapId: nft.id,
          name: nft.name,
          imageUrl: nft.imageUrl,
        }
        i += 1
      }
    }
    setGrid(next)
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    setScale((s) => Math.min(2.2, Math.max(0.45, s + delta)))
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return
    if (e.altKey || e.button === 1) {
      dragging.current = {
        ox: offset.x,
        oy: offset.y,
        sx: e.clientX,
        sy: e.clientY,
      }
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging.current) return
    const d = dragging.current
    setOffset({
      x: d.ox + (e.clientX - d.sx),
      y: d.oy + (e.clientY - d.sy),
    })
  }

  function onPointerUp() {
    dragging.current = null
  }

  const placedCount = Object.keys(grid).length
  const hoverKey = hover ? keyOf(hover.x, hover.y) : null
  const hoverTile = hoverKey ? grid[hoverKey] : null
  const hoverTerrain = hoverTile
    ? terrainFromBitmapId(hoverTile.bitmapId)
    : null

  return (
    <section className="world">
      <div className="world-hero">
        <p className="eyebrow">Bitmap Terrain</p>
        <h1>大地圖</h1>
        <p className="lede">
          每個 Bitmap 依編號長出不同地形。選一塊地塊，點格子拼接你的世界。
        </p>
      </div>

      <div className="world-layout">
        <aside className="world-side">
          <div className="world-panel">
            <h2>地塊庫</h2>
            <p className="muted small">
              選取後點地圖空格放置；右鍵清除。Alt + 拖曳平移，滾輪縮放。
            </p>

            <form
              className="world-id-form"
              onSubmit={(e) => {
                e.preventDefault()
                const id = customId.trim()
                if (!/^\d+$/.test(id)) return
                setSelectedId(id)
              }}
            >
              <input
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                placeholder="輸入 Bitmap 編號…"
                inputMode="numeric"
              />
              <button type="submit">選用</button>
            </form>

            <div className="world-actions">
              <button type="button" className="ghost" onClick={seedDemo}>
                產生示範地形
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setGrid({})}
              >
                清空地圖
              </button>
            </div>

            {loadingPalette ? (
              <p className="muted">載入地塊樣本…</p>
            ) : (
              <div className="world-palette">
                {palette.map((nft) => {
                  const t = terrainFromBitmapId(nft.id)
                  const active = selectedId === nft.id
                  return (
                    <button
                      key={nft.id}
                      type="button"
                      className={`world-swatch ${active ? 'active' : ''}`}
                      onClick={() => setSelectedId(nft.id)}
                      title={`${nft.name} · ${t.label}`}
                    >
                      <span
                        className="world-swatch-terrain"
                        style={terrainCss(t)}
                      />
                      {nft.imageUrl && (
                        <img src={nft.imageUrl} alt="" loading="lazy" />
                      )}
                      <span className="mono">#{nft.id}</span>
                      <span className="biome-tag">{t.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="world-panel world-stats">
            <div>
              <span className="label">已放置</span>
              <p className="stat">{placedCount}</p>
            </div>
            <div>
              <span className="label">地圖尺寸</span>
              <p className="stat-range mono">
                {MAP_W} × {MAP_H}
              </p>
            </div>
            {hoverTerrain && hoverTile && (
              <div className="world-inspect">
                <span className="label">游標格</span>
                <p>
                  #{hoverTile.bitmapId} · {hoverTerrain.label}
                </p>
                <a
                  href={tokenInstanceUrl(hoverTile.bitmapId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  在 Scan 開啟 ↗
                </a>
              </div>
            )}
          </div>
        </aside>

        <div className="world-stage">
          <div
            className="world-board"
            ref={boardRef}
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <div
              className="world-canvas"
              style={{
                width: MAP_W * CELL,
                height: MAP_H * CELL,
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              }}
            >
              {Array.from({ length: MAP_H }, (_, y) =>
                Array.from({ length: MAP_W }, (_, x) => {
                  const k = keyOf(x, y)
                  const tile = grid[k]
                  const terrain = tile ? profiles.get(k) : null
                  const neighbors: TerrainProfile[] = []
                  if (tile && terrain) {
                    for (const [dx, dy] of [
                      [1, 0],
                      [-1, 0],
                      [0, 1],
                      [0, -1],
                    ] as const) {
                      const nk = keyOf(x + dx, y + dy)
                      const nt = profiles.get(nk)
                      if (nt) neighbors.push(nt)
                    }
                  }
                  const blended =
                    terrain && neighbors.length
                      ? blendWithNeighbors(terrain, neighbors)
                      : terrain?.base

                  return (
                    <button
                      key={k}
                      type="button"
                      className={`world-cell ${tile ? 'filled' : 'empty'} ${hover?.x === x && hover?.y === y ? 'hover' : ''}`}
                      style={{
                        left: x * CELL,
                        top: y * CELL,
                        width: CELL,
                        height: CELL,
                        ...(terrain
                          ? {
                              ...terrainCss(terrain),
                              backgroundColor: blended,
                            }
                          : {}),
                      }}
                      onMouseEnter={() => setHover({ x, y })}
                      onMouseLeave={() => setHover(null)}
                      onClick={(e) => {
                        if (e.altKey) return
                        if (tile) return
                        placeAt(x, y)
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        eraseAt(x, y)
                      }}
                      title={
                        tile
                          ? `#${tile.bitmapId} · ${terrain?.label}`
                          : `空地 (${x},${y})`
                      }
                    >
                      {tile?.imageUrl && (
                        <img
                          className="world-cell-img"
                          src={tile.imageUrl}
                          alt=""
                          draggable={false}
                        />
                      )}
                      {tile && (
                        <span className="world-cell-id mono">
                          {tile.bitmapId.slice(-4)}
                        </span>
                      )}
                    </button>
                  )
                }),
              )}
            </div>
          </div>
          <p className="world-hint muted">
            提示：相鄰 Bitmap 會微調色調，拼出連續地形。佈局已自動存到本機。
          </p>
        </div>
      </div>
    </section>
  )
}
