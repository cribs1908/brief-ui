import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supa = getSupabaseAdmin();

    // Get user's workspace
    const { data: workspace } = await supa
      .from('workspaces')
      .select('id')
      .eq('clerk_user_id', userId)
      .single();

    if (!workspace) {
      // Return empty list if no workspace exists yet
      return NextResponse.json({ files: [] });
    }

    // Get all documents from user's runs (using new schema)
    const { data: documents, error } = await supa
      .from('documents_new')
      .select(`
        id,
        filename,
        storage_path,
        pages,
        created_at,
        runs_new!inner(workspace_id)
      `)
      .eq('runs_new.workspace_id', workspace.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching user files:', error);
      return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 });
    }

    // Format files for frontend (using new schema fields)
    const files = documents?.map(doc => ({
      id: doc.id,
      filename: doc.filename,
      fileSize: 0, // Not available in new schema
      fileHash: null, // Not available in new schema
      storagePath: doc.storage_path,
      pages: doc.pages,
      createdAt: doc.created_at,
      displaySize: doc.pages ? `${doc.pages} pages` : 'Unknown size',
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