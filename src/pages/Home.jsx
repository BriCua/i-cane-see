import Button from "../components/Button";
import { useAuth } from "../contexts/AuthContext";

function Home() {
  const { isAuthenticated, user, logout, findMyCane, isTtsEnabled, enableTts, lastCaneMessage } = useAuth();

  return (
    <main id="main-content" className="py-10 px-6 flex flex-col items-center w-full min-h-screen">
      <h1 className="text-center text-7xl font-bold w-fit" id="main-heading">I Cane See</h1>
      {isAuthenticated && user && (
        <p className="text-center text-xl mt-4" role="status">Welcome back, {user.name}!</p>
      )}
      <nav aria-labelledby="main-heading" className="h-full w-full flex flex-col gap-8 mt-20 justify-start">
        {isAuthenticated ? (
          <>
            {!isTtsEnabled ? (
              <Button text="Enable Verbal Warnings" onClick={enableTts} aria-describedby="tts-desc" />
            ) : (
              <>
                <p className="text-center text-green-500">Verbal warnings are active.</p>
                <p className="text-center text-gray-500 mt-2 text-sm">
                  Last message: {lastCaneMessage === null ? 'None' : lastCaneMessage === '' ? '"" (Empty)' : lastCaneMessage}
                </p>
              </>
            )}
            <span id="tts-desc" className="sr-only">Click to enable text-to-speech for obstacle warnings.</span>
            
            <Button text="Settings" route="/settings" aria-describedby="settings-desc" />
            <span id="settings-desc" className="sr-only">Go to settings</span>
            <Button text="Profile" route="/profile" aria-describedby="profile-desc" />
            <span id="profile-desc" className="sr-only">Manage your profile</span>
            <Button text="Find my cane" onClick={findMyCane} aria-describedby="find-cane-desc" />
            <span id="find-cane-desc" className="sr-only">Find your cane</span>
            <Button text="Connect my cane" route="/connect-cane" aria-describedby="connect-cane-desc" />
            <span id="connect-cane-desc" className="sr-only">Connect a new cane</span>
            <Button text="Logout" onClick={logout} aria-describedby="logout-desc" />
            <span id="logout-desc" className="sr-only">Sign out</span>
          </>
        ) : (
          <>
            <Button text="Login" route="/login" aria-describedby="login-desc" />
            <span id="login-desc" className="sr-only">Navigate to the login page to sign in</span>
          </>
        )}
      </nav>
    </main>
  );
}

export default Home;