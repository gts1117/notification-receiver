import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();
  return (
    <nav className="w-full bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
      <div className="text-xl font-bold text-cyan-300 tracking-tight">
        Notification Receiver
      </div>
      <div className="flex gap-6 text-base">
        <Link
          to="/"
          className={`hover:text-cyan-300 transition-colors ${location.pathname === '/' ? 'text-cyan-300 font-semibold' : 'text-gray-200'}`}
        >
          Home
        </Link>
        <Link
          to="/dashboard"
          className={`hover:text-cyan-300 transition-colors ${location.pathname === '/dashboard' ? 'text-cyan-300 font-semibold' : 'text-gray-200'}`}
        >
          Dashboard
        </Link>
      </div>
    </nav>
  );
} 