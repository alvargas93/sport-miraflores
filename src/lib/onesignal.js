let initialized = false

export async function initOneSignal() {
  if (initialized) return

  await new Promise((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
        })
        initialized = true
        resolve()
      } catch (err) {
        reject(new Error('init [' + window.location.hostname + ']: ' + (err?.message ?? String(err))))
      }
    })
  })
}

export async function registerPushUser(userId) {
  const OneSignal = window.OneSignal
  if (!OneSignal) throw new Error('SDK no cargado')

  try {
    await OneSignal.login(userId)
  } catch (err) {
    throw new Error('login: ' + (err?.message ?? String(err)))
  }

  try {
    await OneSignal.Notifications.requestPermission()
  } catch (err) {
    throw new Error('requestPermission: ' + (err?.message ?? String(err)))
  }

  return OneSignal.User?.PushSubscription?.id ?? null
}
