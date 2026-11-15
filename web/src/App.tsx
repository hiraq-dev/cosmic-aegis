import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Mental from "./pages/Mental";
import Musculoskeletal from "./pages/Musculoskeletal";
import Cardiovascular from "./pages/Cardiovascular";
import Console from "./pages/Console";
import Profile from "./pages/Profile";
import Sources from "./pages/Sources";
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

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <ScrollTop />
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Console />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="mental" element={<Mental />} />
            <Route path="musculoskeletal" element={<Musculoskeletal />} />
            <Route path="cardiovascular" element={<Cardiovascular />} />
            <Route path="profile" element={<Profile />} />
            <Route path="sources" element={<Sources />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
