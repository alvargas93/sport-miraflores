import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useMyReservations(userId) {
  return useQuery({
    queryKey: ['my-reservations', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id,
          booked_at,
          classes (
            id,
            title,
            starts_at,
            ends_at,
            instructor,
            max_capacity,
            is_cancelled,
            sports ( name, slug )
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .order('booked_at', { ascending: false })

      if (error) throw error
      return data ?? []
    },
    enabled: !!userId,
    staleTime: 1000 * 60,
  })
}
