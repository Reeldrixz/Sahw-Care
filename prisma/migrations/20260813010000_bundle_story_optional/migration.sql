-- The free-text "Your situation" story field is removed from the bundle
-- application flow. Keep the column for historical rows, but drop NOT NULL so
-- new applications can be created without it.
ALTER TABLE "BundleApplication" ALTER COLUMN "story" DROP NOT NULL;
