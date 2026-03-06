import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xbwrvdryjzdlkrxzzoby.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhid3J2ZHJ5anpkbGtyeHp6b2J5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3OTY0MDAsImV4cCI6MjA4ODM3MjQwMH0.E5ellL36Tq18OmUM7w10GRkvGUVojBV6z0F6MScf3jU'

export const supabase = createClient(supabaseUrl, supabaseKey)