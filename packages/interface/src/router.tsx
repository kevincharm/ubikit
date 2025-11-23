import { createRootRouteWithContext, createRoute, createRouter } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import App from './App'
import { RootLayout } from './components/RootLayout'

type RouterContext = {
    queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
    component: RootLayout,
})

const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: App,
})

const routeTree = rootRoute.addChildren([indexRoute])

export const createAppRouter = (queryClient: QueryClient) =>
    createRouter({
        routeTree,
        context: { queryClient },
    })

export type AppRouter = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
    interface Register {
        router: AppRouter
    }
}
