import { Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ConnectWalletButton } from './ConnectWalletButton'

export function RootLayout() {
    return (
        <div className="app-shell solo-layout">
            <header className="app-header">
                <ConnectWalletButton />
            </header>
            <main className="app-main">
                <Outlet />
            </main>
            {import.meta.env.DEV && (
                <>
                    <TanStackRouterDevtools position="bottom-right" />
                    <ReactQueryDevtools buttonPosition="bottom-left" />
                </>
            )}
        </div>
    )
}
