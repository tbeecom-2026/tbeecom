import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAcces } from "@/hooks/useAcces";
import { usePresence } from "@/hooks/usePresence";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut, ShieldAlert, Loader2 } from "lucide-react";

export default function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const { authorized, loading: accesLoading } = useAcces();
  usePresence();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground">Chargement...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (accesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <h1 className="text-xl font-bold">Accès non autorisé</h1>
          <p className="text-sm text-muted-foreground">
            Le compte <span className="font-medium text-foreground">{user.email}</span> n'est pas autorisé à accéder à TBEECOM.
            Merci de contacter l'administrateur :{" "}
            <a href="mailto:bertrand.menesguen@tbeecom.com" className="text-primary underline">
              bertrand.menesguen@tbeecom.com
            </a>
          </p>
          <Button onClick={signOut} variant="outline" className="w-full">
            <LogOut className="mr-2 h-4 w-4" /> Déconnexion
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border px-4 bg-card">
            <SidebarTrigger className="mr-4" />
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
