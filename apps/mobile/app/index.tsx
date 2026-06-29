import { Redirect } from 'expo-router'
import { useAuthStore } from '../src/store/useAuthStore'

export default function Index() {
  const user = useAuthStore(s => s.user)
  return <Redirect href={user ? '/(tabs)' : '/(auth)/login'} />
}
