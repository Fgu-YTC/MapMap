import {
  BitgetConnector,
  BybitConnector,
  ConnectProvider,
  OKXConnector,
  TokenPocketConnector,
  UnisatConnector,
  XverseConnector,
} from '@particle-network/btc-connectkit'
import { Merlin } from '@particle-network/chains'
import { useEffect, type ReactNode } from 'react'

const projectId = import.meta.env.VITE_PARTICLE_PROJECT_ID as string
const clientKey = import.meta.env.VITE_PARTICLE_CLIENT_KEY as string
const appId = import.meta.env.VITE_PARTICLE_APP_ID as string

const connectors = [
  new UnisatConnector(),
  new OKXConnector(),
  new BitgetConnector(),
  new TokenPocketConnector(),
  new BybitConnector(),
  new XverseConnector(),
]

export default function ParticleConnectInner({
  children,
  onReady,
}: {
  children: ReactNode
  onReady?: () => void
}) {
  useEffect(() => {
    onReady?.()
  }, [onReady])

  return (
    <ConnectProvider
      autoConnect={false}
      options={{
        projectId,
        clientKey,
        appId,
        aaOptions: {
          accountContracts: {
            BTC: [
              {
                chainIds: [Merlin.id],
                version: '1.0.0',
              },
            ],
          },
        },
        walletOptions: {
          visible: false,
        },
      }}
      connectors={connectors}
    >
      {children}
    </ConnectProvider>
  )
}
