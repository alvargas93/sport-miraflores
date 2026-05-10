import OneSignal from 'react-onesignal'

export async function initOneSignal() {
  await OneSignal.init({
    appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
    serviceWorkerParam: { scope: '/' },
  })
}

export async function registerPushUser(userId) {
  await OneSignal.login(userId)
  const playerId = await OneSignal.User.PushSubscription.id
  return playerId
}
