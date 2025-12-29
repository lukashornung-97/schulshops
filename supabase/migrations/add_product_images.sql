-- Migration: Add image and print file fields to products table
-- Date: 2024-01-XX

-- Add Shopify Frontend image URLs
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_front_url text,
  ADD COLUMN IF NOT EXISTS image_back_url text,
  ADD COLUMN IF NOT EXISTS image_side_url text;

-- Add print file URLs (for printing)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS print_file_front_url text,
  ADD COLUMN IF NOT EXISTS print_file_back_url text,
  ADD COLUMN IF NOT EXISTS print_file_side_url text;

-- Add comments for documentation
COMMENT ON COLUMN public.products.image_front_url IS 'URL to front image for Shopify frontend';
COMMENT ON COLUMN public.products.image_back_url IS 'URL to back image for Shopify frontend';
COMMENT ON COLUMN public.products.image_side_url IS 'URL to side image for Shopify frontend';
COMMENT ON COLUMN public.products.print_file_front_url IS 'URL to print file (front) for production';
COMMENT ON COLUMN public.products.print_file_back_url IS 'URL to print file (back) for production';
COMMENT ON COLUMN public.products.print_file_side_url IS 'URL to print file (side) for production';











