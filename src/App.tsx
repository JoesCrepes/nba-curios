import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import TwoPointPct from './pages/TwoPointPct'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/two-point-percentage" element={<TwoPointPct />} />
      </Routes>
    </BrowserRouter>
  )
}
