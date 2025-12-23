import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut } from "lucide-react";
import { MessagesContainer } from "@/components/messaging/MessagesContainer";

export default function StudentMessages() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl text-foreground">
              Zot<span className="text-accent">Hub</span>
            </span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link to="/student/dashboard">
              <Button variant="ghost" size="sm">Dashboard</Button>
            </Link>
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground mt-1">
            Communicate with clubs about opportunities and events
          </p>
        </div>
        
        <MessagesContainer className="h-[calc(100vh-220px)] min-h-[500px]" />
      </main>
    </div>
  );
}
