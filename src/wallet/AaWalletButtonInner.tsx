import {
  useBTCProvider,
  useConnectModal,
  useETHProvider,
} from '@particle-network/btc-connectkit'
import { Merlin } from '@particle-network/chains'
import { useEffect, useRef } from 'react'
import { truncateAddress } from '../utils/format'

type Props = {
  onAccount: (address: string) => void
  onDisconnect?: () => void
  disabled?: boolean
}

function clearAaSession() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key) continue
      const lower = key.toLowerCase()
      if (
        lower.includes('particle') ||
        lower.includes('btc-connect') ||
        lower.includes('btcconnect') ||
        lower.includes('unisat') ||
        lower.includes('okx')
      ) {
        keys.push(key)
      }
    }
    for (const key of keys) localStorage.removeItem(key)

    const sessionKeys: string[] = []
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i)
      if (!key) continue
      const lower = key.toLowerCase()
      if (lower.includes('particle') || lower.includes('btc-connect')) {
        sessionKeys.push(key)
      }
    }
    for (const key of sessionKeys) sessionStorage.removeItem(key)
  } catch {
    // ignore storage access errors
  }
}

export default function AaWalletButtonInner({
  onAccount,
  onDisconnect,
  disabled,
}: Props) {
  const { openConnectModal, disconnect } = useConnectModal()
  const { account, switchChain, chainId } = useETHProvider()
  const { accounts: btcAccounts } = useBTCProvider()
  const lastLoaded = useRef<string | null>(null)

  useEffect(() => {
    if (!account) {
      lastLoaded.current = null
      return
    }
    if (lastLoaded.current?.toLowerCase() === account.toLowerCase()) return
    lastLoaded.current = account
    onAccount(account)
  }, [account, onAccount])

  useEffect(() => {
    if (!account) return
    if (chainId === Merlin.id) return
    void switchChain(Merlin.id).catch(() => undefined)
  }, [account, chainId, switchChain])

  function handleDisconnect() {
    disconnect?.()
    clearAaSession()
    lastLoaded.current = null
    onDisconnect?.()
  }

  if (account) {
    return (
      <div className="aa-connected">
        <span className="aa-badge">AA</span>
        <span className="mono aa-addr" title={account}>
          {truncateAddress(account, 4)}
        </span>
        {btcAccounts?.[0] && (
          <span className="muted aa-btc" title={btcAccounts[0]}>
            BTC {truncateAddress(btcAccounts[0], 4)}
          </span>
        )}
        <button type="button" className="ghost" onClick={handleDisconnect}>
          斷開 AA
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      className="ghost ghost-aa"
      onClick={() => openConnectModal?.()}
      disabled={disabled || !openConnectModal}
    >
      連接 AA 錢包
    </button>
  )
}
