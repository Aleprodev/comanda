import { Navigate, Route, Routes } from 'react-router-dom'
import Chat from './pages/Chat.jsx'
import Panel from './pages/Panel.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/pedir" element={<Chat />} />
      <Route path="/panel" element={<Panel />} />
      <Route path="*" element={<Navigate to="/pedir" replace />} />
    </Routes>
  )
}
