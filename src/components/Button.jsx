import { useNavigate } from "react-router-dom";

function Button({ text, route, onClick, disabled = false }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (route) {
      navigate(route);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`px-4 py-4 bg-[#d1d0d4] w-full rounded-xl shadow-lg text-2xl font-semibold transition-shadow hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
      aria-label={text}
    >
      {text}
    </button>
  );
}

export default Button;
