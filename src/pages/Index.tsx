import { isSupabaseConfigured } from '@/lib/supabaseClient';

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-foreground">FDC Manager</h1>
        <p className={`text-lg ${isSupabaseConfigured ? 'text-green-600' : 'text-muted-foreground'}`}>
          {isSupabaseConfigured
            ? '✅ Connexion Supabase OK'
            : '⚠️ Supabase non configuré'}
        </p>
      </div>
    </div>
  );
};

export default Index;
