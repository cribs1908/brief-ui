import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/lib/env';

const supabase = createClient(ENV.supabaseUrl!, ENV.supabaseService!, { 
  auth: { persistSession: false },
  global: { headers: { Authorization: `Bearer ${ENV.supabaseService}` } }
});

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('clerk_user_id', userId)
      .single();

    if (!workspace) {
      // Return empty list if no workspace exists yet
      return NextResponse.json({ files: [] });
    }

    // Get all documents from user's runs
    const { data: documents, error } = await supabase
      .from('documents')
      .select(`
        id,
        filename,
        file_size,
        file_hash,
        storage_path,
        created_at,
        runs!inner(workspace_id)
      `)
      .eq('runs.workspace_id', workspace.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching user files:', error);
      return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
    }

    // Format files for frontend
    const files = documents?.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      fileSize: doc.file_size,
      fileHash: doc.file_hash,
      storagePath: doc.storage_path,
      createdAt: doc.created_at,
      displaySize: `${(doc.file_size / (1024 * 1024)).toFixed(1)} MB`,
      displayDate: new Date(doc.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-')
    })) || [];

    return NextResponse.json({ files });

  } catch (error) {
    console.error('❌ Files API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}