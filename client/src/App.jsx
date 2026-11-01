import { Navigate, Route, Routes } from 'react-router-dom'
import Chat from './pages/Chat.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/pedir" element={<Chat />} />
      <Route path="*" element={<Navigate to="/pedir" replace />} />
    </Routes>
  )
}
