export default defineEventHandler(() => {
  return {
    url: !!process.env.SUPABASE_URL,
    key: !!process.env.SUPABASE_KEY,
  }
})
