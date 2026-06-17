import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://rmmigmxlfssgzqqnydsj.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtbWlnbXhsZnNzZ3pxcW55ZHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2NTY0OTcsImV4cCI6MjA5NzIzMjQ5N30.VHlXTDGLt7hrtB609VqdSMu12geZphjWbPViXapfNWI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
