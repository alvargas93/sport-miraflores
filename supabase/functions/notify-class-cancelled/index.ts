const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_ids, class_title, starts_at } = await req.json()

    if (!user_ids?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const date = new Date(starts_at)
    const dayStr = new Intl.DateTimeFormat('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid',
    }).format(date)
    const timeStr = new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
    }).format(date)

    const message = `La clase ${class_title} del ${dayStr} a las ${timeStr} ha sido cancelada. Tu clase ha sido devuelta al bono.`

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Deno.env.get('ONESIGNAL_API_KEY')}`,
      },
      body: JSON.stringify({
        app_id: Deno.env.get('ONESIGNAL_APP_ID'),
        include_external_user_ids: user_ids,
        contents: { es: message, en: message },
        headings: { es: 'Sport Miraflores', en: 'Sport Miraflores' },
      }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      status: res.ok ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
