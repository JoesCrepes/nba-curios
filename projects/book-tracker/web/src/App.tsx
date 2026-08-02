import { NavLink, Route, Routes } from 'react-router-dom'
import LibraryPage from './pages/LibraryPage.tsx'
import SearchPage from './pages/SearchPage.tsx'
import BookDetailPage from './pages/BookDetailPage.tsx'
import SettingsPage from './pages/SettingsPage.tsx'

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Book Tracker</span>
        <nav>
          <NavLink to="/" end>
            Library
          </NavLink>
          <NavLink to="/search">Search</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/books/:id" element={<BookDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}
