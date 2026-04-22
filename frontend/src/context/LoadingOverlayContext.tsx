import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { FullPageLoader } from '../components/FullPageLoader'

type LoadingOverlayContextValue = {
  /** Shows full-page loader until the promise settles (then/catch/finally). Safe for concurrent calls. */
  trackPromise: (p: Promise<unknown>) => void
}

const LoadingOverlayContext = createContext<LoadingOverlayContextValue | null>(null)

export function LoadingOverlayProvider({ children }: { children: ReactNode }) {
  const depthRef = useRef(0)
  const [visible, setVisible] = useState(false)

  const sync = () => setVisible(depthRef.current > 0)

  const trackPromise = useCallback((p: Promise<unknown>) => {
    depthRef.current += 1
    sync()
    p.finally(() => {
      depthRef.current = Math.max(0, depthRef.current - 1)
      sync()
    })
  }, [])

  const value = useMemo(() => ({ trackPromise }), [trackPromise])

  useEffect(() => {
    if (!visible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [visible])

  return (
    <LoadingOverlayContext.Provider value={value}>
      {children}
      {visible ? <FullPageLoader /> : null}
    </LoadingOverlayContext.Provider>
  )
}

export function useLoadingOverlay() {
  const ctx = useContext(LoadingOverlayContext)
  if (!ctx) throw new Error('useLoadingOverlay must be used within LoadingOverlayProvider')
  return ctx
}
