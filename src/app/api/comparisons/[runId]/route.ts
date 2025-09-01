import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// PUT - Update comparison title
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title } = await request.json();
    const resolvedParams = await params;
    const { runId } = resolvedParams;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
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

    // Update the run title if it belongs to the user's workspace
    const { data, error } = await supa
      .from('runs_new')
      .update({ title: title.trim() })
      .eq('id', runId)
      .eq('workspace_id', workspace.id)
      .select('id, title')
      .single();

    if (error) {
      console.error('❌ Error updating comparison title:', error);
      return NextResponse.json({ error: 'Failed to update title' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Comparison not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      title: data.title,
      message: 'Title updated successfully' 
    });

  } catch (error) {
    console.error('❌ Update title API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete comparison
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { runId } = resolvedParams;
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

    // Delete the run and all related data (cascade should handle related tables)
    const { error } = await supa
      .from('runs_new')
      .delete()
      .eq('id', runId)
      .eq('workspace_id', workspace.id);

    if (error) {
      console.error('❌ Error deleting comparison:', error);
      return NextResponse.json({ error: 'Failed to delete comparison' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Comparison deleted successfully' 
    });

  } catch (error) {
    console.error('❌ Delete comparison API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}