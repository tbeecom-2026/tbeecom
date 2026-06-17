import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2 } from "lucide-react";

type Mode = "signin" | "signup";

export default function Login() {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Si déjà connecté, on dégage vers le CRM (ou la route demandée initialement).
  useEffect(() => {
    if (!authLoading && user) {
      const from = (location.state as any)?.from as string | undefined;
      navigate(from && from.startsWith("/") && !from.startsWith("/login") ? from : "/dashboard", { replace: true });
    }
  }, [authLoading, user, location.state, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let error: Error | null = null;
    if (mode === "signin") {
      const result = await signIn(email, password);
      error = result.error;
    } else {
      const result = await signUp(name, email, password);
      error = result.error;
    }

    setLoading(false);
    if (error) {
      toast({
        title: mode === "signin" ? "Erreur de connexion" : "Erreur d'inscription",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/dashboard");
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setName("");
    setEmail("");
    setPassword("");
  };

  const isSignUp = mode === "signup";
  const submitLabel = isSignUp
    ? loading
      ? "Création..."
      : "Créer un compte"
    : loading
      ? "Connexion..."
      : "Se connecter";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-xl bg-primary/20">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">FDC Manager</CardTitle>
          <p className="text-muted-foreground text-sm">Gestion de cession de fonds de commerce</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Nom</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Jean Dupont"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="agent@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {submitLabel}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-sm text-primary hover:underline"
            >
              {isSignUp ? "Déjà un compte ? Se connecter" : "Créer un compte"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
