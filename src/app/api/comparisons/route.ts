import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Fetch all user's comparisons
export async function GET() {
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

    // Get all completed runs with results
    const { data: comparisons, error } = await supa
      .from('runs_new')
      .select(`
        id,
        domain,
        title,
        created_at,
        results_new(id)
      `)
      .eq('workspace_id', workspace.id)
      .eq('status', 'READY')
      .not('results_new', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching comparisons:', error);
      return NextResponse.json({ error: 'Failed to fetch comparisons' }, { status: 500 });
    }

    console.log(`📋 Found ${comparisons?.length || 0} comparisons in database:`, comparisons);

    // Format for frontend
    const formattedComparisons = (comparisons || []).map(comp => ({
      runId: comp.id,
      domain: comp.domain || 'UNKNOWN', 
      title: comp.title || getDefaultTitle(comp.domain || 'UNKNOWN'),
      createdAt: new Date(comp.created_at).toLocaleDateString(),
      documentCount: 2 // TODO: Get actual document count from documents table
    }));

    console.log(`📋 Formatted comparisons:`, formattedComparisons);

    return NextResponse.json({ comparisons: formattedComparisons });

  } catch (error) {
    console.error('❌ Comparisons API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Save a new comparison (called when comparison completes)
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { runId, domain, title, documentCount } = await request.json();

    if (!runId || !domain) {
      return NextResponse.json({ error: 'runId and domain required' }, { status: 400 });
    }

    const supa = getSupabaseAdmin();

    // Get user's workspace to verify ownership
    const { data: workspace } = await supa
      .from('workspaces')
      .select('id')
      .eq('clerk_user_id', userId)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    // Update the run with title and ensure it belongs to user's workspace
    const { error: updateError } = await supa
      .from('runs_new')
      .update({ 
        title: title || getDefaultTitle(domain),
        domain: domain,
        workspace_id: workspace.id
      })
      .eq('id', runId);

    if (updateError) {
      console.error('❌ Error saving comparison:', updateError);
      return NextResponse.json({ error: 'Failed to save comparison' }, { status: 500 });
    }

    console.log(`✅ Successfully saved comparison: runId=${runId}, title="${title || getDefaultTitle(domain)}", domain=${domain}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Comparison saved successfully' 
    });

  } catch (error) {
    console.error('❌ Save comparison API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getDefaultTitle(domain: string): string {
  const domainUpper = (domain || '').toUpperCase();
  switch (domainUpper) {
    case 'CHIP':
      return 'CHIP Comparison';
    case 'SAAS':
      return 'SAAS Comparison';
    case 'API':
      return 'API Comparison';
    default:
      return `${domainUpper} Comparison`;
  }
}