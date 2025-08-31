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
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    // Get the most recent completed run with results
    const { data: latestRun, error } = await supa
      .from('runs_new')
      .select(`
        id,
        status,
        created_at,
        results(id)
      `)
      .eq('workspace_id', workspace.id)
      .eq('status', 'READY')
      .not('results', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching latest run:', error);
      return NextResponse.json({ error: 'Failed to fetch latest run' }, { status: 500 });
    }

    if (!latestRun) {
      return NextResponse.json({ runId: null, message: 'No completed runs found' });
    }

    return NextResponse.json({ 
      runId: latestRun.id,
      status: latestRun.status,
      createdAt: latestRun.created_at
    });

  } catch (error) {
    console.error('❌ Latest run API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}