'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface UpdatePostData {
  title: string
  slug: string
  excerpt: string
  content: string
  status: string
}

export async function updatePost(id: string, data: UpdatePostData) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('posts')
    .update({
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: data.content,
      status: data.status,
      published_at: data.status === 'published' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  // Revalidar las páginas del blog para que muestren los cambios
  revalidatePath('/blog')
  revalidatePath(`/blog/${data.slug}`)
  revalidatePath('/admin/posts')
  
  return { success: true }
}