import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Biens from "@/pages/Biens";
import NouveauBien from "@/pages/NouveauBien";
import MandatDetail from "@/pages/MandatDetail";
import RegistreMandats from "@/pages/RegistreMandats";
import NouveauMandat from "@/pages/NouveauMandat";
import MandatsAValider from "@/pages/MandatsAValider";
import Contacts from "@/pages/Contacts";
import ContactDetail from "@/pages/ContactDetail";
import Activites from "@/pages/Activites";
import Parametres from "@/pages/Parametres";
import NotFound from "@/pages/NotFound";
import PublicLayout from "@/components/public/PublicLayout";
import Accueil from "@/pages/public/Accueil";
import NosBiens from "@/pages/public/NosBiens";
import BienDetailPublic from "@/pages/public/BienDetail";
import Vendre from "@/pages/public/Vendre";
import Acheter from "@/pages/public/Acheter";
import Agence from "@/pages/public/Agence";
import ContactPublic from "@/pages/public/Contact";
import Mentions from "@/pages/public/Mentions";
const queryClient = new QueryClient();
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Espace PUBLIC (sans authentification) */}
            <Route path="/landingpage" element={<PublicLayout />}>
              <Route index element={<Accueil />} />
              <Route path="biens" element={<NosBiens />} />
              <Route path="biens/:reference" element={<BienDetailPublic />} />
              <Route path="vendre" element={<Vendre />} />
              <Route path="acheter" element={<Acheter />} />
              <Route path="agence" element={<Agence />} />
              <Route path="contact" element={<ContactPublic />} />
              <Route path="mentions" element={<Mentions />} />
            </Route>

            <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="biens" element={<Biens />} />
              <Route path="biens/nouveau" element={<NouveauBien />} />
              <Route path="biens/:id" element={<MandatDetail />} />
              <Route path="mandats" element={<RegistreMandats />} />
              <Route path="mandats/nouveau" element={<NouveauMandat />} />
              <Route path="mandats/:id/edit" element={<NouveauMandat />} />
              <Route path="mandats/:id/avenant" element={<NouveauMandat />} />
              <Route path="mandats/a-valider" element={<MandatsAValider />} />
              <Route path="mandats/:id" element={<MandatDetail />} />
              <Route path="contacts" element={<Contacts />} />
              <Route path="contacts/:id" element={<ContactDetail />} />
              <Route path="activites" element={<Activites />} />
              <Route path="parametres" element={<Parametres />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
export default App;
