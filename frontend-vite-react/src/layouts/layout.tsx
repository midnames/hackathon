import { Outlet, NavLink } from 'react-router-dom';
import { ModeToggle } from '@/components/mode-toggle';

export const MainLayout = () => {
  return (
    <div className="min-h-screen flex flex-col font-body">
      <header className="bg-background border-b">
        <div className="container mx-auto flex items-center justify-between py-4">
          <div>
            <NavLink to="/" className="block">
              <h1 className="font-headline text-2xl md:text-3xl tracking-wide">REBELS</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Decentralized, censorship‑resistant newsroom</p>
            </NavLink>
          </div>
          <nav className="flex items-center gap-5">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `text-sm font-medium transition hover:text-foreground ${
                  isActive ? 'text-foreground underline underline-offset-4 decoration-accent' : 'text-muted-foreground'
                }`
              }
              end
            >
              Headlines
            </NavLink>
            <NavLink
              to="/drop"
              className={({ isActive }) =>
                `text-sm font-medium transition hover:text-foreground ${
                  isActive ? 'text-foreground underline underline-offset-4 decoration-accent' : 'text-muted-foreground'
                }`
              }
            >
              Freedom Vault
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `text-sm font-medium transition hover:text-foreground ${
                  isActive ? 'text-foreground underline underline-offset-4 decoration-accent' : 'text-muted-foreground'
                }`
              }
            >
              Settings
            </NavLink>
            <ModeToggle />
          </nav>
        </div>
      </header>
      <main className="container mx-auto flex-1 py-8">
        <Outlet />
      </main>
    </div>
  );
};