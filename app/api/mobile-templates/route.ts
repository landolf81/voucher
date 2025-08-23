/**
 * Mobile Template Management API
 * Handles CRUD operations for mobile voucher design templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { z } from 'zod';

// Validation schemas
const createMobileTemplateSchema = z.object({
  template_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  background_color: z.string().default('#ffffff'),
  text_color: z.string().default('#000000'),
  accent_color: z.string().default('#3b82f6'),
  font_family: z.string().default('Pretendard, sans-serif'),
  font_size_base: z.number().int().min(8).max(72).default(14),
  width: z.number().int().min(200).max(800).default(400),
  height: z.number().int().min(200).max(800).default(400),
  padding: z.number().int().min(0).max(100).default(20),
  border_radius: z.number().int().min(0).max(50).default(12),
  background_image_url: z.string().url().optional().nullable(),
  background_image_position: z.string().default('center'),
  background_image_size: z.string().default('cover'),
  field_positions: z.record(z.any()).default({}),
  template_config: z.record(z.any()).default({}),
  status: z.enum(['active', 'inactive', 'draft']).default('active'),
  is_default: z.boolean().default(false)
});

const updateMobileTemplateSchema = createMobileTemplateSchema.partial();

/**
 * GET /api/mobile-templates
 * Fetch all mobile design templates
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('template_id');
    const status = searchParams.get('status');

    let query = supabase
      .from('mobile_design_templates')
      .select(`
        *,
        voucher_templates(
          id,
          voucher_name,
          voucher_type,
          status
        )
      `);

    // Apply filters
    if (templateId) {
      query = query.eq('template_id', templateId);
    }
    
    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Mobile templates fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch mobile templates' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('Mobile templates API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mobile-templates
 * Create a new mobile design template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Creating mobile template with data:', body);

    // Validate request data
    const validatedData = createMobileTemplateSchema.parse(body);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if voucher template exists
    const { data: voucherTemplate, error: voucherError } = await supabase
      .from('voucher_templates')
      .select('id')
      .eq('id', validatedData.template_id)
      .single();

    if (voucherError || !voucherTemplate) {
      return NextResponse.json(
        { error: 'Voucher template not found' },
        { status: 404 }
      );
    }

    // Check if mobile template already exists for this voucher template
    const { data: existingTemplate } = await supabase
      .from('mobile_design_templates')
      .select('id')
      .eq('template_id', validatedData.template_id)
      .single();

    if (existingTemplate) {
      return NextResponse.json(
        { error: 'Mobile template already exists for this voucher template' },
        { status: 409 }
      );
    }

    // If this is set as default, unset other defaults
    if (validatedData.is_default) {
      await supabase
        .from('mobile_design_templates')
        .update({ is_default: false })
        .eq('is_default', true);
    }

    // Create mobile template
    const { data, error } = await supabase
      .from('mobile_design_templates')
      .insert([validatedData])
      .select(`
        *,
        voucher_templates(
          id,
          voucher_name,
          voucher_type
        )
      `)
      .single();

    if (error) {
      console.error('Mobile template creation error:', error);
      return NextResponse.json(
        { error: 'Failed to create mobile template' },
        { status: 500 }
      );
    }

    // Log audit entry
    await supabase
      .from('audit_logs')
      .insert([{
        action: 'mobile_template_created',
        details: {
          template_id: data.id,
          name: data.name,
          voucher_template_id: data.template_id
        }
      }]);

    return NextResponse.json({
      success: true,
      data
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: error.errors 
        },
        { status: 400 }
      );
    }

    console.error('Mobile template creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/mobile-templates
 * Update existing mobile design template
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Validate update data
    const validatedData = updateMobileTemplateSchema.parse(updateData);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if template exists
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('mobile_design_templates')
      .select('id, name, template_id')
      .eq('id', id)
      .single();

    if (fetchError || !existingTemplate) {
      return NextResponse.json(
        { error: 'Mobile template not found' },
        { status: 404 }
      );
    }

    // If this is set as default, unset other defaults
    if (validatedData.is_default) {
      await supabase
        .from('mobile_design_templates')
        .update({ is_default: false })
        .eq('is_default', true)
        .neq('id', id);
    }

    // Update template
    const { data, error } = await supabase
      .from('mobile_design_templates')
      .update(validatedData)
      .eq('id', id)
      .select(`
        *,
        voucher_templates(
          id,
          voucher_name,
          voucher_type
        )
      `)
      .single();

    if (error) {
      console.error('Mobile template update error:', error);
      return NextResponse.json(
        { error: 'Failed to update mobile template' },
        { status: 500 }
      );
    }

    // Log audit entry
    await supabase
      .from('audit_logs')
      .insert([{
        action: 'mobile_template_updated',
        details: {
          template_id: id,
          name: data.name,
          changes: Object.keys(validatedData)
        }
      }]);

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: error.errors 
        },
        { status: 400 }
      );
    }

    console.error('Mobile template update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mobile-templates
 * Delete mobile design template
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if template exists and get info for audit log
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('mobile_design_templates')
      .select('id, name, is_default')
      .eq('id', id)
      .single();

    if (fetchError || !existingTemplate) {
      return NextResponse.json(
        { error: 'Mobile template not found' },
        { status: 404 }
      );
    }

    // Prevent deletion of default template
    if (existingTemplate.is_default) {
      return NextResponse.json(
        { error: 'Cannot delete default template' },
        { status: 400 }
      );
    }

    // Delete template
    const { error } = await supabase
      .from('mobile_design_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Mobile template deletion error:', error);
      return NextResponse.json(
        { error: 'Failed to delete mobile template' },
        { status: 500 }
      );
    }

    // Log audit entry
    await supabase
      .from('audit_logs')
      .insert([{
        action: 'mobile_template_deleted',
        details: {
          template_id: id,
          name: existingTemplate.name
        }
      }]);

    return NextResponse.json({
      success: true,
      message: 'Mobile template deleted successfully'
    });

  } catch (error) {
    console.error('Mobile template deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}