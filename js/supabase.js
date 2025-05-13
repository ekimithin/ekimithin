// js/supabase.js
// 🔗 Σύνδεση με Supabase (project: ekimithin)

// Εισαγωγή του Supabase client από CDN
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ✅ Supabase credentials (μόνο δημόσια δεδομένα)
const supabaseUrl = 'https://glsayujqzkevokaznnrd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsc2F5dWpxemtldm9rYXpubnJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1NTEyNTIsImV4cCI6MjA2MjEyNzI1Mn0.BwIA7WkJURpWiysRI-eSj8CcGIydP_SOyCDyE1HyDpI';

// 🔧 Δημιουργία Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);
