import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import { StoreProvider } from "./lib/store";

function ScrollTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView(), 50);
      return;
    }
    window.scrollTo(0, 0); // braces matter: an effect must not return the call's result
  }, [pathname, hash]);
  return null;
}

// Old menu URLs still work: they jump to the matching section of the single page.
const OLD: Record<string, string> = { live: "live", console: "console", scan: "", mental: "mental", musculoskeletal: "musculoskeletal", cardiovascular: "cardiovascular", profile: "profile", sources: "sources" };

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <ScrollTop />
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            {Object.entries(OLD).map(([p, h]) => <Route key={p} path={p} element={<Navigate to={h ? `/#${h}` : "/"} replace />} />)}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
