import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useClasses(date, userId) {
  return useQuery({
    queryKey: ['classes', date, userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_classes_for_day', {
        p_date: date,
        p_user_id: userId,
      })
      if (error) throw error
      return data ?? []
    },
    enabled: !!date && !!userId,
    staleTime: 1000 * 30,
  })
}
