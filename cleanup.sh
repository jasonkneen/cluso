#!/bin/bash
# Comprehensive cleanup script for ai-cluso

cd "$(dirname "$0")"

# Create docs directory if it doesn't exist
mkdir -p docs/archive

# Move analysis/implementation docs to docs/archive
mv -f AGENTIC_ANALYSIS.md docs/archive/ 2>/dev/null
mv -f AGENTIC_FIXES.md docs/archive/ 2>/dev/null
mv -f IMPLEMENTATION_LOG.md docs/archive/ 2>/dev/null
mv -f IMPLEMENTATION_CHECKLIST.md docs/archive/ 2>/dev/null
mv -f ANALYSIS_INDEX.md docs/archive/ 2>/dev/null
mv -f ANALYSIS_README.md docs/archive/ 2>/dev/null
mv -f ANALYSIS_SUMMARY.md docs/archive/ 2>/dev/null
mv -f CODE_ANALYSIS_REPORT.md docs/archive/ 2>/dev/null
mv -f NEXT_STEPS.md docs/archive/ 2>/dev/null

# Move patch/approval docs to docs/archive
mv -f PATCH_APPLICATION_ANALYSIS.md docs/archive/ 2>/dev/null
mv -f PATCH_APPROVAL_EXAMPLE.md docs/archive/ 2>/dev/null
mv -f PATCH_APPROVAL_IMPLEMENTATION_SUMMARY.md docs/archive/ 2>/dev/null

# Move prevention/error docs to docs/archive
mv -f ERROR_PREFETCH_IMPLEMENTATION.md docs/archive/ 2>/dev/null
mv -f PREVENTION_AND_TESTING_IMAGE_ATTACHMENTS.md docs/archive/ 2>/dev/null
mv -f PREVENTION_STRATEGIES_AI_PERFORMANCE.md docs/archive/ 2>/dev/null

# Move UI/feature docs to docs/archive
mv -f LSP_UI_INTEGRATION.md docs/archive/ 2>/dev/null
mv -f README_ARCHITECTURE.md docs/archive/ 2>/dev/null
mv -f QUICK_FIXES.md docs/archive/ 2>/dev/null

# Move misc docs to docs/archive
mv -f aisdk.md docs/archive/ 2>/dev/null
mv -f select.md docs/archive/ 2>/dev/null
mv -f COLLAB.md docs/archive/ 2>/dev/null

# Delete old summary/delivery files
rm -f AGENTIC_SUMMARY.txt
rm -f DELIVERY_SUMMARY.txt

# Delete environment files with secrets
rm -f .env.local

# Delete old root files that were moved to .github or docs
rm -f CONTRIBUTING.md
rm -f LICENSING.md
rm -f COMMERCIAL_LICENSE
rm -f OPTIMIZATION.md
rm -f SECURITY_CHECKLIST.md

# Delete this cleanup script
rm -f .cleanup_files.sh

echo "✅ Cleanup complete!"
echo ""
echo "Root files remaining:"
ls -1 *.md LICENSE* 2>/dev/null | head -20
echo ""
echo "Archived docs moved to: docs/archive/"
ls docs/archive/ 2>/dev/null | wc -l | xargs echo "Files archived:"
