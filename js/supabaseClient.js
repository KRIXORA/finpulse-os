/* ==========================================================================
   FinPulse-OS — supabaseClient.js
   Loads the Supabase JS client straight from a CDN (no npm install needed —
   works entirely from the browser, phone-friendly).

   ⚠️ SETUP REQUIRED: paste your own Project URL and anon key below.
   Find them in Supabase: Project Settings > API
   ========================================================================== */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://ecaqeccwlnyqeoiyvuod.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYXFlY2N3bG55cWVvaXl2dW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NzQxNjksImV4cCI6MjEwMjQ1MDE2OX0.Gjb-9wtqjCSwuEYXLJ8Ejdc4Z-_G47NrPHfduXkZQEk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
