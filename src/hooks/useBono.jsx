import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { currentMonthStart } from '../lib/utils'

export function useBono(userId) {
  return useQuery({
    queryKey: ['bono', userId],
    queryFn: async () => {
      const month = currentMonthStart()

      const [bonoRes, userRes] = await Promise.all([
        supabase
          .from('user_bonos')
          .select('*, bonos(name, max_classes)')
          .eq('user_id', userId)
          .eq('month', month)
          .maybeSingle(),
        supabase
          .from('users')
          .select('recurring_bono_id')
          .eq('id', userId)
          .single(),
      ])

      if (bonoRes.error) throw bonoRes.error
      if (bonoRes.data) return bonoRes.data

      // Sin registro mensual pero tiene bono recurrente → mostrar como pendiente
      const recurringBonoId = userRes.data?.recurring_bono_id
      if (recurringBonoId) {
        const { data: bonoData } = await supabase
          .from('bonos')
          .select('name, max_classes')
          .eq('id', recurringBonoId)
          .single()
        if (bonoData) {
          return { classes_used: 0, is_pending: true, bonos: bonoData }
        }
      }

      return null
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  })
}
