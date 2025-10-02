import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import BackButton from '../components/BackButton';

export default function Profile() {
  const { user, updateProfile, logout } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        bio: user.bio || '',
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateProfile(formData);
      alert('Profile updated successfully!');
    } catch (_error) {
      alert('Failed to update profile.');
    }
  };

  if (!user) {
    return (
      <div id="main-content" className="py-24 px-6 flex flex-col items-center w-full min-h-screen relative">
        <BackButton className="absolute top-4 left-4" />
        <h1 className="text-center text-4xl font-bold mb-8">Profile</h1>
        <p>Please log in to view your profile.</p>
      </div>
    );
  }

  return (
    <div id="main-content" className="py-24 px-6 flex flex-col items-center w-full min-h-screen relative">
      <BackButton className="absolute top-4 left-4" />
      <h1 className="text-center text-4xl font-bold mb-8">Profile</h1>
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
        <form onSubmit={handleSubmit} aria-labelledby="profile-form">
          <fieldset className="space-y-6">
            <legend id="profile-form" className="text-lg font-semibold mb-4">User Profile</legend>

            <div>
              <label htmlFor="name" className="block text-base font-medium mb-2">Full Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-base font-medium mb-2">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="bio" className="block text-base font-medium mb-2">Bio</label>
              <textarea
                id="bio"
                name="bio"
                rows="3"
                value={formData.bio}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
            >
              Save Profile
            </button>
          </fieldset>
        </form>
        <button
          onClick={logout}
          className="w-full mt-4 px-4 py-3 bg-red-600 text-white rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 font-medium"
        >
          Logout
        </button>
      </div>
    </div>
  );
}