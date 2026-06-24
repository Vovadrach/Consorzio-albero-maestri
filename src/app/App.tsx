import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Agenda } from "@/pages/Agenda";
import { Anagrafiche } from "@/pages/Anagrafiche";
import { Brandbook } from "@/pages/Brandbook";
import { Cantiere } from "@/pages/Cantiere";
import { ClienteScheda } from "@/pages/ClienteScheda";
import { CreaLavoro } from "@/pages/CreaLavoro";
import { Dashboard } from "@/pages/Dashboard";
import { Garage } from "@/pages/Garage";
import { Impostazioni } from "@/pages/Impostazioni";
import { Kitchen } from "@/pages/Kitchen";
import { NuovoCliente } from "@/pages/NuovoCliente";
import { NuovoOperaio } from "@/pages/NuovoOperaio";
import { OperaioScheda } from "@/pages/OperaioScheda";
import { PortaleCliente } from "@/pages/PortaleCliente";
import { Soldi } from "@/pages/Soldi";
import { avviaSync } from "@/db/sync";
import { useStore } from "@/store/store";

function Splash() {
  return (
    <div className="grana flex min-h-dvh items-center justify-center">
      <p className="font-display text-2xl text-fumo-2">Albero Maestri…</p>
    </div>
  );
}

// Il portale cliente (/c/:token) è un'esperienza isolata: niente bootstrap operatore.
const isPortaleCliente = typeof window !== "undefined" && window.location.pathname.startsWith("/c/");

export function App() {
  const carica = useStore((s) => s.carica);
  const pronto = useStore((s) => s.pronto);

  useEffect(() => {
    if (!isPortaleCliente) void carica().then(() => avviaSync());
  }, [carica]);

  if (isPortaleCliente) {
    return (
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <Routes>
            <Route path="/c/:token" element={<PortaleCliente />} />
          </Routes>
        </BrowserRouter>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      {!pronto ? (
        <Splash />
      ) : (
        <BrowserRouter>
          <Routes>
            <Route path="/_kitchen" element={<Kitchen />} />
            <Route path="/brandbook" element={<Brandbook />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Agenda />} />
              <Route path="/soldi" element={<Soldi />} />
              <Route path="/anagrafiche" element={<Anagrafiche />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/garage" element={<Garage />} />
              <Route path="/nuovo" element={<CreaLavoro />} />
              <Route path="/lavoro/:id" element={<Cantiere />} />
              <Route path="/cliente/nuovo" element={<NuovoCliente />} />
              <Route path="/cliente/:id" element={<ClienteScheda />} />
              <Route path="/operaio/nuovo" element={<NuovoOperaio />} />
              <Route path="/operaio/:id" element={<OperaioScheda />} />
              <Route path="/impostazioni" element={<Impostazioni />} />
            </Route>
          </Routes>
        </BrowserRouter>
      )}
    </MotionConfig>
  );
}
