import axios from 'axios'

export async function login(username: string, password: string) {
  const { data } = await axios.post('/api/auth/login/', { username, password })
  localStorage.setItem('access_token', data.access)
  localStorage.setItem('refresh_token', data.refresh)
  return data
}

export async function logout() {
  const refresh = localStorage.getItem('refresh_token')
  try {
    const token = localStorage.getItem('access_token')
    await axios.post('/api/auth/logout/', { refresh }, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } finally {
    localStorage.clear()
  }
}
