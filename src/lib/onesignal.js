import OneSignal from 'react-onesignal'

let initialized = false

export async function initOneSignal() {
  if (initialized) return
  await OneSignal.init({
    appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
    serviceWorkerParam: { scope: '/' },
  })
  initialized = true
}

export async function registerPushUser(userId) {
  await OneSignal.login(userId)
  const playerId = await OneSignal.User.PushSubscription.id
  return playerId ?? null
}
