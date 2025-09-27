import { useNavigate } from "react-router-dom";
import Button from "../components/Button";
import { useAuth } from "../contexts/AuthContext";

function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <main id="main-content" className="py-18 px-6 flex flex-col items-center w-full min-h-screen" role="main">
      <h1 className="text-center text-7xl font-bold w-fit" id="main-heading">I Cane See</h1>
      {isAuthenticated && user && (
        <p className="text-center text-xl mt-4" role="status">Welcome back, {user.name}!</p>
      )}
      <nav aria-labelledby="main-heading" className="h-full w-full flex flex-col gap-8 mt-20 justify-start">
        {isAuthenticated ? (
          <>
            <Button text="Settings" route="/settings" aria-describedby="settings-desc" />
            <span id="settings-desc" className="sr-only">Navigate to the settings page to adjust app preferences</span>
            <Button text="Profile" route="/profile" aria-describedby="profile-desc" />
            <span id="profile-desc" className="sr-only">Navigate to the profile page to manage your account information</span>
            <Button text="Find my cane" aria-describedby="find-cane-desc" />
            <span id="find-cane-desc" className="sr-only">Activate cane finding feature</span>
            <Button text="Logout" onClick={logout} aria-describedby="logout-desc" />
            <span id="logout-desc" className="sr-only">Sign out of your account</span>
          </>
        ) : (
          <>
            <Button text="Login" route="/login" aria-describedby="login-desc" />
            <span id="login-desc" className="sr-only">Navigate to the login page to sign in</span>
            <Button text="Find my cane" aria-describedby="find-cane-desc" />
            <span id="find-cane-desc" className="sr-only">Activate cane finding feature</span>
          </>
        )}
      </nav>
    </main>
  );
}

export default Home;
