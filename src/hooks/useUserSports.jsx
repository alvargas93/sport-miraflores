import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useUserSports(userId) {
  return useQuery({
    queryKey: ['user-sports', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_sports')
        .select('sports ( id, name, slug )')
        .eq('user_id', userId)

      if (error) throw error
      return (data ?? []).map((row) => row.sports)
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10,
  })
}
