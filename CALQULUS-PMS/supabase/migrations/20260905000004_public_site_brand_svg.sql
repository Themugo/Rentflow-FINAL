-- Allow the configurable CALQULUS public brand mark to be uploaded as SVG.
-- The public-site configuration UI already supports SVG because property/building
-- marks are expected to remain sharp at any display density.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']
WHERE id = 'public-site-media';
