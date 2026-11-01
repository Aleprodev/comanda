const KEY = 'comanda.admin'

export const getToken = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}
export const setToken = (token) => localStorage.setItem(KEY, token)
export const clearToken = () => {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* sin almacenamiento: nada que borrar */
  }
}
