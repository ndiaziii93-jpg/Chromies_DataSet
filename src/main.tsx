import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SignIn } from './screens/SignIn';
import { NavProvider } from './state/nav';
import { ScorebookProvider, useSession } from './state/store';
import { isConfigured } from './state/supabase';
import { initUpdates } from './state/updates';

function Root() {
  const { session, signIn, clear } = useSession();

  // Without a Supabase project there is nothing to sign in to: the app runs
  // single-device with full rights, exactly as the prototype did.
  if (isConfigured && !session) return <SignIn onSignIn={signIn} />;

  return (
    <ScorebookProvider session={session} onSignOut={clear}>
      <NavProvider>
        <App />
      </NavProvider>
    </ScorebookProvider>
  );
}

initUpdates();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
