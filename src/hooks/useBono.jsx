import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { currentMonthStart } from '../lib/utils'

export function useBono(userId) {
  return useQuery({
    queryKey: ['bono', userId],
    queryFn: async () => {
      const month = currentMonthStart()
      const { data, error } = await supabase
        .from('user_bonos')
        .select('*, bonos(name, max_classes)')
        .eq('user_id', userId)
        .eq('month', month)
        .single()
      if (error && error.code !== 'PGRST116') throw error
      return data ?? null
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  })
}
