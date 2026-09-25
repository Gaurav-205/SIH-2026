/**
 * Routes and user flow:
 *   /            landing          ─► /signup ─► /welcome (onboarding) ─► /app
 *   /login       returning users  ─────────────────────────────────────► /app
 *   /app/*       signed-in workspace (Overview, Stations, Forecast, Models, Alerts, Verification, Settings)
 */
import { lazy, Suspense } from "react";
import { createBrowserRouter, createHashRouter, Outlet, RouterProvider, ScrollRestoration } from "react-router-dom";
import { RedirectIfSignedIn, RequireAuth, RequireOnboarded, SessionRefresh, SignOut, ThemeSync } from "./auth/guards";
import { Spinner } from "./components/ui";
import Landing from "./pages/public/Landing";
import NotFound, { RouteError } from "./pages/NotFound";

const Login = lazy(() => import("./pages/public/Login"));
const Signup = lazy(() => import("./pages/public/Signup"));
const Welcome = lazy(() => import("./pages/Welcome"));
const AppShell = lazy(() => import("./pages/app/AppShell"));
const Overview = lazy(() => import("./pages/app/Overview"));
const Stations = lazy(() => import("./pages/app/Stations"));
const Forecast = lazy(() => import("./pages/app/Forecast"));
const Models = lazy(() => import("./pages/app/Models"));
const Alerts = lazy(() => import("./pages/app/Alerts"));
const Verification = lazy(() => import("./pages/app/Verification"));
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
      { path: "/login", element: <RedirectIfSignedIn><Login /></RedirectIfSignedIn> },
      { path: "/signup", element: <RedirectIfSignedIn><Signup /></RedirectIfSignedIn> },
      { path: "/logout", element: <SignOut /> },
      { path: "/welcome", element: <RequireAuth><Welcome /></RequireAuth> },
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
          { path: "stations", element: page(<Stations />) },
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

// Single-file builds (offline demo) use hash routing; normal builds use clean URLs.
const router = import.meta.env.MODE === "single" ? createHashRouter(routes) : createBrowserRouter(routes);

export default function App() {
  return <RouterProvider router={router} />;
}
