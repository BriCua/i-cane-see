import { useNavigate } from "react-router-dom";

function BackButton({ text = "Back", className = "" }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className={`px-4 py-2 bg-gray-600 text-white rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 font-medium transition-shadow ${className}`}
      aria-label={`Go back to previous page`}
    >
      {text}
    </button>
  );
}

export default BackButton;