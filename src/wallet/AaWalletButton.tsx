import { lazy, Suspense } from 'react'

const LazyAaButton = lazy(() => import('./AaWalletButtonInner'))

type Props = {
  onAccount: (address: string) => void
  onDisconnect?: () => void
  disabled?: boolean
}

export default function AaWalletButton(props: Props) {
  return (
    <Suspense
      fallback={
        <button type="button" className="ghost ghost-aa" disabled>
          載入 AA…
        </button>
      }
    >
      <LazyAaButton {...props} />
    </Suspense>
  )
}
