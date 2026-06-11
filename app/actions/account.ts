'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Permanently deletes the signed-in user's account. Removing the auth user
 * cascades through public.users to every user-owned table (all FKs are
 * ON DELETE CASCADE), so this is a full wipe.
 */
export async function deleteAccount(confirmation: string) {
  if (confirmation !== 'DELETE') {
    throw new Error('Confirmation text did not match')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) throw new Error(`Account deletion failed: ${error.message}`)

  await supabase.auth.signOut()
  redirect('/landing')
}
