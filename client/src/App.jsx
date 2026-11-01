import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Chat from './pages/Chat.jsx'
import Panel from './pages/Panel.jsx'
import Login from './pages/Login.jsx'
import RequireAdmin from './components/RequireAdmin.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/pedir" element={<Chat />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/panel"
        element={
          <RequireAdmin>
            <Panel />
          </RequireAdmin>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
