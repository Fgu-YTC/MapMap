import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { lazy, Suspense } from 'react'
import AaErrorBoundary from './AaErrorBoundary'

const projectId = import.meta.env.VITE_PARTICLE_PROJECT_ID as string | undefined
const clientKey = import.meta.env.VITE_PARTICLE_CLIENT_KEY as string | undefined
const appId = import.meta.env.VITE_PARTICLE_APP_ID as string | undefined

export function hasParticleConfig(): boolean {
  return Boolean(projectId && clientKey && appId)
}

type AaStatus = {
  configured: boolean
  ready: boolean
  failed: boolean
  failMessage: string | null
}

const AaStatusContext = createContext<AaStatus>({
  configured: false,
  ready: false,
  failed: false,
  failMessage: null,
})

export function useAaStatus() {
  return useContext(AaStatusContext)
}

const LazyParticleConnect = lazy(() => import('./ParticleConnectInner'))

type Props = { children: ReactNode }

export default function ParticleProvider({ children }: Props) {
  const configured = useMemo(() => hasParticleConfig(), [])
  const [failed, setFailed] = useState(false)
  const [failMessage, setFailMessage] = useState<string | null>(null)
  const [ready, setReady] = useState(!configured)

  const status = useMemo<AaStatus>(
    () => ({
      configured,
      ready: configured ? ready && !failed : false,
      failed,
      failMessage,
    }),
    [configured, ready, failed, failMessage],
  )

  if (!configured) {
    return (
      <AaStatusContext.Provider value={status}>{children}</AaStatusContext.Provider>
    )
  }

  return (
    <AaStatusContext.Provider value={status}>
      <AaErrorBoundary
        fallback={children}
        onError={(message) => {
          setFailed(true)
          setFailMessage(message)
          setReady(false)
        }}
      >
        <Suspense
          fallback={
            <div className="aa-boot">
              <div className="spinner" />
              <p>載入 Merlin AA SDK…</p>
            </div>
          }
        >
          <LazyParticleConnect
            onReady={() => {
              setReady(true)
              setFailed(false)
            }}
          >
            {children}
          </LazyParticleConnect>
        </Suspense>
      </AaErrorBoundary>
    </AaStatusContext.Provider>
  )
}
