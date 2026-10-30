/**
 * Routes and user flow:
 *   /            landing          ─► /signup ─► /welcome (onboarding) ─► /app
 *   /login       returning users  ─────────────────────────────────────► /app
 *   /app/*       workspace (Briefing, Explore, Forecast, Alerts, Model insights, Verification, Preferences).
 *                Visitors without an account enter as a guest; nothing is gated behind sign-up.
 *   /admin       read-only operations view for server-designated administrators
 */
import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration } from "react-router-dom";
import { RequireAuth, RequireOnboarded, SessionRefresh, SignOut, ThemeSync } from "./auth/guards";
import { Spinner } from "./components/ui";
import Landing from "./pages/public/Landing";
import NotFound, { RouteError } from "./pages/NotFound";

const Login = lazy(() => import("./pages/public/Login"));
const Signup = lazy(() => import("./pages/public/Signup"));
const Welcome = lazy(() => import("./pages/Welcome"));
const AppShell = lazy(() => import("./pages/app/AppShell"));
const Overview = lazy(() => import("./pages/app/Overview"));
const Districts = lazy(() => import("./pages/app/Districts"));
const Forecast = lazy(() => import("./pages/app/Forecast"));
const Models = lazy(() => import("./pages/app/Models"));
const Alerts = lazy(() => import("./pages/app/Alerts"));
const Verification = lazy(() => import("./pages/app/Verification"));
const Admin = lazy(() => import("./pages/admin/Admin"));
const Settings = lazy(() => import("./pages/app/Settings"));

function Root() {
  return (
    <>
      <ThemeSync />
      <SessionRefresh />
      <Suspense fallback={<Spinner />}>
        <Outlet />
      </Suspense>
      <ScrollRestoration />
    </>
  );
}

const page = (el: React.ReactNode) => <Suspense fallback={<Spinner label="Loading page" />}>{el}</Suspense>;

const routes = [
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      { path: "/", element: <Landing /> },
      { path: "/landing", element: <Navigate to="/" replace /> },
      { path: "/login", element: page(<Login />) },
      { path: "/signup", element: page(<Signup />) },
      { path: "/logout", element: <SignOut /> },
      { path: "/welcome", element: <RequireAuth>{page(<Welcome />)}</RequireAuth> },
      { path: "/admin", element: page(<Admin />) },
      {
        path: "/app",
        element: (
          <RequireAuth>
            <RequireOnboarded>
              <AppShell />
            </RequireOnboarded>
          </RequireAuth>
        ),
        errorElement: <RouteError />,
        children: [
          { index: true, element: page(<Overview />) },
          { path: "districts", element: page(<Districts />) },
          { path: "stations", element: <Navigate to="/app/districts" replace /> },
          { path: "forecast", element: page(<Forecast />) },
          { path: "models", element: page(<Models />) },
          { path: "alerts", element: page(<Alerts />) },
          { path: "verification", element: page(<Verification />) },
          { path: "settings", element: page(<Settings />) },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
];

const router = createBrowserRouter(routes);

export default function App() {
  return <RouterProvider router={router} />;
}
